import { modificar } from "@/lib/almacen";
import { idNumerico, manejar } from "@/lib/http";

export const DELETE = manejar(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const id = idNumerico((await params).id);
    await modificar((a) => {
      a.leccionesCoach = a.leccionesCoach.filter((l) => l.id !== id);
    });
    return new Response(null, { status: 204 });
  },
);
