"use client";

import { TEMAS } from "@/lib/comunidades";

export type FormaComunidad = {
  nombre: string;
  descripcion: string;
  acerca: string;
  tema: string;
  coach_titulo: string;
  /** Como texto, tal cual lo escribe la coach. */
  precio_mensual: string;
  /** Para que sus alumnos le agenden una sesión (opcionales). */
  whatsapp: string;
  agenda: string;
};

export const COMUNIDAD_VACIA: FormaComunidad = {
  nombre: "",
  descripcion: "",
  acerca: "",
  tema: "Finanzas",
  coach_titulo: "",
  precio_mensual: "390",
  whatsapp: "",
  agenda: "",
};

// Lo que la coach escribe de su comunidad, igual al crearla que al editarla.
export default function CamposComunidad({
  forma,
  alCambiar,
}: {
  forma: FormaComunidad;
  alCambiar: (forma: FormaComunidad) => void;
}) {
  const poner = (campo: keyof FormaComunidad) => (e: { target: { value: string } }) =>
    alCambiar({ ...forma, [campo]: e.target.value });
  return (
    <>
      <label className="campo">
        <span>Nombre</span>
        <input
          value={forma.nombre}
          onChange={poner("nombre")}
          maxLength={60}
          placeholder="Por ejemplo: Cocina que Vende"
          required
        />
      </label>
      <label className="campo">
        <span>¿Para quién es?</span>
        <textarea
          value={forma.descripcion}
          onChange={poner("descripcion")}
          maxLength={240}
          rows={3}
          placeholder="Una o dos líneas: a quién ayudas y con qué."
          required
        />
      </label>
      <label className="campo">
        <span>Acerca de tu comunidad (opcional)</span>
        <textarea
          value={forma.acerca}
          onChange={poner("acerca")}
          maxLength={1500}
          rows={5}
          placeholder="Lo que aparece en la presentación de tu comunidad: qué van a aprender, cómo trabajas con tus miembros, para quién no es."
        />
      </label>
      <div className="forma-fila">
        <label className="campo">
          <span>Tema</span>
          <select value={forma.tema} onChange={poner("tema")}>
            {TEMAS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Membresía al mes (MXN)</span>
          <input
            type="number"
            min={50}
            max={5000}
            step={10}
            value={forma.precio_mensual}
            onChange={poner("precio_mensual")}
            required
          />
        </label>
      </div>
      <label className="campo">
        <span>Tu título (aparece junto a tu nombre)</span>
        <input
          value={forma.coach_titulo}
          onChange={poner("coach_titulo")}
          maxLength={80}
          placeholder="Por ejemplo: Chef y asesora de negocios"
        />
      </label>
      <fieldset className="campos-agenda">
        <legend>Para que tus alumnos agenden una sesión contigo (opcional)</legend>
        <p className="texto-suave">
          Aparecen como botones al final de un diagnóstico y donde pongas una invitación a agendar. Con ninguno, no se
          muestran.
        </p>
        <div className="forma-fila">
          <label className="campo">
            <span>Tu WhatsApp</span>
            <input
              type="tel"
              inputMode="tel"
              value={forma.whatsapp}
              onChange={poner("whatsapp")}
              maxLength={20}
              placeholder="10 dígitos, por ejemplo 656 123 4567"
            />
          </label>
          <label className="campo">
            <span>Liga de tu agenda</span>
            <input
              type="url"
              inputMode="url"
              value={forma.agenda}
              onChange={poner("agenda")}
              maxLength={300}
              placeholder="https://calendly.com/tu-nombre"
            />
          </label>
        </div>
      </fieldset>
    </>
  );
}
