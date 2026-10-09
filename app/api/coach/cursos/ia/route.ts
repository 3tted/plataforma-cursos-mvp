import { consultar, modificar } from "@/lib/almacen";
import { aplicarEdicion, nuevoCurso } from "@/lib/creacion";
import { comoEdicion, conTexto, leerDocumento, proponerCurso, type Documento } from "@/lib/curso-ia";
import { ErrorDeDatos, manejar } from "@/lib/http";
import { coachDe, comunidadDeCoach, conPermiso } from "@/lib/permisos";

export const dynamic = "force-dynamic";
// Armar un curso con IA tarda de 10 a 60 segundos; 60 es el máximo del plan gratuito de Vercel.
export const maxDuration = 60;

// La coach sube un documento (o pega el texto) y la IA lo convierte en un
// borrador de curso de su comunidad. Se abre en el editor para revisarlo.
export const POST = manejar((req: Request) =>
  conPermiso(async () => {
    const forma = await req.formData().catch(() => {
      throw new ErrorDeDatos("No recibimos el documento. Inténtalo de nuevo.");
    });
    const autor = coachDe(req, forma.get("autor"));
    const comunidad = String(forma.get("comunidad") ?? "");
    // Antes de gastar en la IA, que la comunidad sea de esta coach.
    await consultar((a) => comunidadDeCoach(a, comunidad, autor));

    const archivo = forma.get("archivo");
    const pegado = String(forma.get("texto") ?? "");
    let doc: Documento;
    if (archivo instanceof File && archivo.size > 0) doc = await leerDocumento(archivo);
    else if (pegado.trim()) doc = conTexto(pegado, "Texto pegado");
    else throw new ErrorDeDatos("Sube un documento o pega el texto de tu material.");

    const indicaciones = String(forma.get("indicaciones") ?? "").trim().slice(0, 500);
    const propuesta = await proponerCurso(doc, indicaciones);

    const curso = await modificar((a) => {
      comunidadDeCoach(a, comunidad, autor);
      const borrador = aplicarEdicion(a, nuevoCurso(a, autor, comunidad, "ia"), comoEdicion(propuesta));
      (a.cursosCoach ??= []).push(borrador);
      return borrador;
    });
    return Response.json(curso, { status: 201 });
  }),
);
