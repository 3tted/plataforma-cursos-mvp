import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Oculta la "N" de desarrollo de Next.js para que no estorbe en las demos;
  // los errores de compilación se siguen mostrando.
  devIndicators: false,
  // Las rutas de la API leen el curso desde /data; esto asegura que esos
  // archivos viajen con el despliegue (por ejemplo, en Vercel).
  outputFileTracingIncludes: {
    "/api/**/*": ["./data/**/*"],
  },
};

export default nextConfig;
