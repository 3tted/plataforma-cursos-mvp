"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Arcos from "@/components/Arcos";
import Avatar from "@/components/Avatar";
import { useApp } from "@/components/Contexto";
import ExpedienteCurso from "@/components/ExpedienteCurso";
import { IconoCalendario, IconoComentario, IconoEditar, IconoPregunta, IconoPublicacion } from "@/components/Iconos";
import { useTitulo } from "@/components/useTitulo";
import { api, hace } from "@/lib/cliente";

interface Perfil {
  publicaciones: { id: number; comunidad: string; titulo: string; categoria: string; creadaEn: string }[];
  comentarios: { id: number; comunidad: string; publicacion: string; cuerpo: string; creadoEn: string }[];
  preguntas: { id: number; comunidad: string; pregunta: string; creadaEn: string }[];
}

type Contribucion = {
  clave: string;
  comunidad: string;
  tipo: "publicacion" | "comentario" | "pregunta";
  texto: string;
  contexto: string;
  fecha: string;
  enlace: string;
};

const DIAS = 24 * 60 * 60 * 1000;
const MESES = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."];

function claveDia(fecha: Date): string {
  return `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
}

// El nombre de usuario se arma con el nombre, sin acentos ni espacios.
function usuarioDe(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 24);
}

// Calendario de actividad: 53 semanas que terminan hoy, de lunes a domingo.
function Actividad({ fechas }: { fechas: string[] }) {
  const { semanas, meses, total } = useMemo(() => {
    const porDia = new Map<string, number>();
    for (const f of fechas) {
      const k = claveDia(new Date(f));
      porDia.set(k, (porDia.get(k) ?? 0) + 1);
    }
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const lunesActual = new Date(hoy.getTime() - ((hoy.getDay() + 6) % 7) * DIAS);
    const inicio = new Date(lunesActual.getTime() - 52 * 7 * DIAS);
    const semanas: { fecha: Date; cuenta: number; futuro: boolean }[][] = [];
    const meses: { columna: number; texto: string }[] = [];
    let total = 0;
    for (let s = 0; s < 53; s++) {
      const semana = [];
      for (let d = 0; d < 7; d++) {
        const fecha = new Date(inicio.getTime() + (s * 7 + d) * DIAS);
        const cuenta = porDia.get(claveDia(fecha)) ?? 0;
        total += cuenta;
        semana.push({ fecha, cuenta, futuro: fecha > hoy });
      }
      const primerDia = semana[0].fecha;
      const anterior = semanas.at(-1)?.[0].fecha;
      if (!anterior || anterior.getMonth() !== primerDia.getMonth()) {
        meses.push({ columna: s, texto: MESES[primerDia.getMonth()] });
      }
      semanas.push(semana);
    }
    // Un mes que apenas asoma (menos de 3 semanas antes del siguiente) no lleva
    // etiqueta: si no, los nombres se enciman.
    const conEspacio = meses.filter((m, i) => !meses[i + 1] || meses[i + 1].columna - m.columna >= 3);
    return { semanas, meses: conEspacio, total };
  }, [fechas]);

  const nivel = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4);

  return (
    <div className="actividad">
      <div className="actividad-desplazable">
        <div className="actividad-tabla" role="img" aria-label={`${total} contribuciones en los últimos 12 meses`}>
          <div className="actividad-meses" aria-hidden="true">
            {meses.map((m) => (
              <span key={`${m.columna}-${m.texto}`} style={{ gridColumn: m.columna + 1 }}>
                {m.texto}
              </span>
            ))}
          </div>
          <div className="actividad-dias" aria-hidden="true">
            <span>lun.</span>
            <span />
            <span>mié.</span>
            <span />
            <span>vie.</span>
            <span />
            <span>dom.</span>
          </div>
          <div className="actividad-celdas" aria-hidden="true">
            {semanas.flat().map(({ fecha, cuenta, futuro }) => (
              <span
                key={fecha.toISOString()}
                className="actividad-celda"
                data-nivel={futuro ? "futuro" : nivel(cuenta)}
                title={
                  futuro
                    ? undefined
                    : `${cuenta === 0 ? "Sin" : cuenta} contribuci${cuenta === 1 ? "ón" : "ones"} el ${fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}`
                }
              />
            ))}
          </div>
        </div>
      </div>
      <div className="actividad-pie">
        <span className="texto-suave">
          Cada cuadro es un día: publicaciones, comentarios y preguntas al asistente.
        </span>
        <span className="actividad-escala" aria-hidden="true">
          Menos
          {[0, 1, 2, 3, 4].map((n) => (
            <span key={n} className="actividad-celda" data-nivel={n} />
          ))}
          Más
        </span>
      </div>
    </div>
  );
}

export default function PaginaPerfil() {
  const { usuario, guardarUsuario, membresiaEn, completadas, lecciones, cursos, inscritoEn, enLaComunidad, cambiarComunidad, comunidades } =
    useApp();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [bio, setBio] = useState("");
  const [grupo, setGrupo] = useState("todas");
  useTitulo("Tu perfil");

  useEffect(() => {
    if (!usuario) return;
    setErrorCarga(false);
    api<Perfil>(`/api/perfil?autor=${encodeURIComponent(usuario.nombre)}`)
      .then(setPerfil)
      .catch(() => setErrorCarga(true));
  }, [usuario]);

  const contribuciones = useMemo<Contribucion[]>(() => {
    if (!perfil) return [];
    return [
      ...perfil.publicaciones.map((p) => ({
        clave: `p${p.id}`,
        comunidad: p.comunidad,
        tipo: "publicacion" as const,
        texto: p.titulo,
        contexto: `Publicación en ${p.categoria}`,
        fecha: p.creadaEn,
        enlace: "/comunidad",
      })),
      ...perfil.comentarios.map((c) => ({
        clave: `c${c.id}`,
        comunidad: c.comunidad,
        tipo: "comentario" as const,
        texto: c.cuerpo,
        contexto: `Comentario en «${c.publicacion}»`,
        fecha: c.creadoEn,
        enlace: "/comunidad",
      })),
      ...perfil.preguntas.map((q) => ({
        clave: `q${q.id}`,
        comunidad: q.comunidad,
        tipo: "pregunta" as const,
        texto: q.pregunta,
        contexto: "Pregunta al asistente",
        fecha: q.creadaEn,
        enlace: "/curso/asistente",
      })),
    ].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [perfil]);

  if (!usuario) return null;

  // Comunidades reales a las que pertenece (la coach, a todas).
  const suyas = comunidades.filter((c) => c.estado === "activa" && enLaComunidad(c.id));
  // Lecciones terminadas en todos los cursos de la comunidad.
  const idsCursos = cursos.length ? cursos.flatMap((c) => c.lecciones) : lecciones.filter((l) => !l.deCoach).map((l) => l.id);
  const hechas = idsCursos.filter((id) => completadas.includes(id)).length;
  const desde = usuario.desde ? new Date(usuario.desde) : new Date();
  const visibles = grupo === "todas" ? contribuciones : contribuciones.filter((c) => c.comunidad === grupo);
  const estadoMembresia = (comunidad: string) =>
    usuario.rol === "coach" ? "Coach de la comunidad" : membresiaEn(comunidad) ? "Miembro" : "Acceso gratis al módulo 1";

  const abrirEdicion = () => {
    setNombre(usuario.nombre);
    setBio(usuario.bio ?? "");
    setEditando(true);
  };

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    const limpio = nombre.trim();
    if (!limpio) return;
    guardarUsuario({ ...usuario, nombre: limpio.slice(0, 60), bio: bio.trim().slice(0, 160) || undefined });
    setEditando(false);
  };

  return (
    <div className="pagina-perfil">
      <div className="perfil-principal">
        <section aria-labelledby="actividad-titulo" className="perfil-seccion">
          <h2 id="actividad-titulo">Actividad</h2>
          <div className="tarjeta">
            {errorCarga ? (
              <p className="error">No pudimos cargar tu actividad. Revisa tu conexión y recarga la página.</p>
            ) : (
              <Actividad fechas={contribuciones.map((c) => c.fecha)} />
            )}
          </div>
        </section>

        <section aria-labelledby="membresias-titulo" className="perfil-seccion">
          <h2 id="membresias-titulo">Membresías</h2>
          {suyas.length === 0 && (
            <p className="vacio">
              Todavía no eres parte de ninguna comunidad. <Link href="/comunidades">Ve el directorio</Link> para unirte a una.
            </p>
          )}
          <ul className="perfil-membresias">
            {suyas.map((c) => (
              <li key={c.id}>
                <Link href="/comunidad" className="perfil-membresia" onClick={() => cambiarComunidad(c.id)}>
                  <span className="perfil-membresia-sello" aria-hidden="true">
                    {c.nombre
                      .split(" ")
                      .filter((p) => p.length > 2)
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span className="perfil-membresia-textos">
                    <span className="perfil-membresia-nombre">{c.nombre}</span>
                    <span className="texto-suave">con {c.coach}</span>
                  </span>
                  <span className={membresiaEn(c.id) || usuario.rol === "coach" ? "pastilla pastilla-ok" : "pastilla"}>
                    {estadoMembresia(c.id)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {usuario.rol === "alumno" && (
          <section aria-labelledby="expediente-titulo" className="perfil-seccion">
            <h2 id="expediente-titulo">{cursos.length > 1 ? "Expediente de tus cursos" : "Expediente del curso"}</h2>
            {cursos.some((c) => inscritoEn(c.id)) ? (
              cursos
                .filter((c) => inscritoEn(c.id))
                .map((c) => <ExpedienteCurso key={c.id} autor={usuario.nombre} curso={c} />)
            ) : (
              <p className="vacio">
                Todavía no estás inscrito en ningún curso. <Link href="/comunidad">Ve a la comunidad</Link> para elegir uno.
              </p>
            )}
          </section>
        )}

        <section aria-labelledby="contribuciones-titulo" className="perfil-seccion">
          <div className="perfil-seccion-cabecera">
            <h2 id="contribuciones-titulo">Contribuciones</h2>
            <label className="perfil-filtro">
              <span className="sr-only">Comunidad</span>
              <select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
                <option value="todas">Todas las comunidades</option>
                {suyas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!perfil && !errorCarga && <p className="texto-suave">Cargando tus contribuciones…</p>}
          {perfil && visibles.length === 0 && (
            <div className="perfil-vacio">
              <p>Todavía no tienes contribuciones.</p>
              <p className="texto-suave">
                Preséntate en la comunidad, comenta una publicación o hazle una pregunta al asistente: todo aparece aquí.
              </p>
              <Link href="/comunidad" className="boton boton-chico">
                Ir a la comunidad
              </Link>
            </div>
          )}
          {visibles.length > 0 && (
            <ul className="perfil-contribuciones">
              {visibles.map((c) => (
                <li key={c.clave}>
                  <Link href={c.enlace} className="perfil-contribucion">
                    <span className="perfil-contribucion-icono" aria-hidden="true">
                      {c.tipo === "publicacion" ? (
                        <IconoPublicacion width={18} height={18} />
                      ) : c.tipo === "comentario" ? (
                        <IconoComentario width={18} height={18} />
                      ) : (
                        <IconoPregunta width={18} height={18} />
                      )}
                    </span>
                    <span className="perfil-contribucion-textos">
                      <span className="perfil-contribucion-contexto">
                        {c.contexto} · <time dateTime={c.fecha}>{hace(c.fecha)}</time>
                      </span>
                      <span className="perfil-contribucion-texto">{c.texto}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="perfil-tarjeta" aria-label="Tu perfil">
        <div className="perfil-portada">
          <Arcos />
          <Avatar nombre={usuario.nombre} tamaño={112} coach={usuario.rol === "coach"} />
        </div>
        <div className="perfil-datos">
          {editando ? (
            <form className="perfil-edicion" onSubmit={guardar}>
              <label className="campo">
                <span>Nombre</span>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} required />
              </label>
              <label className="campo">
                <span>Sobre ti</span>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={160}
                  rows={3}
                  aria-describedby="bio-cuenta"
                />
              </label>
              <p className="nota" id="bio-cuenta">
                <span className="cifra">{bio.length}</span> de 160 caracteres. Tus publicaciones anteriores conservan el
                nombre con el que las firmaste.
              </p>
              <div className="fila-acciones">
                <button type="button" className="boton boton-fantasma boton-chico" onClick={() => setEditando(false)}>
                  Cancelar
                </button>
                <button type="submit" className="boton boton-chico">
                  Guardar
                </button>
              </div>
            </form>
          ) : (
            <>
              <h1 className="perfil-nombre">{usuario.nombre}</h1>
              <p className="perfil-usuario">@{usuarioDe(usuario.nombre)}</p>
              {usuario.bio ? (
                <p className="perfil-bio">{usuario.bio}</p>
              ) : (
                <p className="perfil-bio texto-suave">Cuéntale a la comunidad a qué te dedicas.</p>
              )}
            </>
          )}

          <ul className="perfil-hechos">
            <li>
              <span className="perfil-en-linea" aria-hidden="true" /> En línea ahora
            </li>
            <li>
              <IconoCalendario width={18} height={18} /> Se unió el{" "}
              {desde.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
            </li>
          </ul>

          <dl className="perfil-cifras">
            <div>
              <dd className="cifra">{perfil ? perfil.publicaciones.length + perfil.comentarios.length : "…"}</dd>
              <dt>Contribuciones</dt>
            </div>
            <div>
              <dd className="cifra">{hechas}</dd>
              <dt>Lecciones</dt>
            </div>
            <div>
              <dd className="cifra">{perfil ? perfil.preguntas.length : "…"}</dd>
              <dt>Preguntas</dt>
            </div>
          </dl>

          {!editando && (
            <button type="button" className="boton boton-secundario boton-bloque" onClick={abrirEdicion}>
              <IconoEditar width={16} height={16} /> Editar perfil
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
