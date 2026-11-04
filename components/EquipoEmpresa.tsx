"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, fechaCorta } from "@/lib/cliente";
import type { RolEmpresa } from "@/lib/tipos";
import Avatar from "./Avatar";
import { useApp } from "./Contexto";
import { IconoCopiar, IconoEnlace, IconoInvitar } from "./Iconos";

interface Miembro {
  nombre: string;
  correo: string;
  rolEmpresa: RolEmpresa;
}

interface InvitacionVista {
  codigo: string;
  tipo: "coach" | "empresa";
  rol: "admin" | "coach";
  nombreEmpresa?: string;
  creadaPor: string;
  venceEn: string;
}

interface EmpresaRegistrada {
  id: string;
  nombre: string;
  dueno: string;
  giro?: string;
  alumnosAprox?: string;
  creadaEn: string;
  equipo: number;
  comunidades: number;
  cursos: number;
  plan?: { estado: "prueba" | "activo" | "pausado" | "cancelado"; metodo: string | null; cancelado: boolean };
}

const ESTADO_PLAN = { prueba: "En prueba", activo: "Activo", pausado: "En pausa", cancelado: "Cancelado" } as const;

const NOMBRE_ROL: Record<RolEmpresa, string> = { dueno: "Dueño", admin: "Administrador", coach: "Coach" };

// Debajo de "Mi empresa": la dirección de la empresa para compartir, su equipo
// con su rol y las invitaciones. El dueño y los administradores invitan,
// cambian roles y quitan gente (menos al dueño); solo el dueño le pasa la
// empresa a otra persona. Al equipo de Merkatics le toca ver todas las
// empresas, invitar empresas nuevas y dar contraseñas temporales.
export default function EquipoEmpresa({ empresa, administra }: { empresa: string; administra: boolean }) {
  const { usuario } = useApp();
  const [datos, setDatos] = useState<{ equipo: Miembro[]; invitaciones: InvitacionVista[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [creando, setCreando] = useState<"coach" | "admin" | "empresa" | null>(null);
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [correoOlvido, setCorreoOlvido] = useState("");
  const [temporal, setTemporal] = useState<{ nombre: string; correo: string; contrasena: string } | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaRegistrada[] | null>(null);
  const [origen, setOrigen] = useState("");
  const esEquipoMerkatics = usuario?.admin === true;
  const soyDueno = usuario?.dueno === true;

  const cargar = useCallback(() => {
    api<{ equipo: Miembro[]; invitaciones: InvitacionVista[] }>("/api/invitaciones")
      .then(setDatos)
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(() => {
    setOrigen(window.location.origin);
    cargar();
  }, [cargar]);
  useEffect(() => {
    if (!esEquipoMerkatics) return;
    api<EmpresaRegistrada[]>("/api/empresas")
      .then(setEmpresas)
      .catch((e) => setError((e as Error).message));
  }, [esEquipoMerkatics]);

  const enlaceDe = (codigo: string) => `${origen}/invitacion/${codigo}`;
  const pagina = `${origen}/e/${empresa}`;

  const copiar = async (texto: string, clave: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado((c) => (c === clave ? null : c)), 2500);
    } catch {
      setError("No se pudo copiar. Selecciona el enlace y cópialo a mano.");
    }
  };

  const invitar = async (tipo: "coach" | "admin" | "empresa") => {
    setCreando(tipo);
    setError(null);
    try {
      const nueva = await api<InvitacionVista>("/api/invitaciones", {
        method: "POST",
        json: tipo === "empresa" ? { tipo, nombreEmpresa } : { tipo: "coach", rol: tipo },
      });
      if (tipo === "empresa") setNombreEmpresa("");
      cargar();
      void copiar(enlaceDe(nueva.codigo), nueva.codigo);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreando(null);
    }
  };

  const cancelar = async (codigo: string) => {
    setError(null);
    try {
      await api(`/api/invitaciones?codigo=${encodeURIComponent(codigo)}`, { method: "DELETE" });
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Cambios en el equipo: rol, quitar o pasarle la empresa.
  const alEquipo = async (pedido: () => Promise<unknown>) => {
    setError(null);
    try {
      await pedido();
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const cambiarRol = (m: Miembro, rol: "admin" | "coach") =>
    alEquipo(() => api("/api/coach/equipo", { method: "PATCH", json: { correo: m.correo, rol } }));
  const quitar = (m: Miembro) => {
    if (!window.confirm(`¿Quitar a ${m.nombre} del equipo? Su cuenta sigue, pero ya no entra como parte de la empresa.`)) return;
    void alEquipo(() => api(`/api/coach/equipo?correo=${encodeURIComponent(m.correo)}`, { method: "DELETE" }));
  };
  const pasarEmpresa = (m: Miembro) => {
    if (!window.confirm(`¿Pasarle la empresa a ${m.nombre}? Será el nuevo dueño y tú te quedas como administrador.`)) return;
    // Tu rol cambia: se recarga para que toda la página lo refleje.
    void alEquipo(async () => {
      await api("/api/coach/equipo", { method: "POST", json: { correo: m.correo } });
      window.location.reload();
    });
  };

  const restablecer = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setTemporal(null);
    try {
      setTemporal(await api("/api/cuentas/restablecer", { method: "POST", json: { correo: correoOlvido } }));
      setCorreoOlvido("");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const lista = (tipo: "coach" | "empresa") => {
    const suyas = datos?.invitaciones.filter((i) => i.tipo === tipo) ?? [];
    if (suyas.length === 0) return null;
    return (
      <ul className="invitaciones-lista">
        {suyas.map((i) => (
          <li key={i.codigo}>
            <span className="invitaciones-texto">
              <code className="enlace-copiable">{enlaceDe(i.codigo)}</code>
              <span className="nota">
                {i.tipo === "coach" ? `Para ${NOMBRE_ROL[i.rol].toLowerCase()} · ` : i.nombreEmpresa ? `${i.nombreEmpresa} · ` : ""}
                Sin usar · vence el {fechaCorta(i.venceEn)}
              </span>
            </span>
            <span className="invitaciones-acciones">
              <button type="button" className="boton boton-chico boton-fantasma-borde" onClick={() => void copiar(enlaceDe(i.codigo), i.codigo)}>
                <IconoCopiar width={15} height={15} /> {copiado === i.codigo ? "Copiado" : "Copiar"}
              </button>
              <button type="button" className="enlace enlace-discreto" onClick={() => void cancelar(i.codigo)}>
                Cancelar
              </button>
            </span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="equipo-empresa">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="tarjeta" aria-labelledby="pagina-empresa-titulo">
        <h2 id="pagina-empresa-titulo">La página de tu empresa</h2>
        <p className="texto-suave">
          Compártela con tus alumnos: muestra tus comunidades con tu marca y desde ahí entran o crean su cuenta.
        </p>
        <div className="enlace-fila">
          <code className="enlace-copiable">{pagina}</code>
          <button type="button" className="boton boton-chico boton-fantasma-borde" onClick={() => void copiar(pagina, "pagina")}>
            <IconoCopiar width={15} height={15} /> {copiado === "pagina" ? "Copiado" : "Copiar"}
          </button>
          <Link href={`/e/${empresa}`} className="enlace">
            <IconoEnlace width={15} height={15} /> Abrir
          </Link>
        </div>
      </section>

      <section className="tarjeta" aria-labelledby="equipo-titulo">
        <h2 id="equipo-titulo">Equipo</h2>
        <p className="texto-suave">
          Todo el equipo ve y edita las comunidades y los cursos, ve a los alumnos y los pagos, y modera. El dueño y los
          administradores, además, manejan el equipo y la marca.
        </p>
        {!datos ? (
          <p className="texto-suave">Cargando tu equipo…</p>
        ) : (
          <ul className="equipo-lista">
            {datos.equipo.map((m) => {
              const yo = m.nombre === usuario?.nombre;
              const editable = administra && !yo && m.rolEmpresa !== "dueno";
              return (
                <li key={m.correo}>
                  <Avatar nombre={m.nombre} tamaño={32} coach />
                  <span className="equipo-datos">
                    <span className="equipo-nombre">
                      {m.nombre}
                      {yo && <span className="texto-suave"> (tú)</span>}
                    </span>
                    <span className="nota">{m.correo}</span>
                  </span>
                  {editable ? (
                    <span className="equipo-acciones">
                      <label className="sr-only" htmlFor={`rol-${m.correo}`}>
                        Rol de {m.nombre}
                      </label>
                      <select
                        id={`rol-${m.correo}`}
                        className="equipo-rol"
                        value={m.rolEmpresa}
                        onChange={(e) => void cambiarRol(m, e.target.value as "admin" | "coach")}
                      >
                        <option value="admin">Administrador</option>
                        <option value="coach">Coach</option>
                      </select>
                      {soyDueno && (
                        <button type="button" className="enlace enlace-discreto" onClick={() => pasarEmpresa(m)}>
                          Pasarle la empresa
                        </button>
                      )}
                      <button type="button" className="enlace enlace-discreto" onClick={() => quitar(m)}>
                        Quitar
                      </button>
                    </span>
                  ) : (
                    <span className="pastilla">{NOMBRE_ROL[m.rolEmpresa]}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {administra ? (
          <div className="equipo-invitar">
            <h3>Invitar al equipo</h3>
            <p className="texto-suave">
              Crea un enlace y mándalo por WhatsApp o por correo. Sirve una sola vez y dura 14 días: quien lo abre crea su
              cuenta y entra a tu empresa con ese rol.
            </p>
            <div className="equipo-botones">
              <button type="button" className="boton boton-secundario" onClick={() => void invitar("coach")} disabled={creando !== null}>
                <IconoInvitar width={17} height={17} /> {creando === "coach" ? "Creando…" : "Invitar coach"}
              </button>
              <button type="button" className="boton boton-fantasma-borde" onClick={() => void invitar("admin")} disabled={creando !== null}>
                <IconoInvitar width={17} height={17} /> {creando === "admin" ? "Creando…" : "Invitar administrador"}
              </button>
            </div>
            {lista("coach")}
          </div>
        ) : (
          <p className="nota">Para sumar a alguien al equipo, pídeselo al dueño o a un administrador de tu empresa.</p>
        )}
      </section>

      {esEquipoMerkatics && (
        <section className="tarjeta" aria-labelledby="merkatics-titulo">
          <h2 id="merkatics-titulo">Equipo de Merkatics</h2>
          <div className="equipo-invitar">
            <h3>Empresas registradas</h3>
            <p className="texto-suave">
              Todas las empresas de la plataforma y su plan. Modo demostración: se activan al registrarse con 7 días
              gratis y los pagos son simulados.
            </p>
            {!empresas ? (
              <p className="texto-suave">Cargando empresas…</p>
            ) : (
              <div className="tabla-desplazable">
                <table className="tabla-pagos tabla-empresas">
                  <thead>
                    <tr>
                      <th>Empresa</th>
                      <th>Dueño</th>
                      <th>Equipo</th>
                      <th>Comunidades</th>
                      <th>Cursos</th>
                      <th>Plan</th>
                      <th>Registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empresas.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <Link href={`/e/${e.id}`}>{e.nombre}</Link>
                          {e.giro && <span className="nota"> · {e.giro}</span>}
                        </td>
                        <td>{e.dueno}</td>
                        <td className="numero">{e.equipo}</td>
                        <td className="numero">{e.comunidades}</td>
                        <td className="numero">{e.cursos}</td>
                        <td>
                          {e.plan
                            ? `${ESTADO_PLAN[e.plan.estado]}${e.plan.cancelado && e.plan.estado !== "cancelado" ? " (cancelará)" : ""}`
                            : "Sin cobro"}
                        </td>
                        <td>{fechaCorta(e.creadaEn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="equipo-invitar">
            <h3>Invitar a alguien a abrir su empresa</h3>
            <p className="texto-suave">
              Cualquiera puede registrar su empresa en «Registra tu empresa». Si prefieres mandarle un enlace, quien lo
              abre crea su cuenta y queda como dueño de una empresa nueva.
            </p>
            <form
              className="equipo-forma"
              onSubmit={(e) => {
                e.preventDefault();
                void invitar("empresa");
              }}
            >
              <label className="campo">
                <span>Nombre de la empresa (opcional; el dueño lo puede cambiar)</span>
                <input value={nombreEmpresa} onChange={(e) => setNombreEmpresa(e.target.value)} maxLength={60} />
              </label>
              <button type="submit" className="boton boton-secundario" disabled={creando !== null}>
                <IconoInvitar width={17} height={17} /> {creando === "empresa" ? "Creando…" : "Crear enlace"}
              </button>
            </form>
            {lista("empresa")}
          </div>
          <div className="equipo-invitar">
            <h3>Restablecer una contraseña</h3>
            <p className="texto-suave">
              Si alguien olvidó la suya, escribe su correo: se le pone una contraseña temporal que solo se muestra aquí, una
              vez. Dásela y pídele que la cambie en su perfil.
            </p>
            <form className="equipo-forma" onSubmit={restablecer}>
              <label className="campo">
                <span>Correo de la cuenta</span>
                <input type="email" value={correoOlvido} onChange={(e) => setCorreoOlvido(e.target.value)} />
              </label>
              <button type="submit" className="boton boton-secundario" disabled={!correoOlvido.trim()}>
                Dar contraseña temporal
              </button>
            </form>
            {temporal && (
              <p className="aviso-entrada" role="status">
                Contraseña temporal de {temporal.nombre} ({temporal.correo}): <code>{temporal.contrasena}</code>
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
