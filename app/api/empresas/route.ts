import { consultar, modificar } from "@/lib/almacen";
import { COMUNIDADES } from "@/lib/comunidades";
import { CURSOS_DE_ARCHIVO } from "@/lib/curso";
import {
  cifrarContrasena,
  correoValido,
  cuentaPorCorreo,
  cuentaPorNombre,
  cuentaPublica,
  EMPRESA_MERKATICS,
  idEmpresaLibre,
  MIN_CONTRASENA,
  normalizarCorreo,
  nuevoIdCuenta,
} from "@/lib/cuentas";
import { ErrorDeDatos, leerJson, manejar, texto } from "@/lib/http";
import { planNuevo } from "@/lib/plan";
import { coachDe, SinPermiso } from "@/lib/permisos";
import { abrirSesion, cookieDeSesion, cuentaDe } from "@/lib/sesion";
import { RANGOS_ALUMNOS, type Cuenta, type Empresa } from "@/lib/tipos";

export const dynamic = "force-dynamic";

// Registrar una empresa (/registra-tu-empresa): quien la registra queda como
// su dueño. En el MVP se crea al momento (simulado: en la versión real
// Merkatics la revisaría antes de activarla). Con sesión de alumno, su misma
// cuenta pasa a ser la del dueño; sin sesión, se crea la cuenta.
// { empresa, giro?, alumnos, nombre?, correo?, contrasena? }
export const POST = manejar(async (req: Request) => {
  const datos = await leerJson(req);
  const sesion = await cuentaDe(req);
  if (sesion?.rol === "coach") {
    throw new ErrorDeDatos("Tu cuenta ya es del equipo de una empresa. Para registrar otra, usa otra cuenta.");
  }
  const nombreEmpresa = texto(datos.empresa, "nombre de la empresa", 60);
  if (nombreEmpresa.length < 2) throw new ErrorDeDatos("Escribe el nombre de tu empresa (al menos 2 letras).");
  const giro = typeof datos.giro === "string" ? datos.giro.trim().slice(0, 120) : "";
  const alumnos = typeof datos.alumnos === "string" && RANGOS_ALUMNOS.includes(datos.alumnos) ? datos.alumnos : null;
  if (!alumnos) throw new ErrorDeDatos("Elige cuántos alumnos tienes hoy.");

  // Sin sesión: los datos de la cuenta nueva.
  let nueva: Omit<Cuenta, "id" | "creadaEn" | "rol"> | null = null;
  if (!sesion) {
    const nombre = texto(datos.nombre, "tu nombre", 60);
    if (nombre.length < 2) throw new ErrorDeDatos("Escribe tu nombre (al menos 2 letras).");
    const correo = normalizarCorreo(datos.correo);
    if (!correoValido(correo)) throw new ErrorDeDatos("Escribe un correo válido, por ejemplo ana@correo.com.");
    const contrasena = typeof datos.contrasena === "string" ? datos.contrasena : "";
    if (contrasena.length < MIN_CONTRASENA) throw new ErrorDeDatos(`La contraseña necesita al menos ${MIN_CONTRASENA} caracteres.`);
    nueva = { nombre, correo, contrasena: await cifrarContrasena(contrasena.slice(0, 200)) };
  }

  const { cuenta, empresa, token } = await modificar((a) => {
    let cuenta: Cuenta;
    if (sesion) {
      const propia = a.cuentas?.find((c) => c.id === sesion.id);
      if (!propia) throw new ErrorDeDatos("No encontramos tu cuenta.");
      cuenta = propia;
    } else {
      if (cuentaPorCorreo(a, nueva!.correo)) throw new ErrorDeDatos("Ya hay una cuenta con ese correo. Entra con ella y registra tu empresa.");
      if (cuentaPorNombre(a, nueva!.nombre)) {
        throw new ErrorDeDatos("Ya hay alguien con ese nombre en la plataforma. Agrega tu apellido o una inicial.");
      }
      cuenta = { id: nuevoIdCuenta(), rol: "alumno", creadaEn: new Date().toISOString(), ...nueva! };
      a.cuentas = [...(a.cuentas ?? []), cuenta];
    }
    const ahora = new Date().toISOString();
    const empresa: Empresa = {
      id: idEmpresaLibre(a, nombreEmpresa),
      dueno: cuenta.nombre,
      nombre: nombreEmpresa,
      ...(giro ? { giro } : {}),
      alumnosAprox: alumnos,
      // 7 días de prueba gratis y luego el plan mensual (pagos simulados).
      plan: planNuevo(),
      creadaEn: ahora,
      actualizadaEn: ahora,
    };
    a.empresas = [...(a.empresas ?? []), empresa];
    Object.assign(cuenta, { rol: "coach", empresa: empresa.id, rolEmpresa: "dueno" });
    return { cuenta, empresa, token: sesion ? null : abrirSesion(a, cuenta.id) };
  });
  return Response.json(
    { cuenta: cuentaPublica(cuenta), empresa: { id: empresa.id, nombre: empresa.nombre } },
    { status: 201, ...(token ? { headers: { "Set-Cookie": cookieDeSesion(req, token) } } : {}) },
  );
});

// Todas las empresas de la plataforma (solo el equipo de Merkatics): su dueño,
// cuándo se registró y cuánto tiene.
export const GET = manejar(async (req: Request) => {
  const coach = await coachDe(req);
  if (!coach.cuenta.admin) throw new SinPermiso("Solo el equipo de Merkatics ve todas las empresas.");
  return Response.json(
    await consultar((a) =>
      [...(a.empresas ?? [])]
        .sort((x, y) => y.creadaEn.localeCompare(x.creadaEn))
        .map((e) => {
          const deEjemplo = e.id === EMPRESA_MERKATICS;
          const comunidades = (a.comunidadesCoach ?? []).filter((c) => (c.empresa ?? EMPRESA_MERKATICS) === e.id).length;
          const cursos = (a.cursosCoach ?? []).filter((c) => c.empresa === e.id).length;
          return {
            id: e.id,
            nombre: e.nombre,
            dueno: e.dueno,
            ...(e.giro ? { giro: e.giro } : {}),
            ...(e.alumnosAprox ? { alumnosAprox: e.alumnosAprox } : {}),
            creadaEn: e.creadaEn,
            // Su plan con Merkatics (pagos simulados): sin plan, empresa de ejemplo o anterior a los planes.
            ...(e.plan ? { plan: { estado: e.plan.estado, metodo: e.plan.metodo ?? null, cancelado: e.plan.cancelado === true } } : {}),
            equipo: (a.cuentas ?? []).filter((c) => c.rol === "coach" && c.empresa === e.id).length,
            // La de Merkatics también tiene las comunidades y los cursos que vienen con la plataforma.
            comunidades: comunidades + (deEjemplo ? COMUNIDADES.length : 0),
            cursos: cursos + (deEjemplo ? CURSOS_DE_ARCHIVO : 0),
          };
        }),
    ),
  );
});
