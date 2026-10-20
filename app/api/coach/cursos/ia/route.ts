import { consultar, modificar } from "@/lib/almacen";
import { aplicarEdicion, nuevoCurso } from "@/lib/creacion";
import {
  comoEdicion,
  conTexto,
  juntarMedidas,
  leerDocumento,
  medidasDelTexto,
  proponerCurso,
  type Documento,
} from "@/lib/curso-ia";
import { ErrorDeDatos, manejar } from "@/lib/http";
import { coachDe, conPermiso, destinoDeCurso } from "@/lib/permisos";

export const dynamic = "force-dynamic";
// Armar un curso con IA suele tardar menos de un minuto, pero si el modelo
// principal está saturado y hay que pedir una corrección puede llegar a varios.
export const maxDuration = 300;

// La coach sube un documento (o pega el texto) y la IA lo convierte en un
// borrador de curso de su comunidad. Se abre en el editor para revisarlo.
export const POST = manejar((req: Request) =>
  conPermiso(async () => {
    const forma = await req.formData().catch(() => {
      throw new ErrorDeDatos("No recibimos el documento. Inténtalo de nuevo.");
    });
    const coach = await coachDe(req);
    const comunidad = String(forma.get("comunidad") ?? "");
    // Antes de gastar en la IA, que la comunidad (si eligió una) sea de esta coach.
    await consultar((a) => destinoDeCurso(a, comunidad, coach));

    const archivo = forma.get("archivo");
    const pegado = String(forma.get("texto") ?? "");
    let doc: Documento;
    if (archivo instanceof File && archivo.size > 0) doc = await leerDocumento(archivo);
    else if (pegado.trim()) doc = conTexto(pegado, "Texto pegado");
    else throw new ErrorDeDatos("Sube un documento o pega el texto de tu material.");

    const indicaciones = String(forma.get("indicaciones") ?? "").trim().slice(0, 500);
    // Cantidades: las de los campos mandan; si no, las que escribió en sus indicaciones.
    const campo = (k: string) => {
      const v = String(forma.get(k) ?? "").trim();
      return v === "" ? undefined : Number(v);
    };
    const medidas = juntarMedidas(
      { lecciones: campo("lecciones"), repaso: campo("repaso"), examen: campo("examen") },
      medidasDelTexto(indicaciones),
    );
    const { propuesta, aviso } = await proponerCurso(doc, indicaciones, medidas);

    const curso = await modificar((a) => {
      const borrador = aplicarEdicion(a, nuevoCurso(a, coach, destinoDeCurso(a, comunidad, coach), "ia"), comoEdicion(propuesta));
      (a.cursosCoach ??= []).push(borrador);
      return borrador;
    });
    // "aviso": si no se juntó todo lo pedido; el editor se lo muestra a la coach.
    return Response.json({ ...curso, aviso }, { status: 201 });
  }),
);
