"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/components/Contexto";
import CodigoBarras from "@/components/CodigoBarras";
import { IconoCheck, IconoCopiar, IconoDescargar, IconoEnviar, IconoFlechaDer, IconoFlechaIzq } from "@/components/Iconos";
import { useTitulo } from "@/components/useTitulo";
import { agrupar, api, fechaCorta, moneda } from "@/lib/cliente";
import type { MetodoPago, Pago } from "@/lib/tipos";

// Flujo de pago SIMULADO. Ningún dato de pago real se pide ni se envía.

const METODOS: { id: MetodoPago; nombre: string; detalle: string }[] = [
  { id: "oxxo", nombre: "Efectivo en OXXO", detalle: "Pagas con una ficha en cualquier tienda." },
  { id: "spei", nombre: "Transferencia SPEI", detalle: "Transfiere desde la app de tu banco." },
  { id: "mercadopago", nombre: "Mercado Pago", detalle: "Tarjeta, saldo o meses sin intereses." },
];

function Copiar({ texto, que }: { texto: string; que: string }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button
      type="button"
      className="boton-icono boton-icono-chico"
      aria-label={hecho ? `${que} copiada` : `Copiar ${que}`}
      title={hecho ? "Copiado" : "Copiar"}
      onClick={() =>
        navigator.clipboard
          ?.writeText(texto)
          .then(() => {
            setHecho(true);
            setTimeout(() => setHecho(false), 1500);
          })
          .catch(() => undefined)
      }
    >
      {hecho ? <IconoCheck width={15} height={15} /> : <IconoCopiar width={15} height={15} />}
    </button>
  );
}

export default function PaginaMembresia() {
  const {
    datos,
    lecciones,
    usuario,
    membresia,
    activarMembresia,
    pagoPendiente: pago,
    guardarPagoPendiente,
    setPidiendoUsuario,
    leccionDeseada,
    guardarLeccionDeseada,
    comunidadId,
    cursosComunidad,
    coachAqui,
  } = useApp();
  const [metodo, setMetodo] = useState<MetodoPago>("oxxo");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [descartando, setDescartando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const tituloFicha = useRef<HTMLHeadingElement>(null);
  const fichaNueva = useRef(false);
  useTitulo(membresia ? "Tu membresía" : "Membresía");

  // La lección que trajo a la alumna hasta aquí (?leccion=L6) se recuerda para
  // regresarla a ella cuando el pago se confirme, aunque vaya antes a la tienda.
  useEffect(() => {
    const desde = new URLSearchParams(window.location.search).get("leccion");
    if (desde && /^[LPWKC]\d+$/.test(desde)) guardarLeccionDeseada(desde);
  }, [guardarLeccionDeseada]);

  // Al generar la ficha, el foco pasa a su título para que se anuncie.
  useEffect(() => {
    if (pago && fichaNueva.current) {
      fichaNueva.current = false;
      tituloFicha.current?.focus();
    }
  }, [pago]);

  const comunidad = datos?.comunidad;
  const precio = moneda(comunidad?.precio_mensual ?? 490);
  const destino =
    lecciones.find((l) => l.id === leccionDeseada && !l.gratis) ?? lecciones.find((l) => !l.gratis);

  const confirmar = async (p: Pago) => {
    setProcesando(true);
    setError(null);
    try {
      await api<Pago>(`/api/pagos/${p.id}/confirmar`, { method: "POST" });
      activarMembresia({ metodo: p.metodo, desde: new Date().toISOString() });
      guardarPagoPendiente(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcesando(false);
    }
  };

  const generar = async () => {
    if (!usuario) return setPidiendoUsuario(true);
    setProcesando(true);
    setError(null);
    try {
      const nuevo = await api<Pago>("/api/pagos", {
        method: "POST",
        json: { metodo, comunidad: comunidadId },
      });
      if (metodo === "mercadopago") {
        // Simula el viaje de ida y vuelta al checkout de Mercado Pago.
        await new Promise((r) => setTimeout(r, 1400));
        await confirmar(nuevo);
      } else {
        // La ficha se guarda: si la alumna sale a la tienda y vuelve, sigue aquí.
        fichaNueva.current = true;
        guardarPagoPendiente(nuevo);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProcesando(false);
    }
  };

  const cancelarMembresia = () => {
    activarMembresia(null);
    setCancelando(false);
  };

  if (coachAqui) {
    return (
      <div className="pagina-estrecha">
        <h1>Esta comunidad es de tu empresa</h1>
        <p className="texto-suave">
          Como coach tienes acceso completo a ella. Para probar el flujo de pago, entra con una cuenta de alumno.
        </p>
        <Link href={`/c/${comunidadId}`} className="boton boton-secundario">
          Volver a la comunidad
        </Link>
      </div>
    );
  }

  if (membresia) {
    return (
      <div className="pagina-estrecha">
        <div className="tarjeta exito">
          <span className="exito-icono">
            <IconoCheck width={26} height={26} />
          </span>
          <h1>Tu membresía está activa</h1>
          <p className="texto-suave">
            Pagada con {METODOS.find((m) => m.id === membresia.metodo)?.nombre} el {fechaCorta(membresia.desde)}. Ya
            tienes el curso completo y el asistente te responde con todas las lecciones.
          </p>
          <div className="fila-acciones fila-acciones-centro">
            {destino ? (
              <Link href={`/curso/${destino.id}`} className="boton" onClick={() => guardarLeccionDeseada(null)}>
                Seguir con {destino.titulo} <IconoFlechaDer width={16} height={16} />
              </Link>
            ) : (
              <Link href="/curso" className="boton">
                Ir al curso
              </Link>
            )}
          </div>
          <div className="cancelar-membresia">
            {cancelando ? (
              <span className="confirmacion" role="group" aria-label="Confirmar la cancelación">
                ¿Cancelar tu membresía? Pierdes el acceso a las lecciones con membresía.
                <button type="button" className="boton boton-chico" onClick={cancelarMembresia}>
                  Sí, cancelar
                </button>
                <button type="button" className="boton boton-chico boton-fantasma" onClick={() => setCancelando(false)}>
                  Conservarla
                </button>
              </span>
            ) : (
              <button type="button" className="enlace enlace-discreto" onClick={() => setCancelando(true)}>
                Cancelar membresía
              </button>
            )}
            <p className="nota">En la demostración, cancelar te regresa a la vista de alguien que todavía no paga.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pagina-membresia">
      <Link href={`/c/${comunidadId}`} className="volver">
        <IconoFlechaIzq width={16} height={16} /> Volver a la comunidad
      </Link>
      <header className="membresia-cabecera portada">
        <h1>Membresía de {comunidad?.nombre ?? "Finanzas Claras"}</h1>
        <p className="precio precio-grande">
          {precio} <span>MXN al mes</span>
        </p>
        <p className="portada-texto">Sin plazos forzosos: cancelas cuando quieras.</p>
      </header>

      <section className="tarjeta checkout" aria-labelledby="checkout-titulo">
        <div className="aviso aviso-demo">
          <strong>Modo demostración:</strong> no se cobra nada; la referencia y la CLABE son ficticias.
        </div>

        {!pago ? (
          <>
            <h2 id="checkout-titulo">¿Cómo quieres pagar?</h2>
            <div className="metodos" role="radiogroup" aria-label="Método de pago">
              {METODOS.map((m) => (
                <label key={m.id} className="metodo" data-activo={metodo === m.id}>
                  <input
                    type="radio"
                    name="metodo"
                    value={m.id}
                    checked={metodo === m.id}
                    onChange={() => setMetodo(m.id)}
                    aria-labelledby={`metodo-${m.id}`}
                    aria-describedby={`metodo-${m.id}-detalle`}
                  />
                  <span className="metodo-nombre" id={`metodo-${m.id}`}>
                    {m.nombre}
                  </span>
                  <span className="texto-suave" id={`metodo-${m.id}-detalle`}>
                    {m.detalle}
                  </span>
                </label>
              ))}
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button type="button" className="boton boton-bloque" onClick={generar} disabled={procesando}>
              {procesando ? (
                metodo === "mercadopago" ? (
                  "Conectando con Mercado Pago…"
                ) : (
                  "Generando…"
                )
              ) : metodo === "oxxo" ? (
                `Generar ficha de pago por ${precio}`
              ) : metodo === "spei" ? (
                "Ver datos para transferir"
              ) : (
                `Pagar ${precio} con Mercado Pago`
              )}
            </button>
          </>
        ) : (
          <div className="ficha">
            {pago.metodo === "oxxo" ? (
              <>
                <div className="ficha-titulo">
                  <h2 id="checkout-titulo" ref={tituloFicha} tabIndex={-1}>
                    Ficha de pago OXXO
                  </h2>
                  <span className="pastilla pastilla-pendiente">Pendiente de pago</span>
                </div>
                <dl className="ficha-datos">
                  <div>
                    <dt>Monto a pagar</dt>
                    <dd className="ficha-monto">{moneda(pago.monto)} MXN</dd>
                  </div>
                  <div>
                    <dt>Referencia</dt>
                    <dd className="ficha-referencia">
                      {agrupar(pago.referencia, 4)} <Copiar texto={pago.referencia} que="referencia" />
                    </dd>
                  </div>
                  {pago.venceEn && (
                    <div>
                      <dt>Vence</dt>
                      <dd className="cifra">{fechaCorta(pago.venceEn)}</dd>
                    </div>
                  )}
                </dl>
                <div className="ficha-codigo">
                  <CodigoBarras texto={pago.referencia} />
                  <span className="cifra">{agrupar(pago.referencia, 4)}</span>
                </div>
                <div className="ficha-compartir no-imprimir">
                  <button type="button" className="boton boton-chico boton-fantasma-borde" onClick={() => window.print()}>
                    <IconoDescargar width={16} height={16} /> Descargar ficha
                  </button>
                  <a
                    className="boton boton-chico boton-fantasma-borde"
                    href={`https://wa.me/?text=${encodeURIComponent(
                      [
                        `Ficha de pago OXXO · Membresía ${comunidad?.nombre ?? "Merkatics"}`,
                        `Monto: ${moneda(pago.monto)} MXN`,
                        `Referencia: ${agrupar(pago.referencia, 4)}`,
                        pago.venceEn ? `Vence: ${fechaCorta(pago.venceEn)}` : "",
                        "(Modo demostración: la referencia es ficticia)",
                      ]
                        .filter(Boolean)
                        .join("\n"),
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <IconoEnviar width={16} height={16} /> Compartir por WhatsApp
                  </a>
                </div>
                <ol className="pasos">
                  <li>Acude a cualquier tienda OXXO.</li>
                  <li>Indica en caja que quieres hacer un pago de servicio con referencia.</li>
                  <li>Dicta la referencia de arriba y paga el monto exacto en efectivo.</li>
                  <li>Tu membresía se activa sola cuando el pago se confirma: no tienes que mandar comprobante.</li>
                </ol>
              </>
            ) : (
              <>
                <div className="ficha-titulo">
                  <h2 id="checkout-titulo" ref={tituloFicha} tabIndex={-1}>
                    Datos para tu transferencia SPEI
                  </h2>
                  <span className="pastilla pastilla-pendiente">Pendiente de pago</span>
                </div>
                <dl className="ficha-datos">
                  <div>
                    <dt>Monto</dt>
                    <dd className="ficha-monto">{moneda(pago.monto)} MXN</dd>
                  </div>
                  <div>
                    <dt>CLABE (ficticia)</dt>
                    <dd className="ficha-referencia">
                      {agrupar(pago.clabe ?? "", 6)} <Copiar texto={pago.clabe ?? ""} que="CLABE" />
                    </dd>
                  </div>
                  <div>
                    <dt>Beneficiario</dt>
                    <dd>{comunidad?.nombre} (demo)</dd>
                  </div>
                  <div>
                    <dt>Referencia numérica</dt>
                    <dd className="ficha-referencia">
                      {pago.referencia} <Copiar texto={pago.referencia} que="referencia" />
                    </dd>
                  </div>
                </dl>
                <p className="texto-suave">
                  Escribe la referencia numérica en tu transferencia: así tu membresía se activa sola, sin mandar
                  comprobante.
                </p>
              </>
            )}

            <p className="nota">Puedes salir y volver: tu ficha se queda guardada aquí hasta que la pagues.</p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {descartando ? (
              <div className="confirmacion" role="group" aria-label="Confirmar que descartas la ficha">
                <span>
                  ¿Descartar esta ficha? Si ya pagaste con ella, no la descartes: tu pago se perdería de vista.
                </span>
                <button
                  type="button"
                  className="boton boton-chico"
                  onClick={() => {
                    guardarPagoPendiente(null);
                    setDescartando(false);
                  }}
                >
                  Descartar ficha
                </button>
                <button type="button" className="boton boton-chico boton-fantasma" onClick={() => setDescartando(false)}>
                  Conservarla
                </button>
              </div>
            ) : (
              <div className="fila-acciones">
                <button type="button" className="boton boton-fantasma" onClick={() => setDescartando(true)}>
                  Usar otro método
                </button>
                <button type="button" className="boton" onClick={() => confirmar(pago)} disabled={procesando}>
                  {pago.metodo === "oxxo" ? "Simular pago recibido" : "Simular transferencia recibida"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="plan" aria-labelledby="plan-titulo">
        <h2 id="plan-titulo" className="plan-titulo">
          Qué incluye
        </h2>
        <ul className="incluye">
          <li>
            <IconoCheck width={16} height={16} /> Todos los cursos de la comunidad ({cursosComunidad.length || "…"})
          </li>
          <li>
            <IconoCheck width={16} height={16} /> Comunidad con {comunidad?.coach ?? "tu coach"} y otros dueños de negocio
          </li>
          <li>
            <IconoCheck width={16} height={16} /> Asistente que responde tus dudas a cualquier hora, citando la lección
          </li>
          <li>
            <IconoCheck width={16} height={16} /> Cancelas cuando quieras, desde esta misma página
          </li>
        </ul>
        <h2 className="plan-titulo">Cómo se paga cada mes</h2>
        <p className="texto-suave">
          Con OXXO o SPEI no hay cargos automáticos: cada mes generas una ficha nueva desde aquí. Si un mes no la pagas,
          solo se pausa tu acceso a las lecciones con membresía.
        </p>
      </section>
    </div>
  );
}
