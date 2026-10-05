import { cargarCurso } from "@/lib/curso";
import { manejar } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = manejar(async () => Response.json(await cargarCurso()));
