---
name: Merkatics · Cursos y comunidades
description: Plataforma de cursos, comunidad y asistente de IA de Merkatics, con el manual de marca "Growth Operating System" llevado a una interfaz clara y sobria.
colors:
  coral: "#e2554f"
  coral-dark: "#c73f39"
  coral-darker: "#a8332e"
  graphite: "#111111"
  dark-gray: "#333333"
  gray: "#757575"
  white: "#ffffff"
  light-1: "#f7f7f7"
  light-2: "#f1f1f1"
  border: "#e5e5e5"
  border-strong: "#bdbdbd"
  error: "#c73f39"
  error-bg: "#fbeae9"
  focus-ring: "#333333"
typography:
  display:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.125rem, 1.3rem + 2.8vw, 3.625rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  precio:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.2rem, 1.6rem + 2vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.05
    fontFeature: "\"tnum\""
  boton:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  small:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
  label:
    fontFamily: "Montserrat, ui-sans-serif, system-ui, sans-serif"
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
components:
  button-primary:
    backgroundColor: "{colors.coral-dark}"
    textColor: "{colors.white}"
    typography: "{typography.boton}"
    rounded: "{rounded.pildora}"
    height: "42px"
  button-primary-hover:
    backgroundColor: "{colors.coral-darker}"
  button-secondary:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.white}"
    rounded: "{rounded.pildora}"
  button-outline:
    backgroundColor: "{colors.white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.pildora}"
  button-disabled:
    backgroundColor: "{colors.light-1}"
    textColor: "{colors.gray}"
  selected:
    backgroundColor: "{colors.white}"
    textColor: "{colors.graphite}"
  pill:
    backgroundColor: "{colors.light-1}"
    textColor: "{colors.dark-gray}"
    typography: "{typography.label}"
    rounded: "{rounded.pildora}"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.hoja}"
    padding: "20px 22px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.control}"
    height: "44px"
  cover-placeholder:
    backgroundColor: "{colors.light-1}"
    textColor: "{colors.coral}"
  dark-section:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.white}"
  error-message:
    backgroundColor: "{colors.error-bg}"
    textColor: "{colors.coral-darker}"
---

# Design System: Merkatics · Cursos y comunidades

## Overview

**Creative North Star: "Crecimiento medible, con calma"**

The Merkatics brand manual ("Growth Operating System") applied to a learning product: a pale gray ground, white sheets, graphite text and a single coral accent that marks growth, choice and action. The manual's moodboard (graphite surfaces, a coral arrow rising) appears only where it earns attention: the coach invitation, the footer, video posters and the share image. Everything else stays light and quiet so lessons and conversations read easily on a phone in daylight.

Coral is an accent, never a field: about 10–20% of a screen. It lives in icons, progress bars, the border of what is selected, the keyword of a large title and primary buttons (in its darker tone, for contrast). There are no pink fields; the only pink is the error background.

**Key Characteristics:**
- Pale gray ground (light-2), white sheets with 1px borders, graphite text.
- Coral as accent; coral-dark on primary buttons; coral-darker for text in coral.
- Graphite dark sections for the coach invitation and the footer, with the white logo.
- Montserrat to command (titles, buttons, labels), Inter to read; IBM Plex Mono for references.
- Pill buttons and chips; 12 / 16 / 24px corners for controls, sheets and windows.
- Real photos as course and community covers; without a photo, a light sheet with the topic icon in coral.

## Colors

### Accent
- **Coral** (#e2554f): icons, progress and chart fills, the check marks of lists, the keyword of a large title, cover placeholder icons. Never text under 24px, never a background behind white text.
- **Coral Dark** (#c73f39): primary button fill, selected borders (2px), the active nav underline, solid "done" circles.
- **Coral Darker** (#a8332e): button hover, and every text set in coral (links, labels, citation chips, error text). It passes 4.5:1 on white and on light-2.

### Neutrals
- **Graphite** (#111111): headings and body text; dark sections (coach invitation, footer); secondary buttons.
- **Dark Gray** (#333333): secondary text, the focus ring, metadata that sits on the gray ground.
- **Gray** (#757575): metadata on white sheets only (it falls below 4.5:1 on light-2), disabled button text.
- **White** (#ffffff): sheets, cards, the top bar, inputs, selected options.
- **Light 1** (#f7f7f7): quiet fields (cover placeholders, notices, chat dock, disabled buttons).
- **Light 2** (#f1f1f1): page background.
- **Border** (#e5e5e5) and **Border Strong** (#bdbdbd): hairlines, outlines of chips and options; Border Strong is also paragraph text on graphite.

### States
- **Error** (#c73f39 border) with **Error Background** (#fbeae9) and coral-darker text: only error messages and invalid fields (`aria-invalid="true"`).
- **Focus**: 2px Dark Gray outline, 2px offset; never coral, so focus is never mistaken for an error.

### Named Rules
**The Accent Not Field Rule.** Coral marks; it never fills a section. Selected = white sheet, 2px coral-dark border, graphite text.

**The Contrast Rule.** No white text on coral (#e2554f). Text in coral uses coral-darker; text on the gray ground is graphite or dark gray.

**The Palette Only Rule.** Only the manual's colors appear in the interface. The single exception is the error background.

## Typography

**Display Font:** Montserrat 600 / 700 / 800 (`--font-display`)
**Body Font:** Inter 400 / 500 / 600 (`--font-body`)
**Mono Font:** IBM Plex Mono 400 / 500 (`--font-mono`), for lesson ids, references and amounts.

h1–h4 are Montserrat 700 with -0.02em tracking. Buttons, labels and pills use Montserrat; reading text (lessons, posts, the assistant) uses Inter at 17px / 1.6. Large titles may set their final keyword in coral, as the manual does with "Resultados." ("un solo lugar." on the visitor page).

## Layout

A centered container (20px gutters, 16px on mobile) under a sticky top bar. On mobile the app nav moves to a bottom bar; the lesson page hides it so only the Complete / Next bar remains, padded with the safe area. The visitor page uses a hamburger menu below 768px.

- **Community:** a presentation card on top (gallery, data row, "Acerca de" and "Qué obtienes"), then the feed; the course list sits in a 320px sidebar on desktop and in a horizontal row above the feed on mobile.
- **Lesson:** sticky index plus content; the action bar is fixed to the bottom.
- **Coach panel:** a community / course selector on top; everything below follows it.

## Elevation & Depth

Mostly flat: sheets separate from the ground by tone and a 1px border. Two soft shadows exist, both `rgb(17 17 17 / 8%)`: the fixed lesson action bar and the mobile menu panel.

## Shapes

Control 12px (inputs, options, lesson rows), Sheet 16px (cards), Window 24px (covers, modal, chat), Tail 4px (speech-bubble corner). Buttons, filters, chips and pills are full pills. Icon badges (44px, 12px radius, white with a 1px border and a coral icon) follow the manual's "badge" variant.

## Components

### Buttons
Primary: coral-dark pill with white Montserrat 700 text, hover coral-darker. Secondary: graphite pill. Outline: white with a strong border and graphite text (OXXO slip actions). Disabled: light-1 fill, gray text, `cursor: not-allowed`; when the lesson buttons are disabled the bar says why ("Termina el video para continuar").

### Selection
Filters, course tabs, role and payment options, quiz options and the current lesson share one selected state: white, 2px coral-dark border (inset shadow), graphite text.

### Covers
Photos where they exist (public/portadas, with a focal point per photo); otherwise a light-1 sheet with the topic icon (Phosphor, regular) in coral. Video posters are graphite with the lesson label in coral, the title in white and the rising coral arrow.

### Dark sections
The coach invitation and the footer: graphite background, white headings, Border Strong paragraphs, coral checks, coral-dark CTA. The footer carries the white logo, Términos / Privacidad / Contacto and the copyright.

### Assistant answers
Citations do not repeat in the text: each lesson appears once in a "Fuentes" block at the end, with its full title.

### OXXO slip
Amount, grouped reference, due date, a Code 128 barcode of the reference, and "Descargar ficha" (prints only the slip) / "Compartir por WhatsApp". The demo notice stays visible.

## Do's and Don'ts

### Do:
- **Do** keep coral to accents and use coral-dark for buttons, coral-darker for text.
- **Do** put links in graphite when they sit on the gray ground.
- **Do** give every cover a photo or the topic placeholder; never an empty colored box.

### Don't:
- **Don't** use pink fields, white text on coral, or gray metadata on the gray ground.
- **Don't** style focus like an error; errors are only `aria-invalid` plus the error message.
- **Don't** introduce colors outside the manual's palette.
