"use client";

import { useRouter } from "next/navigation";
import { COMUNIDADES } from "@/lib/comunidades";
import Arcos from "./Arcos";
import { useApp } from "./Contexto";
import { IconoAsistente, IconoAsistenteGeneral, IconoBillete, IconoComunidad, IconoCurso, IconoFlechaDer } from "./Iconos";
import TarjetaComunidad from "./TarjetaComunidad";

const FUNCIONES = [
  { Icono: IconoCurso, titulo: "Cursos", texto: "Lecciones con video, repasos y un examen final. Avanzas a tu ritmo." },
  { Icono: IconoComunidad, titulo: "Comunidad", texto: "Pregunta, comparte tus logros y aprende con otros alumnos y tu coach." },
  {
    Icono: IconoAsistenteGeneral,
    titulo: "Asistente de IA",
    texto: "Resuelve tus dudas al momento y te dice de qué lección sale la respuesta.",
  },
  { Icono: IconoBillete, titulo: "Pagos en pesos", texto: "Paga tu membresía en OXXO, por transferencia SPEI o con Mercado Pago." },
];

// Página para quien todavía no entra: qué es la plataforma, qué puede hacer,
// qué comunidades hay y una invitación para coaches. Sus botones abren la
// entrada (sin contraseña).
export default function PaginaVisitantes() {
  const router = useRouter();
  const { pedirEntrada, cambiarComunidad } = useApp();
  const abiertas = COMUNIDADES.filter((c) => c.estado === "activa");

  // Elegir una comunidad: después de entrar, la persona llega a ella.
  const elegirComunidad = (id: string) => {
    cambiarComunidad(id);
    router.push("/comunidad");
    pedirEntrada("alumno");
  };

  return (
    <div className="visitantes" data-app-fondo>
      <header className="visitantes-barra">
        <div className="envoltura visitantes-barra-interior">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="marca-logo" src="/merkatics-logo.png" alt="Merkatics Growth Operating System" width={2311} height={544} />
          <nav className="visitantes-nav" aria-label="Secciones">
            <a href="#funciones">Qué puedes hacer</a>
            <a href="#comunidades">Comunidades</a>
            <a href="#coaches">Para coaches</a>
          </nav>
          <div className="visitantes-cuenta">
            <button type="button" className="boton boton-chico boton-fantasma" onClick={() => pedirEntrada()}>
              Iniciar sesión
            </button>
            <button type="button" className="boton boton-chico" onClick={() => pedirEntrada("alumno")}>
              Crear cuenta
            </button>
          </div>
        </div>
      </header>

      <main id="contenido" className="envoltura visitantes-contenido">
        <section className="visitantes-hero" aria-labelledby="visitantes-titulo">
          <div className="visitantes-hero-texto">
            <h1 id="visitantes-titulo">Aprende, pregunta y avanza en un solo lugar.</h1>
            <p>
              Cursos y comunidades en español, con pagos en OXXO, SPEI o Mercado Pago, y un asistente de IA que responde con
              el contenido de tus lecciones.
            </p>
            <div className="visitantes-acciones">
              <a href="#comunidades" className="boton">
                Explorar comunidades <IconoFlechaDer width={16} height={16} />
              </a>
              <a href="#coaches" className="boton boton-fantasma">
                Soy coach
              </a>
            </div>
          </div>
          <div className="visitantes-hero-visual" aria-hidden="true">
            <Arcos />
            <div className="visitantes-chat">
              <p className="visitantes-chat-cabecera">
                <IconoAsistente width={16} height={16} /> Asistente del curso
              </p>
              <p className="visitantes-burbuja visitantes-burbuja-yo">¿Cuánto me conviene pagarme de sueldo?</p>
              <div className="visitantes-burbuja visitantes-burbuja-ia">
                <p>
                  Empieza con <strong>entre 50% y 60%</strong> de tu utilidad promedio de los últimos tres meses, y
                  págatelo en dos quincenas.
                </p>
                <p className="visitantes-fuente">
                  Fuente: <span className="cita-id">L2</span> Págate un sueldo
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="funciones" className="visitantes-seccion" aria-labelledby="funciones-titulo">
          <h2 id="funciones-titulo">¿Qué puedes hacer aquí?</h2>
          <ul className="visitantes-funciones">
            {FUNCIONES.map(({ Icono, titulo, texto }) => (
              <li key={titulo}>
                <span className="visitantes-funcion-icono">
                  <Icono width={22} height={22} />
                </span>
                <h3>{titulo}</h3>
                <p className="texto-suave">{texto}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="comunidades" className="visitantes-seccion" aria-labelledby="comunidades-titulo">
          <div className="visitantes-seccion-cabecera">
            <h2 id="comunidades-titulo">Comunidades abiertas</h2>
            <p className="texto-suave">Entra gratis: el módulo 1 de cada curso no cuesta nada.</p>
          </div>
          <ul className="proximas-lista">
            {abiertas.map((c) => (
              <TarjetaComunidad key={c.id} comunidad={c} alElegir={elegirComunidad} />
            ))}
          </ul>
        </section>

        <section id="coaches" className="visitantes-coach" aria-labelledby="coaches-titulo">
          <div>
            <h2 id="coaches-titulo">¿Eres coach o consultor?</h2>
            <p>Vende tus cursos, reúne a tus alumnos y deja que el asistente responda sus dudas con tu propio contenido.</p>
          </div>
          <ul className="visitantes-coach-lista">
            <li>Tu comunidad y tus cursos en un solo lugar</li>
            <li>Cobros en pesos, sin depender de tarjeta</li>
            <li>Ves quién aprobó y qué temas cuestan más</li>
          </ul>
          <button type="button" className="boton" onClick={() => pedirEntrada("coach")}>
            Quiero vender mis cursos
          </button>
        </section>
      </main>

      <footer className="visitantes-pie">
        <div className="envoltura visitantes-pie-interior">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="marca-logo" src="/merkatics-logo.png" alt="Merkatics" width={2311} height={544} />
          <span className="texto-suave">© 2026 Merkatics Growth Operating System</span>
        </div>
      </footer>
    </div>
  );
}
