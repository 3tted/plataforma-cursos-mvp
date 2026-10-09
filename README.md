# Plataforma de Cursos y Comunidad · MVP (Fase 1)

Proyecto **2026-544-17** · Módulo Merkatics tipo Skool para coaches y consultores, en español, con pagos locales y un asistente de IA.

Este repositorio es el **MVP de la Fase 1**: un prototipo navegable para validar la idea con al menos un coach o consultor real antes de pasar a Django.

## Qué incluye

Cubre el criterio del MVP de la ficha: *comunidad con feed simple + un curso de ejemplo + asistente de IA que responde con el contenido del curso, todo en español.*

| Pieza | Qué hace | Estado |
|---|---|---|
| **Comunidad** | Feed con categorías; publicar, comentar y marcar "Me sirve". Los anuncios son solo para la coach. | Funciona (datos en un archivo JSON) |
| **Comunidades y cursos** | Dos comunidades reales, cada una con su coach, su feed y su membresía: **Finanzas Claras** (Daniela Ortega, $490/mes) con dos cursos, "Finanzas claras para tu negocio" (8 lecciones) y "Precios para tus servicios" (5), y **Vende por WhatsApp** (Mariana Ibarra, $390/mes) con un curso, "De la conversación a la venta" (4). El alumno se une a una comunidad y luego se inscribe a sus cursos. El directorio agrupa todas las comunidades por tema; las demás son de ejemplo. Textos y transcripciones en `data/`. Progreso por alumno. En los cursos de archivo el módulo 1 es gratis; en los que crea la coach, ella marca qué lecciones son gratis. La coach **sube el video de cada lección** (MP4, WebM o MOV, hasta 250 MB) desde la propia lección. | Funciona (videos guardados en `.data/videos`; trae videos de muestra en `data/videos`) |
| **Asistente del curso** | En cada lección, en la comunidad y en `/curso/asistente`. Responde dudas usando el contenido de las lecciones y **cita la lección** de donde sale cada idea ([L4], [L5]…). Si algo no está en el curso, lo dice y ofrece llevar la pregunta a la comunidad. | Real con clave de API · modo demo sin ella |
| **Asistente Merkatics** | El de "Asistente" en el menú (`/asistente`): IA de uso general (ideas, mensajes, explicaciones). No usa los cursos y sus preguntas no aparecen en el panel de la coach. | Solo con clave de API |
| **Repaso y examen final** | Cada lección cierra con un repaso de 2 preguntas (no cuenta para la calificación; explica la respuesta y ofrece preguntarle al asistente). Al terminar las lecciones de un curso se desbloquea su examen final (12 preguntas en Finanzas claras, 8 en Precios), se aprueba con 70% y hay 3 intentos. Las respuestas correctas solo viven en el servidor (`data/evaluaciones*.json`). | Funciona |
| **Expediente y matriz** | El alumno ve su expediente en su perfil; la coach ve en su panel una matriz de alumnos por curso (avance por módulo, repaso, examen y estado), las preguntas que más se fallan y puede descargarla en CSV. Empieza vacía: solo aparecen los alumnos que de verdad avanzan. | Funciona (alumnos identificados por nombre) |
| **Pagos locales** | Membresía de $490 MXN/mes con OXXO (ficha con referencia), SPEI (CLABE) o Mercado Pago. | **Simulado**: no se cobra nada |
| **Crear comunidades y cursos** | En *Mis comunidades y cursos* (`/coach/comunidades`) la coach crea su comunidad (nombre, tema, membresía) y sus cursos en el orden que quiera: dentro de una comunidad, o primero el curso suelto y después lo pone en una comunidad (desde el editor o desde la comunidad; para publicarlo tiene que estar en una). Los cursos se arman **a mano**: datos del curso, módulos, lecciones (texto, transcripción, video), preguntas de repaso por lección y examen final. El curso se guarda como borrador y se publica cuando está completo; la comunidad aparece en el directorio con su primer curso publicado. Lecciones `K1`, `K2`… También **con IA a partir de un documento**: la coach sube un PDF, un Word (.docx) o pega el texto de su material (hasta 4 MB), puede fijar cuántas lecciones, preguntas de repaso por lección y preguntas de examen quiere (en los campos o escritas en sus indicaciones; el servidor verifica que se cumplan), y la IA propone módulos, lecciones, repaso y examen usando solo lo que dice el documento; el resultado se abre como borrador en el mismo editor para revisarlo. El PDF se manda tal cual a la IA (lee tablas, imágenes y escaneos); del Word solo se toma el texto. | Funciona (la opción con IA necesita clave de Gemini o de Claude) |
| **Panel de la coach** | Qué preguntan los alumnos al asistente, lecciones más consultadas, pagos y un formulario para **pegar una lección propia** y que la IA responda con ella. | Funciona |

Fuera de alcance, como indica la ficha: gamificación, calendario, app nativa, mensajes directos y notificaciones.

## Cómo correrlo

Requisitos: Node.js 20 o más reciente.

```bash
npm install
npm run dev
```

Abre http://localhost:3000. Al entrar eliges si pruebas la plataforma **como alumno** o **como coach** (no hay contraseñas).

### Conectar la IA real

Sin clave, el asistente funciona en **modo demostración**: muestra los fragmentos del curso que mejor responden la pregunta, con sus citas, pero no redacta con IA.

Para activar la IA hay dos opciones:

- **Gemini (gratis, con límites diarios):** crea una clave sin tarjeta en https://aistudio.google.com/apikey y pégala en `GEMINI_API_KEY`.
- **Claude (de pago, por uso):** crea una clave en https://console.anthropic.com/ y pégala en `ANTHROPIC_API_KEY`.

1. Copia `.env.example` como `.env.local` y pega la clave que elijas.
2. Reinicia `npm run dev`. En `/api/estado` verás `"iaActiva":true` y el modelo en uso.

Si pones las dos claves se usa Claude; para forzar uno, define `IA_PROVEEDOR=gemini` (o `claude`, o `demo`). Gemini usa el SDK oficial `@google/genai` con el modelo `gemini-flash-lite-latest`, que empieza a responder en menos de un segundo (se cambia con `GEMINI_MODEL`); si está saturado o tarda más de 12 segundos en empezar, pasa a `gemini-flash-latest` y las mismas instrucciones que Claude. En el plan gratuito, Google puede usar las conversaciones para mejorar sus modelos: úsalo con contenido de ejemplo.

Detalles técnicos:

- Usa el SDK oficial `@anthropic-ai/sdk` con el modelo `claude-opus-5-5` (Claude Opus 5.5) por defecto (se cambia con `ANTHROPIC_MODEL`).
- El curso completo va en el prompt de sistema con **caché de prompt**, así las preguntas siguientes cuestan mucho menos.
- La respuesta llega en streaming, y el alumno puede detenerla.
- Tiene respaldo automático (`fallbacks: "default"`) por si el modelo declina una pregunta.
- Hay un límite de 30 preguntas cada 10 minutos por IP para que un prototipo publicado no genere costos descontrolados.
- Costo estimado: unos 2 centavos de dólar por pregunta con este curso. Es una estimación: revisa el consumo real en la consola de Anthropic.

## Cómo publicarlo para que un coach lo pruebe

La forma más simple es **Vercel** (gratis):

1. Sube el proyecto a un repositorio de GitHub. El `.gitignore` ya excluye `.env.local`.
2. En vercel.com, importa el repositorio.
3. En *Settings → Environment Variables*, agrega `ANTHROPIC_API_KEY`.

Importante: en Vercel el servidor corre en varias copias y cada una tiene su propio disco temporal. **Conecta Redis** para que todas compartan los mismos datos (alumnos, avance, exámenes, publicaciones y pagos): en Vercel, *Storage → Create Database → Upstash for Redis* (plan gratuito) y conéctalo al proyecto; agrega solo las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN` (o `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`). Después haz *Redeploy* y comprueba en `/api/estado` que diga `"almacen":"redis"`. Sin Redis, los datos se guardan en `/tmp` de cada copia y **se borran con frecuencia**. Para una demo en vivo no importa. Si necesitas que persistan durante días, usa un servidor con disco (Render o Railway, con `npm run build && npm start`). En la Fase 2 esto se resuelve con la base de datos de Django.

## Usar el contenido real de un coach

La validación convence mucho más cuando el coach ve **su propio contenido**. Tienes dos opciones:

- **Rápida**: en el *Panel de la coach*, sección "Prueba el asistente con tu propio contenido", pega el texto o la transcripción de una lección. Aparece en el curso como `C1`, `C2`… y el asistente responde con ella de inmediato.
- **Completa**: edita `data/curso.json` (datos de la comunidad, módulos, lecciones y preguntas sugeridas) y los archivos `data/lecciones/L*.md`. En cada archivo, lo que va después de `<!-- transcripcion -->` es la transcripción del video.

Para reiniciar la comunidad a los datos de ejemplo, borra la carpeta `.data/`. Al crearse de nuevo, cada lección recibe su video de muestra desde `data/videos/` (por ejemplo `L1.webm`); para cambiar los de muestra, reemplaza esos archivos.

Guía para la sesión con el coach: [VALIDACION.md](VALIDACION.md).

Cómo se guardan los datos (con diagramas): [docs/base-de-datos.md](docs/base-de-datos.md).

## Estructura

```
app/
  page.tsx                 Comunidad (feed)
  curso/                   Índice del curso y vista de lección
  asistente/page.tsx       Asistente Merkatics (general, sin los cursos)
  curso/asistente/         Asistente del curso (cita las lecciones)
  membresia/page.tsx       Checkout simulado (OXXO, SPEI, Mercado Pago)
  coach/page.tsx           Panel de la coach
  coach/comunidades/       Mis comunidades: crear comunidad y agregar cursos
  coach/curso/[id]/        Editor de un curso (borrador y publicación)
  api/                     Rutas del servidor
    asistente/             Streaming con Claude o modo demo
    publicaciones/         Feed, comentarios y reacciones
    pagos/                 Referencias ficticias y confirmación simulada
    coach/                 Resumen, lecciones propias, comunidades y cursos de la coach
components/                Piezas de la interfaz
lib/
  asistente.ts             Prompt, llamada a Claude y búsqueda del modo demo
  almacen.ts               Almacén JSON en disco (.data/almacen.json)
  curso.ts                 Carga de cursos: los de /data y los que crea la coach
  creacion.ts              Validación de comunidades y cursos creados (borrador → publicado)
  curso-ia.ts              Curso propuesto por la IA a partir de un documento (PDF, Word o texto)
  permisos.ts              Solo la coach dueña edita su comunidad y sus cursos
  tipos.ts                 Modelo de datos compartido
data/
  curso.json               Comunidad y curso principal (módulos y lecciones)
  cursos/*.json            Los demás cursos (un curso de otra comunidad trae su "comunidad")
  evaluaciones*.json       Repaso y examen final de cada curso
  lecciones/L*, P*, W*.md  Contenido y transcripciones (L = Finanzas claras, P = Precios, W = WhatsApp)
  comunidad-seed.json      Publicaciones de ejemplo
```

## Del MVP a la Fase 2 (Django)

La Fase 2 solo empieza cuando Carlos o el coordinador aprueben este MVP con evidencia de validación. El modelo de datos de `lib/tipos.ts` ya sigue el de la ficha, para que la migración sea directa:

| MVP | Fase 2 (Django) |
|---|---|
| `data/curso.json` + `data/lecciones/*.md` | Modelos `Comunidad`, `Curso`, `Modulo`, `Leccion` (con `comunidad` como llave para multiempresa) |
| `Publicacion`, `Comentario` en `.data/almacen.json` | Modelos `Publicacion`, `Comentario`, `Reaccion` |
| Nombre en `localStorage` | Usuarios reales (`Alumno`, coach) con autenticación |
| `lib/asistente.ts` (curso completo en el prompt) | Mismo enfoque mientras el curso quepa; con cursos grandes, búsqueda por fragmentos (RAG) |
| `data/evaluaciones.json` y los intentos en `.data/almacen.json` | Modelos `Examen`, `Pregunta`, `Opcion`, `Intento` e `Inscripcion`, con cuentas reales para que la matriz sea confiable |
| `app/api/pagos` simulado | Integración con el proveedor que defina Carlos (Mercado Pago, Conekta u otro) en sandbox, con webhooks |
| Videos en `.data/videos` servidos por `app/api/videos/[leccion]` | Almacenamiento de objetos o servicio de video, con acceso solo para miembros y transcripción automática |

## Limitaciones conocidas del prototipo

- Sin autenticación: cualquiera puede elegir el rol de coach.
- Los datos se guardan en un archivo JSON, sin base de datos.
- Los videos se guardan como archivos en `.data/videos` (o en `DATA_DIR/videos`). Funciona bien en local; en Vercel el disco es temporal y el cuerpo de una petición no puede pasar de unos 4 MB, así que para publicar el prototipo con videos hay que moverlos a un almacenamiento de objetos o a un servicio de video (Vercel Blob, S3, Cloudflare Stream o Mux) en la Fase 2.
- El asistente responde con el texto y la transcripción de cada lección, no con el audio del video: si la coach sube un video nuevo, conviene que su transcripción esté en la lección.
- Cualquiera que tenga el enlace de un video puede verlo: sin autenticación, el servidor no puede saber si quien lo pide es miembro. La página sí oculta el video de las lecciones para miembros.
- Los pagos son simulados: no hay integración real con ningún proveedor.
- El límite de preguntas vive en memoria y se reinicia con el servidor.
