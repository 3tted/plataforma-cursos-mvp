// Directorio de comunidades de la plataforma. Finanzas Claras (dos cursos) y
// Vende por WhatsApp (un curso) funcionan: sus datos viven en data/curso.json
// y data/cursos/*.json. Las demás son ejemplos para enseñar cómo crece el
// directorio cuando haya más coaches; son ficticias, igual que las reales, y
// no se puede entrar a ellas. En la Fase 2 este listado sale de la base de
// datos multiempresa.

export interface ComunidadDirectorio {
  id: string;
  nombre: string;
  coach: string;
  tema: string;
  descripcion: string;
  curso: string;
  // Tamaño del curso de ejemplo. La comunidad activa los toma de data/curso.json.
  lecciones?: number;
  minutos?: number;
  estado: "activa" | "proximamente";
}

/** El tema de una comunidad (para su portada ilustrada). */
export function temaDe(id: string): string {
  return COMUNIDADES.find((c) => c.id === id)?.tema ?? "Finanzas";
}

export const COMUNIDADES: ComunidadDirectorio[] = [
  {
    id: "finanzas-claras",
    nombre: "Finanzas Claras",
    coach: "Daniela Ortega",
    tema: "Finanzas",
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
    estado: "activa",
  },
  {
    id: "marca-que-se-recuerda",
    nombre: "Marca que se Recuerda",
    coach: "Rodrigo Salinas",
    tema: "Marketing",
    descripcion: "Fotos, redes y una voz propia para que tu negocio se distinga en tu colonia y en internet.",
    curso: "Tu marca en 30 días",
    lecciones: 7,
    minutos: 65,
    estado: "proximamente",
  },
  {
    id: "semana-en-orden",
    nombre: "Semana en Orden",
    coach: "Andrea Vidal",
    tema: "Productividad",
    descripcion: "Para quien atiende el negocio, la casa y los pendientes a la vez: planea tu semana en 20 minutos y cúmplela.",
    curso: "Organiza tu semana",
    lecciones: 5,
    minutos: 37,
    estado: "proximamente",
  },
  {
    id: "fotos-que-venden",
    nombre: "Fotos que Venden",
    coach: "Sofía Ríos",
    tema: "Diseño",
    descripcion: "Luz, fondo y encuadre para que tus productos se vean profesionales con el celular que ya tienes.",
    curso: "Fotos de producto con tu celular",
    lecciones: 8,
    minutos: 70,
    estado: "proximamente",
  },
  {
    id: "equipo-que-funciona",
    nombre: "Equipo que Funciona",
    coach: "Ricardo Lara",
    tema: "Liderazgo",
    descripcion: "Contratar, enseñar y delegar sin que el negocio dependa de ti para todo. Pensada para tu primer empleado.",
    curso: "Contrata a tu primer empleado",
    lecciones: 6,
    minutos: 51,
    estado: "proximamente",
  },
];
