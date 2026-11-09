import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Montserrat, Oswald, Playfair_Display } from "next/font/google";
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
// Letras que puede elegir una empresa para sus títulos (Mi empresa). No se
// precargan: solo se descargan en las páginas con esa marca.
const condensada = Oswald({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-condensada", display: "swap", preload: false });
const elegante = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-elegante", display: "swap", preload: false });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const DESCRIPCION =
  "Cursos, comunidad y asistente de IA en español, con pagos en OXXO, SPEI o Mercado Pago. Plataforma de Merkatics para coaches y sus alumnos.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
  // Cada ruta pone su título ("Comunidades", "Membresía"…) y aquí se le agrega la marca.
  title: { template: "%s · Merkatics", default: "Merkatics · Cursos y comunidades" },
  description: DESCRIPCION,
  // La imagen para compartir sale de app/opengraph-image.png y app/twitter-image.png.
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "Merkatics",
    title: "Merkatics · Cursos y comunidades",
    description: DESCRIPCION,
  },
  twitter: { card: "summary_large_image", title: "Merkatics · Cursos y comunidades", description: DESCRIPCION },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  // Siempre claro, también en navegadores en modo oscuro.
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${display.variable} ${cuerpo.variable} ${mono.variable} ${condensada.variable} ${elegante.variable}`}>
      <body>
        <ProveedorApp>
          <Marco>{children}</Marco>
          <Bienvenida />
        </ProveedorApp>
      </body>
    </html>
  );
}
