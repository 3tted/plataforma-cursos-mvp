// Comunidades que viajan con la plataforma (de la empresa Merkatics):
// Finanzas Claras (dos cursos) y Vende por WhatsApp (un curso). Sus datos
// viven en data/curso.json y data/cursos/*.json. Las que crean las coaches se
// suman desde el almacén (ver /api/comunidades).

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
  /** Foto de portada que subió la coach. */
  foto?: string;
  /** Empresa dueña; sin el dato, la de Merkatics. */
  empresa?: string;
}

/** Temas para elegir al crear una comunidad (cada uno tiene su portada ilustrada). */
export const TEMAS = ["Finanzas", "Ventas", "Marketing", "Productividad", "Diseño", "Liderazgo", "Otro"];

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
];
