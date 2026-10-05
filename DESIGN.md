---
name: Finanzas Claras (Merkatics)
description: Plataforma de cursos, comunidad y asistente de IA de Merkatics, con el manual corporativo traducido a una interfaz clara de día.
colors:
  fondo: "#f2f1f1"
  superficie: "#fefefd"
  superficie-2: "#efeeec"
  tinta: "#1e1e1e"
  tinta-2: "#4f4a49"
  tinta-3: "#6b6866"
  tinta-rubor: "#74504b"
  linea: "#e5e3e1"
  linea-fuerte: "#cfccca"
  linea-campo: "#928e8c"
  acento: "#c6443f"
  acento-hover: "#b23a35"
  acento-texto: "#b03a35"
  acento-suave: "#fceae7"
  rubor: "#fceeeb"
  rubor-2: "#f8deda"
  progreso: "#e95349"
  arco-1: "#e26a69"
  arco-2: "#d64d4d"
  arco-3: "#f4c2bd"
  exito: "#2f7d4f"
  exito-suave: "#e6f3ea"
  exito-texto: "#236b41"
  pendiente: "#8a5a00"
  pendiente-suave: "#fdf1d8"
  peligro: "#9f1d2b"
  peligro-suave: "#fbe4e6"
  fondo-oscuro: "#141313"
  superficie-oscuro: "#1c1b1b"
  superficie-2-oscuro: "#262424"
  tinta-oscuro: "#f2efee"
  tinta-2-oscuro: "#b3adab"
  tinta-3-oscuro: "#8f8988"
  tinta-rubor-oscuro: "#d9b3ae"
  linea-oscuro: "#312e2e"
  linea-fuerte-oscuro: "#4a4545"
  linea-campo-oscuro: "#7a7272"
  acento-oscuro: "#e95349"
  acento-hover-oscuro: "#f06a5f"
  acento-texto-oscuro: "#f4908a"
  acento-suave-oscuro: "#3a201f"
  acento-tinta-oscuro: "#1e1e1e"
  rubor-oscuro: "#2a1d1c"
  rubor-2-oscuro: "#3a2422"
  progreso-oscuro: "#f07c73"
  arco-3-oscuro: "#5a3431"
  exito-oscuro: "#7acb98"
  exito-suave-oscuro: "#1d3326"
  exito-texto-oscuro: "#8fd6a9"
  pendiente-oscuro: "#f0b45a"
  pendiente-suave-oscuro: "#2e2412"
  peligro-oscuro: "#f59aa3"
  peligro-suave-oscuro: "#3a1a1e"
typography:
  display:
    fontFamily: "Red Hat Display, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 1.2rem + 1.8vw, 2.55rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  precio:
    fontFamily: "Red Hat Display, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.2rem, 1.6rem + 2vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.05
    fontFeature: "\"tnum\""
  ventana:
    fontFamily: "Red Hat Display, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.55rem"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  cifra-destacada:
    fontFamily: "Red Hat Display, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.1
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "Red Hat Display, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Red Hat Display, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  lectura:
    fontFamily: "Red Hat Text, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.7
  body:
    fontFamily: "Red Hat Text, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  boton:
    fontFamily: "Red Hat Text, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.25
  small:
    fontFamily: "Red Hat Text, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
  caption:
    fontFamily: "Red Hat Text, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
  label:
    fontFamily: "Red Hat Text, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
  referencia:
    fontFamily: "IBM Plex Mono, ui-monospace, Cascadia Mono, Consolas, monospace"
    fontSize: "1.125rem"
    fontWeight: 400
    letterSpacing: "0.04em"
rounded:
  cola: "4px"
  control: "12px"
  hoja: "16px"
  ventana: "24px"
  pildora: "999px"
spacing:
  gutter-movil: "16px"
  gutter: "20px"
  hoja-y: "20px"
  hoja-x: "22px"
  seccion: "28px"
  pie-pagina: "56px"
components:
  button-primary:
    backgroundColor: "{colors.acento}"
    textColor: "{colors.superficie}"
    typography: "{typography.boton}"
    rounded: "{rounded.pildora}"
    padding: "9px 20px"
    height: "42px"
  button-primary-hover:
    backgroundColor: "{colors.acento-hover}"
    textColor: "{colors.superficie}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.acento-texto}"
    rounded: "{rounded.pildora}"
    padding: "9px 20px"
    height: "42px"
  button-secondary-hover:
    backgroundColor: "{colors.acento-suave}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.tinta-2}"
    rounded: "{rounded.pildora}"
    padding: "9px 20px"
  button-ghost-hover:
    backgroundColor: "{colors.superficie-2}"
    textColor: "{colors.tinta}"
  filter-chip:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta-2}"
    typography: "{typography.small}"
    rounded: "{rounded.pildora}"
    padding: "6px 15px"
  filter-chip-active:
    backgroundColor: "{colors.acento-suave}"
    textColor: "{colors.acento-texto}"
  pill:
    backgroundColor: "{colors.superficie-2}"
    textColor: "{colors.tinta-2}"
    typography: "{typography.label}"
    rounded: "{rounded.pildora}"
    padding: "3px 10px"
  pill-ok:
    backgroundColor: "{colors.exito-suave}"
    textColor: "{colors.exito-texto}"
  pill-pendiente:
    backgroundColor: "{colors.pendiente-suave}"
    textColor: "{colors.pendiente}"
  card:
    backgroundColor: "{colors.superficie}"
    rounded: "{rounded.hoja}"
    padding: "20px 22px"
  input:
    backgroundColor: "{colors.superficie}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "44px"
  portada:
    backgroundColor: "{colors.rubor}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.ventana}"
    padding: "30px"
  citation-chip:
    backgroundColor: "{colors.acento-suave}"
    textColor: "{colors.acento-texto}"
    typography: "{typography.caption}"
    rounded: "{rounded.pildora}"
    padding: "1px 10px 1px 3px"
  citation-chip-locked:
    backgroundColor: "{colors.superficie-2}"
    textColor: "{colors.tinta-2}"
  chat-bubble-user:
    backgroundColor: "{colors.rubor-2}"
    textColor: "{colors.tinta}"
    padding: "10px 16px"
  completion-seal:
    backgroundColor: "{colors.exito-suave}"
    textColor: "{colors.exito-texto}"
    rounded: "{rounded.hoja}"
    padding: "18px 20px"
---

# Design System: Finanzas Claras (Merkatics)

## Overview

**Creative North Star: "Merkatics en luz de día"**

The Merkatics corporate identity manual, a printed system of corporate reds, brand black and concentric coral arcs, translated into a light product interface. Near-white sheets sit on a pale stone ground; blush fields (the manual's coral, diluted) mark the few places that carry identity: page covers, the assistant block and the student's own chat bubble. Three concentric quarter-annulus bands in coral and red anchor the top-right corner of those covers, exactly as the manual places them on stationery. The corporate red is reserved for doing things: filled actions and the active section.

Density is product, not landing: dials of variation 4, motion 4, density 4. The student reads it on a phone in strong daylight, the coach on a laptop, so contrast is carried by ink and lines, and color is spent only where it means something. Light dominates by explicit request of the client: the brand black lives only in text, and no frame, bar or panel is dark. The light theme is always shown, even when the operating system or browser prefers dark (explicit client request); the dark theme exists only as an opt-in through `data-theme="dark"` on `<html>`.

It rejects the previous version's black frame and the generic gray course-platform feed.

**Key Characteristics:**
- Pale stone ground, near-white sheets, blush fields for covers and the assistant.
- Corner arcs (three concentric coral bands) as the single brand motif.
- Corporate red only on filled actions, the active nav underline and focus.
- Flat: no shadows, no glass; depth by tonal fields and 1px lines.
- Pill buttons, chips and filters; 12 / 16 / 24px corners for controls, sheets and windows.
- Red Hat Display over Red Hat Text; IBM Plex Mono only for references.
- One authored motion moment: the lesson-completion seal stamp.

## Colors

A warm-neutral light palette carrying one corporate red, a diluted coral blush for identity fields, and three strictly scoped semantic colors.

### Primary
- **Merkatics Red** (acento): the manual's corporate red. Fill of every primary button, icon button and the brand disc; the 3px underline of the active section; focus outlines, carets and radio/checkbox accents. On hover it deepens to **Pressed Red** (acento-hover).
- **Red Ink** (acento-texto): the red at text contrast. Links, secondary-button labels, active nav icon, lesson-list markers, citation chips, the assistant's author label.
- **Red Wash** (acento-suave): selected states (active filter, chosen payment method, current lesson in the index, pressed reaction), open-lesson state circles, citation chips, text selection.

### Secondary
- **Blush** (rubor): the identity field. Covers (community portada, course cover) and the assistant block. Secondary text on it uses **Blush Ink** (tinta-rubor), never gray.
- **Deep Blush** (rubor-2): the student's own chat bubble.
- **Progress Coral** (progreso): progress-bar fill, coach bar-chart fill, the thinking dots.

### Tertiary
- **Arc Coral / Arc Red / Arc Rose** (arco-1, arco-2, arco-3): the three concentric corner bands, outer to inner. Used by the arcs motif only. In dark theme the two outer bands keep their values and the inner band darkens (arco-3-oscuro).

### Neutral
- **Stone Ground** (fondo): page background and the chat dock band.
- **Sheet** (superficie): cards, top bar, bottom nav, inputs, the progress panel inside the course cover, text on filled red.
- **Shaded Sheet** (superficie-2): quiet fields (video placeholder, notice bar, comment bubbles, confirmations, table headers), neutral pills, progress tracks, hover fill of ghost controls.
- **Brand Black** (tinta): all primary text. Text only.
- **Graphite** (tinta-2): secondary text, inactive nav, meta.
- **Soft Graphite** (tinta-3): placeholders.
- **Hairline** (linea): card borders and every divider. **Strong Line** (linea-fuerte): outlines of chips, filters, method options, the user pill. **Field Line** (linea-campo): input borders, at 3:1 against the sheet.

### Semantic
- **Success Green** (exito, exito-suave, exito-texto): only completed lessons, the completion seal, paid status, membership benefits checks.
- **Pending Amber** (pendiente on pendiente-suave): only "Pendiente de pago".
- **Error Red** (peligro on peligro-suave): only error messages.

Dark theme (opt-in only, via `data-theme="dark"`; the system's dark preference is deliberately ignored) swaps every role to its `-oscuro` value; the red lifts to Progress Coral and text on filled red becomes Brand Black.

### Named Rules
**The Red Means Act Rule.** Merkatics Red fills only actions (buttons, icon buttons, the brand disc) and marks only the active section. It is never a background field, a heading color or decoration. Red text uses Red Ink.

**The Black Is Ink Rule.** Brand black appears only as text. No dark bars, frames, panels or video placeholders in the light theme.

**The Scoped Semantics Rule.** Green means completed or paid; amber means pending payment; error red means an error. None of them is used for anything else.

**The No Pure Values Rule.** No #fff and no #000 anywhere; the lightest value is Sheet, the darkest is Brand Black.

## Typography

**Display Font:** Red Hat Display (with ui-sans-serif, system-ui)
**Body Font:** Red Hat Text (with ui-sans-serif, system-ui, Segoe UI)
**Label/Mono Font:** IBM Plex Mono (with ui-monospace, Cascadia Mono, Consolas)

**Character:** Taken from the Merkatics sheet "Tipografía · Cursos en línea": two voices of one family, Red Hat Display to command (titles, buttons, labels; 800 for headings, 700 for buttons at 15px) and Red Hat Text to read (lessons, posts, assistant; 400 at 17px / 1.6). They stand in for the paid corporate Montreal Serial; the logo keeps Futura Bold and Caros. Scale: entry 58px, lesson title 36px, section 22px, body 17px, label and button 15px, data 14px.

### Hierarchy
- **Display** (700, clamp 1.75rem to 2.55rem, 1.12, -0.02em): page h1 and cover titles.
- **Precio** (700, clamp 2.2rem to 3rem, 1.05, tabular): the membership price only.
- **Ventana** (600, 1.55rem): the welcome modal title.
- **Cifra destacada** (700, 1.75rem, tabular): single hero figures (course progress count, OXXO amount, card price).
- **Headline** (600, 1.3rem): h2, the seal title, coach stat figures, community stats.
- **Title** (600, 1.125rem): h3, card and post titles, brand name, sidebar titles.
- **Lectura** (400, 1.0625rem, 1.7, max 36em): lesson prose.
- **Body** (400, 1rem, 1.6): default text, chat answers, post bodies.
- **Boton** (700, 0.9375rem): button labels.
- **Small / Caption / Label** (0.875 / 0.8125 / 0.75rem, 600-800): meta, form labels, pills, bottom-nav labels. No uppercase tracking labels.
- **Referencia** (IBM Plex Mono 400-500, 0.04em tracking): lesson ids inside citation chips, the OXXO reference and the CLABE. Nothing else is mono.

### Named Rules
**The Tabular Figures Rule.** Every number that is compared or summed takes tabular numerals (`.cifra`, font-feature `tnum`) without changing the font. Figures of one kind share one scale: all coach stats are Headline.

**The Mono Is For Codes Rule.** Monospace marks things a person copies or cites (lesson id, payment reference, CLABE). It never sets headings, figures or labels.

## Layout

A centered container (max 1180px, 20px gutters, 16px at 760px and below) under a sticky 64px top bar (56px on mobile). Content starts 28px below the bar and ends 56px above the footer (18 / 36px on mobile).

- **Community:** main feed plus a 320px sidebar (28px gap), sidebar sticky under the bar. The sidebar is a stack of blocks separated by hairlines, not cards. At 920px it collapses to one column; "Continúa" and the quick assistant question move above the feed as compact blocks, and sidebar blocks become bordered sheets.
- **Course:** cover (text plus a 320px progress panel) above a stack of module cards (16px gap). At 760px the cover stacks and its corner radius drops to 16px.
- **Lesson:** a 250px sticky index plus content capped at 720px (44px gap); at 900px the index collapses to the back link.
- **Membership:** plan copy plus checkout column (max 460px); at 860px the checkout moves above the benefits.
- **Coach:** stat row, then a 1.3fr / 1fr grid that stacks at 860px.
- **Assistant:** single column, max 780px, with the input docked at the bottom.

Breakpoints: 440 (modal options stack), 600 (lesson rows compact), 760 (mobile: bottom nav, one-row header), 860, 900, 920. Under `pointer: coarse`, every button, filter, suggestion, reaction and link is at least 44px.

Spacing rhythm is small and even: 8 / 10 / 12 / 14 / 16px gaps inside components, 18-28px between sections, sheets padded 20px 22px.

## Elevation & Depth

Flat. There are no box-shadows, no blur and no glass anywhere in the build. Hierarchy comes from three tonal levels (Stone Ground, Sheet, Shaded Sheet), the blush identity fields, and 1px hairlines. The only overlay is the modal scrim (tinta at 45%, black at 60% in dark). The chat dock separates from the scrolling conversation with a band that fades from transparent to Stone Ground over 18px, then stays opaque.

### Named Rules
**The Tone Not Shadow Rule.** A surface sits above another by being lighter or tinted and outlined by a hairline, never by a shadow.

**The Lines Before Boxes Rule.** Group with dividers first; a card is only for a real object (a post, a module, the checkout, a stat row, a lesson's neighbors). The community sidebar stays unboxed on desktop.

## Shapes

Four named radii plus the pill: Control (12px) for inputs, method and role options, lesson rows and quiet notes; Sheet (16px) for cards, the seal, the mobile course cover and the video placeholder; Window (24px) for covers, the modal, the chat input and chat bubbles; Tail (4px) for the one corner of a speech bubble that points at its author (bottom-right for the student, top-left for the assistant and comments). Buttons, filters, chips, pills, citation chips and the user pill are full pills (999px). State circles, avatars, the brand disc and icon buttons are circles.

The recurring silhouette is the corner arcs: three concentric quarter-annulus bands (outer 200/172, middle 164/140, inner 132/118 in a 200 viewBox) clipped into the top-right corner of blush covers, the video placeholder, the welcome modal and the payment-success panel. Content pads right to clear them. Borders are 1px (1.5px on buttons, method options and the dashed OXXO box).

## Components

### Buttons
Confident red pills that say exactly what they do.
- **Shape:** full pill (999px), min-height 42px (34px small), 44px on touch.
- **Primary:** Merkatics Red fill, Sheet label, 700 at 15px, 9px 20px. One label per intent across the app (the membership CTA always reads "Unirme por $490 al mes").
- **Hover / Focus / Active:** hover deepens to Pressed Red; focus is a 2px red outline at 2px offset; active nudges down 1px. Disabled at 50% opacity.
- **Secondary:** transparent with a 1.5px red outline and Red Ink label; hover fills Red Wash.
- **Ghost:** Graphite label, no border; hover fills Shaded Sheet.
- **Icon button:** 42px red circle (send, continue arrow); the small variant is a transparent 30px circle for copy and dismiss.

### Chips
- **Filters:** Sheet pill with Strong Line outline and Graphite label; pressed state is Red Wash with red outline and Red Ink. On mobile they scroll in one row with snap.
- **Suggestions:** Sheet pill, Strong Line outline, Brand Black label; hover turns outline red and label Red Ink.
- **Pills (status):** 12px 700 pills on Shaded Sheet (neutral, "Gratis"), green (paid, "Miembro"), amber ("Pendiente de pago"), Red Wash ("De la coach"). The coach badge on posts is a Red Wash pill.

### Cards / Containers
- **Corner Style:** Sheet (16px).
- **Background:** Sheet on Stone Ground.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px Hairline; a pinned post tints its border 35% toward red.
- **Internal Padding:** 20px 22px.

### Inputs / Fields
- **Style:** Sheet fill, 1px Field Line, Control radius (12px), 10px 14px, min 44px, 16px text to avoid mobile zoom. Labels are 13px 700 Graphite above the field. The quick-question input is a pill.
- **Focus:** border and a 2px outline both turn Merkatics Red.
- **Error:** Error Red text on its wash in a 12px-radius note.
- **Options:** payment methods and welcome roles are 1.5px outlined Control boxes with a native radio; selected is red outline on Red Wash.

### Navigation
- **Top bar:** Sheet background with a bottom hairline, sticky. Brand disc (38px red circle with initials) and name at left; nav links 600 Graphite with a Phosphor icon; the active section turns Brand Black, its icon Red Ink, with a 3px red underline rounded on top. Membership CTA and user pill at right.
- **Mobile (760px and below):** the nav becomes a fixed bottom bar of equal columns (66px, Sheet, top hairline), icon over 12px label, active in Red Ink with a 36px red bar at the top edge. The header keeps brand and user only.

### Cover (portada)
Blush field at Window radius (24px) with the corner arcs; title in Display and supporting text in Blush Ink. The course cover adds a Sheet progress panel (16px radius): a Cifra destacada count, a coral progress bar on a Shaded Sheet track, the next lesson, and the primary Continue button.

### Lesson rows
Rows at Control radius inside the module card, hover to Shaded Sheet. A 36px state circle leads each row: open is Red Wash with a red filled play, done is Success Green with a white-on-green check, locked is Shaded Sheet with a Graphite lock and a Graphite title. The module label ("Módulo 1") sits inline in Red Ink before the title.

### Citation chips
Red Wash pills linking a claim to its lesson: a mono lesson id in a Sheet capsule, then the lesson title truncated at 22ch. Hover fills red. The locked variant is Shaded Sheet with a lock icon and hovers to Brand Black; paid content is marked, never given away.

### OXXO ficha
A 1.5px dashed Strong Line box (12px radius) with the amount in Cifra destacada, the reference in grouped mono, and a small copy icon button beside it; headed by the "Pendiente de pago" amber pill and followed by numbered steps with Red Ink markers.

### Completion seal
A green-wash sheet (16px) with a SealCheck icon and a Headline title in Success Ink. It is the one authored motion: the icon stamps in once when the student marks the lesson (scale 1.5 and -18deg to rest, 0.5s cubic-bezier(0.16, 1, 0.3, 1)), only under `prefers-reduced-motion: no-preference`, never on revisit.

### Chat
The student's message is a Deep Blush bubble (Window radius, 4px tail bottom-right, max 80% width); the assistant's answer is a Sheet card with a hairline (Window radius, 4px tail top-left), a Red Ink author label, inline citation chips and a hairline-separated action row. The input is a 24px-radius Sheet container with a Field Line border and a 42px red send button, docked at the bottom over a Stone Ground band (above the bottom nav on mobile). Waiting shows three coral dots.

### Coach stat row
One bordered sheet holding a definition list in an auto-fit grid (min 150px): Caption labels in Graphite over tabular Headline figures in Red Hat Display. Every figure uses the same scale; none is promoted.

## Do's and Don'ts

### Do:
- **Do** fill actions with Merkatics Red (#c6443f) and write red text in Red Ink (#b03a35).
- **Do** mark identity with Blush fields (#fceeeb) and the corner arcs, and set secondary text on blush in Blush Ink (#74504b).
- **Do** keep every surface light in the light theme: Stone Ground, Sheet and Shaded Sheet.
- **Do** separate with 1px hairlines and tonal fields; reserve cards for real objects.
- **Do** use one CTA label per intent, the same everywhere ("Unirme por $490 al mes").
- **Do** set compared or summed numbers in tabular figures, one scale per kind.
- **Do** use Phosphor icons only, one family, regular weight by default.
- **Do** keep touch targets at 44px or more under `pointer: coarse`, and move navigation to the bottom bar at 760px.
- **Do** gate every animation behind `prefers-reduced-motion`.

### Don't:
- **Don't** use brand black for bars, frames, panels or placeholders; it is text only.
- **Don't** use red as a field, heading color or decoration; don't use green outside completed or paid, or amber outside pending payment.
- **Don't** add shadows, blur or glass.
- **Don't** use pure #fff or #000.
- **Don't** use Futura or Caros in the interface; they are reserved for the logo, which is not redrawn.
- **Don't** set anything but lesson ids, the OXXO reference and the CLABE in monospace.
- **Don't** use em-dashes in UI copy, or more than one middle dot per line.
- **Don't** add a second authored motion moment beside the completion seal.
