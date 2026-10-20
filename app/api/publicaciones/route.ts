import { consultar, modificar, nuevoId } from "@/lib/almacen";
import { COMUNIDAD_PRINCIPAL, idComunidad } from "@/lib/curso";
import { ErrorDeDatos, leerJson, manejar, texto } from "@/lib/http";
import { cuentaDeReq, empresaDeComunidad } from "@/lib/permisos";
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

// Publica quien tiene sesión, con su nombre. Firma como coach solo una coach
// de la empresa dueña de la comunidad (y solo ella publica anuncios).
export const POST = manejar(async (req: Request) => {
  const cuenta = await cuentaDeReq(req);
  const datos = await leerJson(req);
  const categoria = datos.categoria as Categoria;
  if (!CATEGORIAS.includes(categoria)) throw new ErrorDeDatos("Categoría no válida.");
  const comunidad = await idComunidad(datos.comunidad);
  const nueva = await modificar((a) => {
    const autorRol = cuenta.rol === "coach" && cuenta.empresa === empresaDeComunidad(a, comunidad) ? "coach" : "alumno";
    if (categoria === "Anuncios" && autorRol !== "coach") {
      throw new ErrorDeDatos("Solo la coach de esta comunidad puede publicar anuncios.");
    }
    const publicacion: Publicacion = {
      id: nuevoId(a),
      comunidad,
      autor: cuenta.nombre,
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
