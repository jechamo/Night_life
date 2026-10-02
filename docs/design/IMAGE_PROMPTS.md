# Prompts de imágenes (GPT) — Nightlife Connect

Fuente única de los prompts para que todas las imágenes compartan estilo **y funcionen en los
5 temas** (Neon Noir, Cyberpunk, Velvet, Sunset, Mono). Se generan en PNG con ChatGPT y Claude
las convierte a WebP (varios tamaños, sin metadatos EXIF) y las integra.

## Tres tipos de imagen

| Tipo                     | Qué es                                                           | Color                              | Cómo se adapta al tema                                                                           |
| ------------------------ | ---------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| **1. Firma de tema**     | Una imagen ambiente por tema (5)                                 | La paleta de **su** tema           | Se muestra la del tema activo: bienvenida, tarjetas del selector de temas, cabeceras             |
| **2. Neutras tintables** | Ilustraciones, mapa simulado, escenas secundarias del onboarding | **Sin color** (grises sobre negro) | La app las tiñe con los colores del tema activo (duotono/brillo por CSS). En Mono quedan en gris |
| **3. Contenido**         | Locales, eventos, avatares de prueba                             | Color **natural**                  | No cambian con el tema, igual que las fotos reales de Google Places o de los usuarios            |

## Reglas para todas

- **Nunca fotos realistas de personas** (PRD 6.14): las personas solo como ilustración
  (avatares) o como siluetas desenfocadas de espaldas, sin caras.
- Sin texto, letras, rótulos legibles, logos ni marcas (los textos van traducidos en la app).
- Sin locales ni monumentos reconocibles.
- Zonas oscuras y despejadas donde irá texto encima (contraste AA).
- Tamaños: vertical **1024×1536** (2:3), horizontal **1536×1024** (3:2), cuadrada **1024×1024**.
- Generarlas en la **misma conversación** y pegar primero el bloque base.

## Bloque base (pegar al empezar la conversación)

```
For every image in this conversation:
cinematic premium nightlife photography quality, shot at night, deep shadows, subtle film
grain, shallow depth of field, elegant and restrained, never cheesy. Generic Spanish /
Mediterranean setting, no recognizable landmarks or real venues. No text, letters, readable
signs, logos, watermarks or brand names anywhere. No recognizable people and no faces: people
may only appear as out-of-focus silhouettes seen from behind. I will tell you the colour
palette in each prompt; when I say "monochrome", use neutral greys only, no colour at all.
```

---

## 1 · Firmas de tema — 1024×1536 (opcional: versión 1536×1024 para escritorio)

Se usan en la bienvenida (la del tema activo; por defecto Neon Noir), en las tarjetas del
selector de temas y como cabecera ambiente.

| Archivo               | Prompt                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `theme-neon-noir.png` | Aerial night view of a dense Mediterranean city from a high tilted drone angle, like a living 3D map; a few squares glow with clusters of small warm light points wrapped in soft halos, as if showing where people are tonight. Palette: deep black (#07060D), soft violet (#A78BFA) and cyan (#22D3EE) glow, subtle glassy reflections. Mood: sleek, calm, premium. The lower 40% fades into deep black, empty, for text. |
| `theme-cyberpunk.png` | Narrow city alley at night in the rain, reflections on wet asphalt, light steam, distant silhouettes from behind walking towards a club entrance, subtle digital glitch artifacts and scanlines only at the edges, no readable signs. Palette: near-black (#0A0A12), hot magenta (#FF2BD6), acid yellow (#E6FF00) and electric cyan (#00F0FF). Mood: energetic, young, techno. The lower 40% stays dark for text.           |
| `theme-velvet.png`    | Intimate cocktail lounge detail at night: a deep burgundy velvet armchair, brass and gold details, a crystal coupe with a cocktail on a marble table, candlelight and soft bokeh. Palette: warm black (#0E0809), burgundy (#9F2B45), gold (#D4AF37), cream highlights. Mood: elegant, mature, unhurried, sophisticated. The lower 40% stays dark for text.                                                                  |
| `theme-sunset.png`    | Rooftop terrace over a Mediterranean seaside town at the very end of sunset, string lights, plants, two drinks on a ledge, the sky fading from orange and pink into deep night blue over the sea. Palette: night blue (#0B1026), orange (#FF8A5B), pink (#FF6FA5), warm highlights. Mood: summer, relaxed, warm. The lower 40% stays dark for text.                                                                         |
| `theme-mono.png`      | High-contrast black-and-white night street photography: a long empty street with a single pool of light under a street lamp, crisp shadows, strong graphic composition. Monochrome, no colour at all. Mood: minimal, clear, calm. The lower 40% stays dark for text.                                                                                                                                                        |

## 2 · Neutras tintables

### Escenas del onboarding — 1024×1536

| Archivo                  | Prompt                                                                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onboarding-connect.png` | Close-up of two hands clinking cocktail glasses on a rooftop at night, city lights as soft bokeh behind. Monochrome, neutral greys only. No faces. The lower 40% stays dark for text.                                |
| `onboarding-safe.png`    | Quiet old-town street at night after rain, street lamps, wet cobblestones reflecting the light, nobody in the street, a sense of calm and safety. Monochrome, neutral greys only. The lower 40% stays dark for text. |

### Mapa simulado (solo hasta que llegue Mapbox en el Bloque 7)

| Archivo                  | Formato   | Prompt                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `map-mock-portrait.png`  | 1024×1536 | Tilted top-down 3D night map of a fictional Mediterranean city district: dark building blocks with faint light-grey edges, thin light street lines, a plaza and a seafront promenade, very low contrast overall so UI pins placed on top stand out. Monochrome, neutral greys on black. No labels, no text, no pins, no people. |
| `map-mock-landscape.png` | 1536×1024 | Same as above, landscape framing (desktop).                                                                                                                                                                                                                                                                                     |

### Ilustraciones — 1024×1024

Plantilla (la app pone el brillo de color del tema detrás):

```
Soft 3D clay illustration of {CONCEPTO}. Pearl-white and light-grey matte materials only,
monochrome, no colour, rounded friendly shapes, minimal composition, centred with generous
empty space, on a pure black background (#000000). Clearly an illustration, not a photo.
```

| Archivo                   | {CONCEPTO}                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `illu-verification.png`   | a shield with a check mark merging with a minimal face-scan frame made of four corner brackets around an empty abstract silhouette (no facial features), a small floating lock, meaning "we verify, we don't store" |
| `illu-phone-otp.png`      | a floating smartphone at a slight angle whose screen shows six glowing dots in a row like a one-time code, a small speech bubble with a check mark beside it                                                        |
| `illu-location.png`       | a map pin hovering over a small folded map with a soft pulse ring around it                                                                                                                                         |
| `illu-empty-seen-all.png` | a few floating profile cards fanned out and gently fading away, with a tiny map pin beside them                                                                                                                     |
| `illu-empty-chats.png`    | two speech bubbles floating apart with a small spark between them, waiting to connect                                                                                                                               |
| `illu-empty-events.png`   | a calendar page curling up into a little party popper with a few confetti pieces                                                                                                                                    |

## 3 · Contenido (color natural, no cambia con el tema)

### Portadas de locales — 1536×1024

Plantilla:

```
Interior of a {TIPO} at night, {DETALLES}. Natural, realistic venue lighting. Empty, or with
only out-of-focus silhouettes seen from behind far in the background. Leave the bottom third
darker for text overlay.
```

| Archivo                | {TIPO}                   | {DETALLES}                                                               |
| ---------------------- | ------------------------ | ------------------------------------------------------------------------ |
| `venue-nightclub.png`  | large nightclub          | dance floor seen from the DJ booth, haze, colourful light beams          |
| `venue-club.png`       | intimate techno club     | raw concrete walls, low ceiling, strobe accents, dense haze              |
| `venue-pub.png`        | cozy pub                 | dark wooden bar, beer taps, warm amber lights, leather stools            |
| `venue-bar.png`        | modern cocktail bar      | backlit bottle shelves, amber glow, a crafted cocktail in the foreground |
| `venue-dive-bar.png`   | small underground bar    | brick walls, a red accent light, vinyl records, slightly gritty          |
| `venue-lounge.png`     | elegant lounge           | velvet sofas, gold accents, low warm light, candles on small tables      |
| `venue-terrace.png`    | rooftop terrace          | string lights, plants, city skyline bokeh                                |
| `venue-beach-club.png` | Mediterranean beach club | daybeds, lanterns, turquoise pool lights, dark sea and horizon           |

### Portadas de eventos — 1536×1024

| Archivo              | Prompt                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `event-concert.png`  | Live concert seen from the crowd, stage lights cutting through haze, raised hands as dark silhouettes in the foreground. No faces. |
| `event-techno.png`   | Warehouse techno party, industrial space, haze, a single wide light beam, silhouettes from behind far away.                        |
| `event-open-air.png` | Open-air summer night party in a plaza, festoon lights, paper lanterns, warm glow, blurry silhouettes from behind.                 |

### Avatares ilustrados para perfiles de prueba (`is_test`, Bloque 5) — 1024×1024

Son "fotos de perfil" de prueba: color natural y fondo neutro para que no dependan del tema.

```
Shoulders-up illustrated portrait avatar of {PERSONA}, friendly relaxed expression, fully
clothed in {ROPA}, facing slightly to the side, soft studio light, plain mid-grey background,
natural colours. Soft 3D illustration style, clearly not a photo.
```

| Archivo         | {PERSONA}                                             | {ROPA}                                |
| --------------- | ----------------------------------------------------- | ------------------------------------- |
| `avatar-01.png` | a woman in her early 20s with curly dark hair         | a denim jacket                        |
| `avatar-02.png` | a man in his early 20s with a buzz cut                | an oversized hoodie                   |
| `avatar-03.png` | a non-binary person in their 20s with dyed lilac hair | a mesh top under a black jacket       |
| `avatar-04.png` | a woman in her late 20s with a sleek black bob        | a satin shirt                         |
| `avatar-05.png` | a man in his late 20s with a short beard              | a linen shirt                         |
| `avatar-06.png` | a woman around 30 with braided hair                   | a leather jacket                      |
| `avatar-07.png` | a man around 30 with glasses                          | a black t-shirt                       |
| `avatar-08.png` | a woman in her early 30s with short red hair          | a turtleneck                          |
| `avatar-09.png` | a man in his early 30s with long wavy hair tied back  | a bomber jacket                       |
| `avatar-10.png` | a woman in her mid 30s with a wavy blond lob          | a blazer                              |
| `avatar-11.png` | a man in his mid 30s with a shaved head               | a knit polo                           |
| `avatar-12.png` | a non-binary person in their 30s with a mullet        | a plain vintage t-shirt               |
| `avatar-13.png` | a woman around 40 with silver-streaked hair           | a silk scarf and dark top             |
| `avatar-14.png` | a man around 40 with salt-and-pepper stubble          | an open-collar shirt                  |
| `avatar-15.png` | a woman in her early 40s with an afro                 | gold hoop earrings and a black dress  |
| `avatar-16.png` | a man in his early 40s with curly hair                | a cardigan                            |
| `avatar-17.png` | a woman in her mid 40s with a pixie cut               | a structured jacket                   |
| `avatar-18.png` | a man in his mid 40s with a neat beard and glasses    | a dark suit jacket, no tie            |
| `avatar-19.png` | a woman around 50 with long grey hair                 | a velvet top                          |
| `avatar-20.png` | a man around 50 with a grey beard                     | a navy overshirt                      |
| `avatar-21.png` | a woman in her mid 50s with short silver hair         | statement earrings and a black blouse |
| `avatar-22.png` | a man in his mid 50s, bald, with a warm smile         | a knit sweater                        |
| `avatar-23.png` | a woman around 60 with an elegant updo                | a burgundy jacket                     |
| `avatar-24.png` | a man around 60 with white hair                       | a linen blazer                        |

## Marca y compartir (cuando se quiera)

| Archivo                        | Formato   | Prompt                                                                                                                                                                                                                                                           |
| ------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `og-share.png`                 | 1536×1024 | Wide cinematic aerial night view of a Mediterranean city with a few glowing "live" hotspots, a large calm dark area on the left third for the app name (added later in code). Palette: deep black, soft violet (#A78BFA) and cyan (#22D3EE) — the brand default. |
| `logo-concepts.png` (opcional) | 1024×1024 | Four minimal app-icon concepts on a 2×2 grid for a nightlife app: combinations of a crescent moon, a map pin and a live pulse dot, flat vector style, on near-black, no text. (El logo final se redibuja en SVG y se colorea con cada tema.)                     |

## Prioridad y entrega

1. **Bloque 2:** las 5 firmas de tema, `onboarding-connect`, `onboarding-safe`,
   `illu-verification`, `illu-phone-otp` e `illu-location`.
2. **Bloque 3:** mapa simulado, locales, eventos y estados vacíos.
3. **Bloque 5:** avatares.

Sube los PNG al chat con estos nombres. Claude los convierte a WebP (640/1080/1600 px de
ancho según uso, calidad ~80, sin EXIF), comprueba el contraste del texto que vaya encima en
los 5 temas y los carga de forma diferida.
