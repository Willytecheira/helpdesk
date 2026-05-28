import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Standalone build para imagen Docker liviana
  output: "standalone",
  // pdfkit lee sus fuentes (.afm) desde el filesystem; no debe ser bundleado.
  serverExternalPackages: ["pdfkit"],
  // El agente sube archivos grandes; aflojamos el límite de body actions
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
  },
  // Incluir los assets de pdfkit en el output standalone para producción
  outputFileTracingIncludes: {
    "/api/reports/monthly": ["./node_modules/pdfkit/js/data/**/*"],
  },
}

export default nextConfig
