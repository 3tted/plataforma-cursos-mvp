# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dos roles con el mismo peso; cada uno tiene sus propias superficies y ninguno se sacrifica por el otro.

- **Alumno.** Dueña o dueño de un pequeño negocio (en el curso de ejemplo) o, en general, persona que paga una membresía mensual para tomar el curso de un coach. Entra sobre todo desde el celular. Su trabajo: avanzar en las lecciones, resolver dudas al momento con el asistente y participar en la comunidad (presentarse, preguntar, compartir logros).
- **Coach o consultor.** Profesional independiente en México que hoy vende sus cursos combinando Facebook o Discord, Zoom, Google Drive y una plataforma en inglés y en dólares (Skool, Teachable, Kajabi). Su trabajo: reunir a sus alumnos en un solo lugar, cobrar sin fricción, saber qué dudas se repiten y dejar de contestar las mismas preguntas a mano. Es quien decide adoptar la plataforma y pagarla.

Clientes prioritarios según la ficha: coaches y consultores independientes (negocio, finanzas personales, desarrollo profesional), instructores de habilidades técnicas o creativas, academias pequeñas con cursos presenciales y agencias que capacitan a sus clientes (incluida Merkatics). En la Fase 2 aparece un tercer rol: el administrador de Merkatics, que gestiona todas las comunidades.

## Product Purpose

Plataforma web en español donde un coach vende su curso y reúne a sus alumnos en una comunidad: feed, curso con módulos y lecciones, asistente de IA sobre el curso, membresía con pagos locales y un panel para el coach.

Este repositorio es el MVP de la Fase 1. Su éxito inmediato es que al menos un coach o consultor real lo pruebe y que la validación quede documentada (quién lo probó, qué dijo, qué se ajustó), para que Carlos apruebe pasar a la Fase 2. El éxito de la Fase 2 es un sistema desplegado, multiempresa, con contenido real, asistente real, al menos un flujo de pago local (real o en sandbox) y un piloto con un coach real.

## Positioning

Frente a Skool, dos diferenciadores que se ejecutan primero, no al final:

1. **Asistente que responde con el curso del coach.** Contesta solo con el contenido real de las lecciones, cita de qué lección sale cada idea ([L4], [L5]…) con enlace a la lección, y si algo no está en el curso lo dice y sugiere llevar la pregunta a la comunidad. No inventa.
2. **Cobro local en pesos mexicanos.** OXXO (ficha con referencia), SPEI (CLABE) y Mercado Pago, en lugar de tarjeta en dólares.

Todo en español de México, desde el MVP.

## Operating Context

- **Alumno:** abre la comunidad, sigue el curso lección por lección (texto, transcripción y el video que haya subido la coach), le pregunta al asistente desde la lección o desde su página propia, y paga la membresía para desbloquear lo que no es gratis. El módulo 1 es gratis.
- **Coach:** publica anuncios fijados, responde dudas en el feed, revisa en su panel qué preguntan los alumnos al asistente y qué lecciones se consultan más, ve los pagos y puede pegar una lección propia para que el asistente responda con ella al momento.
- **Sesión de validación:** 30 minutos con un coach real siguiendo [VALIDACION.md](VALIDACION.md): tareas como alumno (encontrar una lección, preguntar al asistente, pagar con OXXO simulado, publicar) y como coach (panel, pegar su propia lección, hacer tres preguntas reales). Se prueba en `npm run dev` local o en una URL de Vercel.
- **Revisión del proyecto:** avances quincenales con el mentor, siempre con evidencia (demo funcionando o validación documentada).

## Capabilities and Constraints

- **Funciona en el MVP:** feed con categorías (Anuncios, Dudas, Logros, Presentaciones, General), publicar, comentar y reaccionar ("Me sirve"); los anuncios son solo para la coach. Curso de 3 módulos y 8 lecciones con progreso por alumno. Asistente con streaming, citas enlazadas y opción de detener; modo demostración sin clave de API. Checkout simulado. Panel de la coach.
- **Video de las lecciones:** la coach lo sube desde cada lección (MP4, WebM o MOV, hasta 250 MB); se guarda en el disco local (`.data/videos`), así que en Vercel no persiste.
- **Simulado en el MVP:** pagos (no se cobra nada) y base de datos (un documento JSON: archivo en `.data/` o Redis en Vercel). Las cuentas ya son reales (correo y contraseña o Google, coaches por invitación, datos separados por empresa), pero sin correos: no hay recuperación de contraseña automática.
- **Stack del MVP:** Next.js 16, React 19 y TypeScript, con el SDK de Anthropic para el asistente. Este repositorio es el MVP que se mostrará al coach real.
- **Fase 2:** Django y Python (frontend por confirmar: plantillas con HTMX y Tailwind, o React). No se escribe Django hasta validar el MVP con un coach real y tener la aprobación de Carlos. El modelo de datos de `lib/tipos.ts` ya sigue la ficha para facilitar la migración.
- **Asistente:** curso completo en el prompt de sistema con caché mientras quepa; con cursos grandes, búsqueda por fragmentos (RAG). Límite de 30 preguntas cada 10 minutos por IP. En temas fiscales o legales recomienda consultar a un contador.
- **Multiempresa (Fase 2):** una comunidad por cliente, con datos aislados; cada coach nuevo es una comunidad más (SaaS).
- **Fuera de alcance:** gamificación, calendario de eventos en vivo, app móvil nativa (solo web adaptada al celular), mensajes directos y notificaciones.
- **Pendiente (decide Carlos o el coordinador):** marca visible para el alumno (marca blanca del coach o Merkatics como plataforma visible con la comunidad del coach dentro); si el módulo es de entrada (gratis o barato) o de pago desde el inicio; modelo de precio; proveedor de pagos (Mercado Pago, Conekta u otro); qué coaches reales validan.
- **Terminología:** comunidad, coach, alumno, curso, módulo, lección, publicación, comentario, membresía, asistente del curso, panel de la coach.

## Brand Commitments

- Merkatics es dueña del proyecto y de la propiedad intelectual. Qué marca ve el alumno (la del coach o la de la plataforma) **no está decidido**.
- Español de México en toda la interfaz y en el asistente (compromiso de la ficha).
- La interfaz dice con claridad qué es simulado: los pagos llevan el aviso "no se realiza ningún cobro real".
- Observado en el prototipo, sin confirmar como compromiso: voz cercana y directa, trato de "tú", sin jerga técnica ni contable.

## Evidence on Hand

- **Curso de ejemplo:** "Finanzas claras para tu negocio", 3 módulos y 8 lecciones con texto y transcripción en [data/curso.json](data/curso.json) y [data/lecciones/](data/lecciones/). Es contenido de muestra.
- **Comunidad de ejemplo:** "Finanzas Claras" con la coach **Daniela Ortega**, y publicaciones de alumnos en [data/comunidad-seed.json](data/comunidad-seed.json). Ambas son ficticias; no se deben presentar como una coach, alumnos o testimonios reales.
- **Documentación:** [README.md](README.md), [VALIDACION.md](VALIDACION.md) y el informe de desarrollo (`Informe de desarrollo - Plataforma de Cursos.docx`).
- **Ausencias:** todavía no hay validación con un coach real, ni testimonios, clientes, métricas de uso, precio definitivo ni proveedor de pagos confirmado. El precio de $490 MXN/mes es un valor de la demo. No se deben inventar.

## Product Principles

1. **El asistente se gana la confianza citando.** Cada respuesta dice de qué lección sale, y cuando el curso no cubre algo lo admite en vez de improvisar.
2. **Cobrar como se paga en México.** OXXO, SPEI y Mercado Pago en pesos son parte del producto, no un agregado.
3. **Alumno y coach pesan igual.** El alumno aprende y pregunta desde el celular; el coach entiende a sus alumnos y deja de responder lo mismo. Ninguna superficie se diseña a costa de la otra.
4. **Honesto sobre lo que es prototipo.** Lo simulado se dice en pantalla; nada de datos, testimonios o cifras inventadas.
5. **Recorte estricto.** Solo lo que sirve para validar con un coach real; lo demás espera en el backlog.

## Accessibility & Inclusion

- Toda la interfaz y las respuestas del asistente en español (`lang="es-MX"`).
- Web que funcione bien en el celular, porque no habrá app nativa.
- En el curso de ejemplo, los alumnos no tienen formación financiera ni técnica: lenguaje llano y ejemplos concretos. No se ha fijado un estándar formal de accesibilidad (por ejemplo, WCAG).
