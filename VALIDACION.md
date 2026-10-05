# Guía de validación del MVP

La ficha del proyecto pide validar el MVP con **al menos un coach, consultor o instructor real** (no compañeros del programa) antes de escribir una línea de Django. También pide documentar quién lo probó, qué dijo y qué ajustaste. Esta guía te ayuda a hacerlo en una sesión de 30 minutos.

## Antes de la sesión

- [ ] Conecta la IA real (`ANTHROPIC_API_KEY`). El modo demo sirve para practicar, pero el coach debe ver al asistente redactar respuestas.
- [ ] Pídele al coach el texto o la transcripción de **una lección suya**, aunque sea corta.
- [ ] Borra `.data/` para empezar con la comunidad limpia.
- [ ] Ten lista la plataforma: tu computadora con `npm run dev` o una URL en Vercel.

## Guion (30 min)

### 1. Contexto (5 min). Todavía no muestres nada.

- ¿Cómo vendes hoy tus cursos o capacitaciones? ¿Qué herramientas usas? (Facebook, WhatsApp, Zoom, Drive, Hotmart, Skool…)
- ¿Qué es lo más molesto de administrar a tus alumnos?
- ¿Cómo te pagan hoy? ¿Algún alumno te ha pedido pagar en OXXO o por transferencia?
- ¿Cuántas dudas repetidas contestas a la semana? ¿Por dónde te llegan?

### 2. Tareas como alumno (10 min). Observa y no ayudes.

Pídele que lo haga en voz alta:

1. "Encuentra la lección sobre punto de equilibrio."
2. "Hazle una pregunta al asistente como si fueras un alumno con una duda real."
3. "Únete a la comunidad pagando con OXXO." (Recuérdale que es simulado.)
4. "Publica una duda en la comunidad."

Anota dónde se detiene, qué no entiende y qué le sorprende.

### 3. Tareas como coach (10 min)

1. Cambia al rol de coach y abre el **Panel de la coach**.
2. Pega su lección en "Prueba el asistente con tu propio contenido".
3. Pídele que le haga al asistente **tres preguntas que sus alumnos le hacen siempre**.
4. Revisen juntos la sección "Lo que preguntan tus alumnos".

### 4. Cierre (5 min)

- Del 1 al 10, ¿qué tan útil sería el asistente para tus alumnos? ¿Por qué no es un 10?
- ¿Qué le falta para que lo usaras con tus alumnos reales?
- Si existiera hoy, ¿pagarías una suscripción mensual? ¿Cuánto te parecería razonable?
- ¿Conoces a otro coach o consultor que debería verlo?

## Registro (cópialo en la ficha del proyecto)

```
Fecha:
Quién lo probó: (nombre, a qué se dedica, cuántos alumnos tiene)
Cómo vende hoy y con qué herramientas:
Qué hizo sin ayuda:
Dónde se atoró:
Qué dijo del asistente de IA (citas textuales):
Qué dijo de los pagos locales:
¿Pagaría? ¿Cuánto?:
Qué ajusté después de la sesión:
```

## Evidencia para Carlos

Para pedir la aprobación de la Fase 2, lleva:

1. El registro de al menos una sesión con un coach real.
2. La demo funcionando con el contenido de ese coach.
3. La lista de ajustes que hiciste por su retroalimentación.
4. Tu recomendación sobre las decisiones pendientes: "level entry" o de pago, precio y proveedor de pagos.
