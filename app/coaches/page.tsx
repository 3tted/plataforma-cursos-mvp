import { redirect } from "next/navigation";

// La dirección de antes ("Para coaches") lleva a registrar una empresa.
export default function IrARegistro() {
  redirect("/registra-tu-empresa");
}
