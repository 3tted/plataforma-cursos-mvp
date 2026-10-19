import { borrarFoto, guardarFoto, leerFoto, modificar } from "@/lib/almacen";
import { error, manejar } from "@/lib/http";
import { coachDe, comunidadDeCoach, conPermiso, cursoDeCoach, empresaDeCoach } from "@/lib/permisos";

export const dynamic = "force-dynamic";

// Fotos que sube la coach: la portada de una comunidad ("comunidad-<id>") o de
// un curso ("curso-<id>"), y el logo de su empresa ("empresa-<id>"). El
// navegador ya la manda reducida (JPEG las portadas, PNG el logo).
// Como el resto del MVP, el permiso se simula con X-Rol y el nombre de la coach.

type Contexto = { params: Promise<{ clave: string }> };

const MAX_BYTES_FOTO = 3 * 1024 * 1024;

type De = "comunidad" | "curso" | "empresa";

function partes(clave: string): { de: De; id: string } | null {
  const m = /^(comunidad|curso|empresa)-([a-z0-9-]{1,60})$/.exec(clave);
  return m ? { de: m[1] as De, id: m[2] } : null;
}

// JPEG, PNG o WebP, por sus primeros bytes.
function tipoDeFoto(b: Buffer): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return "image/png";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

/** Pone (o quita, con null) la url de la foto en la comunidad, el curso o la empresa de la coach. */
async function anotar(req: Request, clave: string, url: string | null) {
  const p = partes(clave);
  if (!p) return null;
  const autor = coachDe(req, new URL(req.url).searchParams.get("autor"));
  await modificar((a) => {
    if (p.de === "empresa") {
      const empresa = empresaDeCoach(a, p.id, autor);
      if (url) empresa.logo = url;
      else delete empresa.logo;
      empresa.actualizadaEn = new Date().toISOString();
      return;
    }
    const dueno = p.de === "curso" ? cursoDeCoach(a, p.id, autor) : comunidadDeCoach(a, p.id, autor);
    if (url) dueno.foto = url;
    else delete dueno.foto;
    if (p.de === "curso") (dueno as { actualizadoEn: string }).actualizadoEn = new Date().toISOString();
  });
  return p;
}

export const GET = manejar(async (_req: Request, contexto: Contexto) => {
  const { clave } = await contexto.params;
  const foto = partes(clave) ? await leerFoto(clave) : null;
  if (!foto) return error("No hay foto.", 404);
  // La url cambia con cada foto nueva (?v=), así que se puede guardar en caché.
  return new Response(new Uint8Array(foto.datos), {
    headers: { "Content-Type": foto.tipo, "Cache-Control": "public, max-age=31536000, immutable" },
  });
});

export const PUT = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { clave } = await contexto.params;
    if (!partes(clave)) return error("No encontramos dónde va esa foto.", 404);
    const datos = Buffer.from(await req.arrayBuffer());
    if (datos.length === 0) return error("No llegó la foto.");
    if (datos.length > MAX_BYTES_FOTO) return error("La foto pesa demasiado (máximo 3 MB).", 413);
    const tipo = tipoDeFoto(datos);
    if (!tipo) return error("Ese archivo no es una foto JPG, PNG o WebP.");
    const url = `/api/fotos/${clave}?v=${Date.now().toString(36)}`;
    // Primero se revisa el permiso (y se anota la url); luego se guarda la foto.
    await anotar(req, clave, url);
    await guardarFoto(clave, tipo, datos);
    return Response.json({ foto: url });
  }),
);

export const DELETE = manejar((req: Request, contexto: Contexto) =>
  conPermiso(async () => {
    const { clave } = await contexto.params;
    if (!(await anotar(req, clave, null))) return error("No encontramos dónde va esa foto.", 404);
    await borrarFoto(clave);
    return new Response(null, { status: 204 });
  }),
);
