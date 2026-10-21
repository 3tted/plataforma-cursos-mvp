"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Arcos from "./Arcos";
import { useApp } from "./Contexto";
import {
  IconoAsistente,
  IconoAsistenteGeneral,
  IconoBillete,
  IconoCerrar,
  IconoComunidad,
  IconoCurso,
  IconoFlechaDer,
  IconoMenu,
} from "./Iconos";
import PiePagina from "./PiePagina";
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
  const { pedirEntrada, comunidades } = useApp();
  const abiertas = comunidades.filter((c) => c.estado === "activa");

  // Menú del celular: se cierra con Escape, al tocar fuera o al elegir algo.
  const [menu, setMenu] = useState(false);
  const barra = useRef<HTMLDivElement>(null);
  const botonMenu = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenu(false);
      botonMenu.current?.focus();
    };
    const fuera = (e: PointerEvent) => {
      if (!barra.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", fuera);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", fuera);
    };
  }, [menu]);
  const entrar = () => {
    setMenu(false);
    pedirEntrada();
  };

  return (
    <div className="visitantes" data-app-fondo>
      <header className="visitantes-barra">
        <div className="envoltura visitantes-barra-interior" ref={barra}>
          <a href="/" className="marca" aria-label="Merkatics, inicio" onClick={() => setMenu(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="marca-logo" src="/merkatics-logo.png" alt="" width={2311} height={544} />
          </a>
          <nav className="visitantes-nav" aria-label="Secciones">
            <a href="#funciones">Qué puedes hacer</a>
            <a href="#comunidades">Comunidades</a>
            <a href="#coaches">Para coaches</a>
          </nav>
          <div className="visitantes-cuenta">
            <button type="button" className="boton boton-chico" onClick={entrar}>
              Entrar
            </button>
            <button
              ref={botonMenu}
              type="button"
              className="boton-icono visitantes-menu-boton"
              aria-expanded={menu}
              aria-controls="menu-visitantes"
              aria-label={menu ? "Cerrar el menú" : "Abrir el menú"}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <IconoCerrar width={22} height={22} /> : <IconoMenu width={22} height={22} />}
            </button>
          </div>
          <nav id="menu-visitantes" className="visitantes-menu" aria-label="Menú" hidden={!menu}>
            <a href="#funciones" onClick={() => setMenu(false)}>
              Qué puedes hacer
            </a>
            <a href="#comunidades" onClick={() => setMenu(false)}>
              Comunidades
            </a>
            <a href="#coaches" onClick={() => setMenu(false)}>
              Para coaches
            </a>
            <button type="button" className="boton" onClick={entrar}>
              Entrar
            </button>
          </nav>
        </div>
      </header>

      <main id="contenido" className="envoltura visitantes-contenido">
        <section className="visitantes-hero" aria-labelledby="visitantes-titulo">
          <div className="visitantes-hero-texto">
            <h1 id="visitantes-titulo">
              Aprende, pregunta y avanza en <span className="palabra-clave">un solo lugar.</span>
            </h1>
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
            <p className="texto-suave">Únete gratis y toma el módulo 1 de cada curso.</p>
          </div>
          <ul className="proximas-lista">
            {abiertas.map((c) => (
              <TarjetaComunidad key={c.id} comunidad={c} />
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
          <Link href="/coaches" className="boton">
            Quiero vender mis cursos
          </Link>
        </section>
      </main>

      <PiePagina />
    </div>
  );
}
