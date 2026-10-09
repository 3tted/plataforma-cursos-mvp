import { cargarCursos, resumenDe } from "@/lib/curso";
import { manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

// Los cursos de la comunidad, en ficha corta, para elegir cuál tomar.
export const GET = manejar(async () => Response.json((await cargarCursos()).map(resumenDe)));
