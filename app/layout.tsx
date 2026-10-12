import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Montserrat } from "next/font/google";
import Bienvenida from "@/components/Bienvenida";
import { ProveedorApp } from "@/components/Contexto";
import Marco from "@/components/Marco";
import "./globals.css";

// Tipografías del manual de marca de Merkatics: Montserrat para mandar
// (títulos, botones, etiquetas) e Inter para leer (lecciones, publicaciones,
// asistente). IBM Plex Mono queda para referencias y cifras de pago.
const display = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});
const cuerpo = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body", display: "swap" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
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
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${display.variable} ${cuerpo.variable} ${mono.variable}`}>
      <body>
        <ProveedorApp>
          <Marco>{children}</Marco>
          <Bienvenida />
        </ProveedorApp>
      </body>
    </html>
  );
}
