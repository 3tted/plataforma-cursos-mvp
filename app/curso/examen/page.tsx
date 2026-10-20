"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useApp } from "@/components/Contexto";
import {
  IconoAprobado,
  IconoBillete,
  IconoCandado,
  IconoComunidad,
  IconoFlechaIzq,
  IconoReintentar,
} from "@/components/Iconos";
import PreguntaOpciones from "@/components/PreguntaOpciones";
import { useEvaluaciones } from "@/components/useEvaluaciones";
import { useTitulo } from "@/components/useTitulo";
import { api, moneda } from "@/lib/cliente";
import type { Expediente, ResultadoExamen } from "@/lib/tipos";

export default function PaginaExamen() {
  const router = useRouter();
  const { usuario, datos, lecciones, completadas, tieneAcceso, setBorrador, cursoId, coachAqui, comunidadId } = useApp();
  const evaluaciones = useEvaluaciones();
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [respuestas, setRespuestas] = useState<(number | null)[]>([]);
  const [resultado, setResultado] = useState<ResultadoExamen | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useTitulo("Examen final");

  const esCoach = coachAqui;
  const cargarExpediente = useCallback(() => {
    if (!usuario || usuario.rol !== "alumno") return;
    api<Expediente>(`/api/expediente?curso=${encodeURIComponent(cursoId)}`)
      .then(setExpediente)
      .catch(() => setError("No pudimos cargar tu avance. Revisa tu conexión y recarga la página."));
  }, [usuario, cursoId]);

  useEffect(cargarExpediente, [cargarExpediente]);

  // Cada curso tiene su examen: al cambiar de curso se empieza en blanco.
  useEffect(() => {
    setExpediente(null);
    setRespuestas([]);
    setResultado(null);
  }, [cursoId]);

  if (!usuario) return null;
  if (!evaluaciones || !datos || (!esCoach && !expediente && !error)) {
    return <p className="texto-suave">Cargando examen…</p>;
  }

  const { examenFinal, aprobarCon, intentosExamen } = evaluaciones;
  const preguntas = examenFinal.preguntas;
  const base = lecciones.filter((l) => !l.deCoach);
  const faltan = base.filter((l) => !completadas.includes(l.id));
  const intentos = resultado?.intentosUsados || expediente?.examen.intentos || 0;
  const respondidas = preguntas.filter((_, i) => respuestas[i] != null).length;
  const tituloDe = (id: string) => lecciones.find((l) => l.id === id)?.titulo ?? id;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await api<ResultadoExamen>("/api/examen", {
        method: "POST",
        json: { respuestas, curso: cursoId },
      });
      setResultado(r);
      cargarExpediente();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof TypeError ? "No pudimos enviar tu examen. Revisa tu conexión." : (err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const otraVez = () => {
    setRespuestas([]);
    setResultado(null);
    window.scrollTo({ top: 0 });
  };

  const compartirLogro = () => {
    setBorrador({
      categoria: "Logros",
      titulo: `Aprobé «${datos.curso.titulo}»`,
      cuerpo: "Lo que más me sirvió del curso fue…",
    });
    router.push(`/c/${comunidadId}`);
  };

  const cabecera = (
    <header className="portada examen-portada">
      <Link href="/curso" className="volver">
        <IconoFlechaIzq width={16} height={16} /> Todo el curso
      </Link>
      <h1>Examen final</h1>
      <p className="portada-texto">{datos.curso.titulo}</p>
      <ul className="examen-reglas" aria-label="Reglas del examen">
        <li>
          <span className="cifra">{preguntas.length}</span> preguntas
        </li>
        <li>
          Apruebas con <span className="cifra">{aprobarCon}%</span>
        </li>
        <li>
          {esCoach ? (
            "Vista previa: no se guarda"
          ) : (
            <>
              Intento <span className="cifra">{Math.min(intentos + (resultado ? 0 : 1), intentosExamen)}</span> de{" "}
              <span className="cifra">{intentosExamen}</span>
            </>
          )}
        </li>
      </ul>
    </header>
  );

  // Resultado del intento que se acaba de enviar.
  if (resultado) {
    const restantes = resultado.intentosMaximos - resultado.intentosUsados;
    return (
      <div className="pagina-examen">
        {cabecera}
        <section className="tarjeta examen-resultado" data-aprobado={resultado.aprobado} role="status">
          <div className="examen-calificacion">
            <span className="examen-puntaje cifra">{resultado.puntaje}%</span>
            <span className="texto-suave">
              <span className="cifra">
                {resultado.aciertos} de {resultado.total}
              </span>{" "}
              correctas
            </span>
          </div>
          <div className="examen-resultado-textos">
            {resultado.aprobado ? (
              <>
                <h2>
                  <IconoAprobado width={24} height={24} /> Aprobaste el curso
                </h2>
                <p>Ya aparece en tu expediente y tu coach lo ve en su panel.</p>
              </>
            ) : (
              <>
                <h2>{resultado.puntaje >= aprobarCon - 20 ? "Te faltó poco" : "Todavía no lo apruebas"}</h2>
                <p>
                  Necesitas {aprobarCon}%.{" "}
                  {resultado.vistaPrevia
                    ? "Es una vista previa: este intento no se guardó."
                    : restantes > 0
                      ? `Te ${restantes === 1 ? "queda 1 intento" : `quedan ${restantes} intentos`}.`
                      : "Ya no te quedan intentos: tu coach lo verá en su panel para ayudarte a repasar."}
                </p>
              </>
            )}
            {resultado.vistaPrevia && resultado.aprobado && (
              <p className="nota">Vista previa de la coach: este intento no se guardó.</p>
            )}
          </div>

          {resultado.repasar.length > 0 && (
            <div className="examen-repasar">
              <h3>Conviene repasar</h3>
              <ul>
                {resultado.repasar.map((id) => (
                  <li key={id}>
                    <Link href={`/curso/${id}`}>
                      <span className="cita-id">{id}</span> {tituloDe(id)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="fila-acciones examen-acciones">
            {resultado.aprobado && !resultado.vistaPrevia && (
              <>
                <button type="button" className="boton" onClick={compartirLogro}>
                  <IconoComunidad width={16} height={16} /> Compartir mi logro
                </button>
                <Link href="/perfil" className="boton boton-secundario">
                  Ver mi expediente
                </Link>
              </>
            )}
            {(resultado.vistaPrevia || (!resultado.aprobado && restantes > 0)) && (
              <button type="button" className="boton boton-secundario" onClick={otraVez}>
                <IconoReintentar width={16} height={16} /> Intentar de nuevo
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  // Un alumno que todavía no termina las lecciones.
  if (!esCoach && faltan.length > 0) {
    const bloqueadas = faltan.some((l) => !l.gratis) && !tieneAcceso;
    return (
      <div className="pagina-examen">
        {cabecera}
        <section className="tarjeta examen-bloqueado">
          <span className="bloqueo-icono">
            <IconoCandado width={22} height={22} />
          </span>
          <h2>Se desbloquea al terminar el curso</h2>
          <p className="texto-suave">
            Llevas{" "}
            <span className="cifra">
              {base.length - faltan.length} de {base.length}
            </span>{" "}
            lecciones. Te faltan:
          </p>
          <ul className="examen-faltan">
            {faltan.map((l) => (
              <li key={l.id}>
                <Link href={`/curso/${l.id}`}>
                  <span className="cita-id">{l.id}</span> {l.titulo}
                </Link>
                {!l.gratis && !tieneAcceso && (
                  <>
                    <IconoBillete width={14} height={14} />
                    <span className="sr-only"> (con membresía)</span>
                  </>
                )}
              </li>
            ))}
          </ul>
          {bloqueadas && (
            <Link href="/membresia" className="boton">
              Activar membresía por {moneda(datos.comunidad.precio_mensual)} al mes
            </Link>
          )}
        </section>
      </div>
    );
  }

  // Ya aprobado o sin intentos: se muestra el resultado guardado.
  if (!esCoach && expediente && (expediente.examen.aprobado || expediente.examen.intentos >= intentosExamen)) {
    const { examen } = expediente;
    return (
      <div className="pagina-examen">
        {cabecera}
        <section className="tarjeta examen-resultado" data-aprobado={examen.aprobado}>
          <div className="examen-calificacion">
            <span className="examen-puntaje cifra">{examen.mejorPuntaje ?? 0}%</span>
            <span className="texto-suave">tu mejor calificación</span>
          </div>
          <div className="examen-resultado-textos">
            {examen.aprobado ? (
              <>
                <h2>
                  <IconoAprobado width={24} height={24} /> Ya aprobaste este curso
                </h2>
                {examen.aprobadoEn && (
                  <p>
                    Lo aprobaste el{" "}
                    {new Date(examen.aprobadoEn).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}.
                  </p>
                )}
              </>
            ) : (
              <>
                <h2>Usaste tus {intentosExamen} intentos</h2>
                <p>Tu coach lo ve en su panel. Repasa las lecciones y pídele apoyo en la comunidad.</p>
              </>
            )}
          </div>
          <div className="fila-acciones examen-acciones">
            {examen.aprobado ? (
              <button type="button" className="boton" onClick={compartirLogro}>
                <IconoComunidad width={16} height={16} /> Compartir mi logro
              </button>
            ) : (
              <Link href={`/c/${comunidadId}`} className="boton">
                Ir a la comunidad
              </Link>
            )}
            <Link href="/perfil" className="boton boton-secundario">
              Ver mi expediente
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="pagina-examen">
      {cabecera}
      {esCoach && (
        <p className="aviso">
          <span>
            <strong>Vista previa de la coach.</strong> Puedes presentarlo para revisarlo; tus respuestas no se guardan ni
            cuentan en la matriz de alumnos.
          </span>
        </p>
      )}
      <form className="examen-formulario" onSubmit={enviar}>
        <ol className="examen-preguntas">
          {preguntas.map((p, i) => (
            <li key={p.id} className="tarjeta">
              <PreguntaOpciones
                numero={i + 1}
                pregunta={p}
                elegida={respuestas[i] ?? null}
                alElegir={(opcion) => setRespuestas((r) => Object.assign([...r], { [i]: opcion }))}
                deshabilitada={enviando}
              />
            </li>
          ))}
        </ol>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="examen-envio">
          <span className="texto-suave">
            Respondidas{" "}
            <span className="cifra">
              {respondidas} de {preguntas.length}
            </span>
          </span>
          <button type="submit" className="boton" disabled={respondidas < preguntas.length || enviando}>
            {enviando ? "Calificando…" : "Enviar examen"}
          </button>
        </div>
      </form>
    </div>
  );
}
