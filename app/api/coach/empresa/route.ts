import { consultar, modificar } from "@/lib/almacen";
import { ErrorDeDatos, leerJson, manejar } from "@/lib/http";
import { COLOR_MERKATICS, normalizarColor } from "@/lib/marca";
import { coachDe, conPermiso } from "@/lib/permisos";
import type { Empresa } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// La empresa de la coach y su marca (nombre, color y logo). Por ahora cada
// coach es una empresa de una persona; se crea la primera vez que guarda. Su
// marca se aplica en sus comunidades, sus cursos y sus lecciones.

const slug = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "empresa";

export const GET = manejar((req: Request) =>
  conPermiso(async () => {
    const autor = coachDe(req, new URL(req.url).searchParams.get("autor"));
    const empresa = await consultar((a) => (a.empresas ?? []).find((e) => e.dueno === autor) ?? null);
    // Sin guardar todavía: se propone su nombre y el color de Merkatics.
    return Response.json(empresa ?? { id: null, dueno: autor, nombre: autor, color: COLOR_MERKATICS });
  }),
);

// Guarda nombre y color: { autor, nombre, color }.
export const PUT = manejar((req: Request) =>
  conPermiso(async () => {
    const datos = await leerJson(req);
    const autor = coachDe(req, datos.autor);
    const nombre = typeof datos.nombre === "string" ? datos.nombre.trim().slice(0, 60) : "";
    if (nombre.length < 2) throw new ErrorDeDatos("Ponle un nombre a tu empresa o marca (al menos 2 letras).");
    const color = normalizarColor(datos.color);
    if (!color) throw new ErrorDeDatos("Elige un color válido, por ejemplo #2563eb.");
    const empresa = await modificar((a): Empresa => {
      a.empresas ??= [];
      const ahora = new Date().toISOString();
      const actual = a.empresas.find((e) => e.dueno === autor);
      if (actual) return Object.assign(actual, { nombre, color, actualizadaEn: ahora });
      const base = slug(autor);
      let id = base;
      for (let n = 2; a.empresas.some((e) => e.id === id); n++) id = `${base}-${n}`;
      const nueva: Empresa = { id, dueno: autor, nombre, color, creadaEn: ahora, actualizadaEn: ahora };
      a.empresas.push(nueva);
      return nueva;
    });
    return Response.json(empresa);
  }),
);
