// Pie de página oscuro (grafito), igual en la plataforma y en la página para
// visitantes. Términos, Privacidad y Contacto se agregan cuando tengan página.
export default function PiePagina({ fondoApp = false }: { fondoApp?: boolean }) {
  return (
    <footer className="pie" {...(fondoApp ? { "data-app-fondo": "" } : {})}>
      <div className="envoltura pie-interior">
        {/* eslint-disable-next-line @next/next/no-img-element -- logo estático */}
        <img
          className="pie-logo"
          src="/merkatics-logo-blanco.png"
          alt="Merkatics Growth Operating System"
          width={2311}
          height={544}
        />
        <p className="pie-derechos">© 2026 Merkatics Growth Operating System</p>
      </div>
    </footer>
  );
}
