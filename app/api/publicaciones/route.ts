import { consultar, modificar, nuevoId } from "@/lib/almacen";
import { COMUNIDAD_PRINCIPAL, idComunidad } from "@/lib/curso";
import { ErrorDeDatos, leerJson, manejar, rol, texto } from "@/lib/http";
import { CATEGORIAS, type Categoria, type Publicacion } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Publicaciones de una comunidad (?comunidad=id); sin parámetro, la principal.
export const GET = manejar(async (req: Request) => {
  const comunidad = await idComunidad(new URL(req.url).searchParams.get("comunidad"));
  const publicaciones = await consultar((a) =>
    a.publicaciones.filter((p) => (p.comunidad ?? COMUNIDAD_PRINCIPAL) === comunidad),
  );
  const ordenadas = [...publicaciones].sort(
    (x, y) => Number(y.fijada) - Number(x.fijada) || y.creadaEn.localeCompare(x.creadaEn),
  );
  return Response.json(ordenadas);
});

export const POST = manejar(async (req: Request) => {
  const datos = await leerJson(req);
  const categoria = datos.categoria as Categoria;
  if (!CATEGORIAS.includes(categoria)) throw new ErrorDeDatos("Categoría no válida.");
  const autorRol = rol(datos.rol);
  const comunidad = await idComunidad(datos.comunidad);
  if (categoria === "Anuncios" && autorRol !== "coach") {
    throw new ErrorDeDatos("Solo la coach puede publicar anuncios.");
  }
  const nueva = await modificar((a) => {
    const publicacion: Publicacion = {
      id: nuevoId(a),
      comunidad,
      autor: texto(datos.autor, "autor", 60),
      rol: autorRol,
      categoria,
      titulo: texto(datos.titulo, "titulo", 140),
      cuerpo: texto(datos.cuerpo, "cuerpo", 4000),
      // Solo la coach fija, y solo anuncios.
      fijada: autorRol === "coach" && categoria === "Anuncios" && datos.fijada === true,
      creadaEn: new Date().toISOString(),
      comentarios: [],
      reacciones: [],
    };
    a.publicaciones.push(publicacion);
    return publicacion;
  });
  return Response.json(nueva, { status: 201 });
});
