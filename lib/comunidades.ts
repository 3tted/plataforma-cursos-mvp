// Directorio de comunidades de la plataforma. En el MVP solo Finanzas Claras
// funciona (sus datos viven en data/curso.json); las demás son ejemplos que se
// muestran como "Próximamente" para enseñar cómo crece el panel cuando haya
// más coaches. Son ficticias, igual que Finanzas Claras, y no se puede entrar
// a ellas. En la Fase 2 este listado sale de la base de datos multiempresa.

export interface ComunidadDirectorio {
  id: string;
  nombre: string;
  coach: string;
  tema: string;
  descripcion: string;
  curso: string;
  estado: "activa" | "proximamente";
}

export const COMUNIDADES: ComunidadDirectorio[] = [
  {
    id: "finanzas-claras",
    nombre: "Finanzas Claras",
    coach: "Daniela Ortega",
    tema: "Finanzas para tu negocio",
    descripcion: "Para dueñas y dueños de pequeños negocios que quieren entender sus números sin volverse contadores.",
    curso: "Finanzas claras para tu negocio",
    estado: "activa",
  },
  {
    id: "vende-por-whatsapp",
    nombre: "Vende por WhatsApp",
    coach: "Mariana Ibarra",
    tema: "Ventas",
    descripcion: "Catálogo, mensajes y seguimiento para vender más desde el teléfono, sin perseguir a tus clientes.",
    curso: "De la conversación a la venta",
    estado: "proximamente",
  },
  {
    id: "marca-que-se-recuerda",
    nombre: "Marca que se Recuerda",
    coach: "Rodrigo Salinas",
    tema: "Marketing",
    descripcion: "Fotos, redes y una voz propia para que tu negocio se distinga en tu colonia y en internet.",
    curso: "Tu marca en 30 días",
    estado: "proximamente",
  },
];
