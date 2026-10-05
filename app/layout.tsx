import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Red_Hat_Display, Red_Hat_Text } from "next/font/google";
import Bienvenida from "@/components/Bienvenida";
import { ProveedorApp } from "@/components/Contexto";
import Encabezado from "@/components/Encabezado";
import "./globals.css";

// Hoja de tipografía "Cursos en línea" de Merkatics: Red Hat Display para
// mandar (títulos, botones, etiquetas) y Red Hat Text para leer (lecciones,
// publicaciones, asistente). Sustituyen a la Montreal Serial de la papelería,
// que es de pago; el logotipo conserva Futura Bold y Caros.
const display = Red_Hat_Display({ subsets: ["latin"], variable: "--fuente-display", display: "swap" });
const cuerpo = Red_Hat_Text({ subsets: ["latin"], variable: "--fuente-cuerpo", display: "swap" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--fuente-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Merkatics · Cursos y comunidades",
  description:
    "Prototipo de la plataforma de cursos y comunidad de Merkatics: comunidad, curso y asistente de IA en español con pagos locales.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  // Siempre claro, también en navegadores en modo oscuro.
  colorScheme: "light",
  themeColor: "#fefefd",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${display.variable} ${cuerpo.variable} ${mono.variable}`}>
      <body>
        <ProveedorApp>
          <a href="#contenido" className="saltar" data-app-fondo>
            Saltar al contenido
          </a>
          <Encabezado />
          <main id="contenido" tabIndex={-1} className="envoltura contenido" data-app-fondo>
            {children}
          </main>
          <footer className="envoltura pie" data-app-fondo>
            <span>
              <strong>Merkatics</strong> Growth Operating System
            </span>
          </footer>
          <Bienvenida />
        </ProveedorApp>
      </body>
    </html>
  );
}
