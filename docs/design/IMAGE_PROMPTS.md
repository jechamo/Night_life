# Prompts de imágenes (GPT) — Nightlife Connect

Fuente única de los prompts para que todas las imágenes compartan estilo. Se generan en PNG
con ChatGPT y Claude las convierte a WebP (varios tamaños, sin metadatos EXIF) y las integra.

## Reglas

- **Nunca fotos realistas de personas** (PRD 6.14): las personas solo como ilustración
  (avatares) o como siluetas desenfocadas de espaldas, sin caras.
- Sin texto, letras, logos ni marcas en la imagen (los textos van traducidos en la app).
- Sin locales ni monumentos reconocibles.
- Zonas oscuras y despejadas donde irá texto encima (contraste AA).
- Tamaños de ChatGPT: vertical **1024×1536** (2:3), horizontal **1536×1024** (3:2), cuadrada **1024×1024**.
- Generarlas todas en la **misma conversación** y pegar primero el bloque de estilo.

## Bloque de estilo — fotografía / escenas (pegar al empezar)

```
For every image in this conversation use this art direction:
cinematic premium nightlife mood, shot at night, deep near-black shadows (#07060D),
light accents in soft violet (#A78BFA) and cyan (#22D3EE) with a gentle glow, subtle film
grain, shallow depth of field, elegant and restrained — no harsh neon overload, no rainbow
gradients. Generic Spanish/Mediterranean city, no recognizable landmarks or real venues.
No text, letters, logos, watermarks or brand names anywhere. No recognizable people and no
faces: people may only appear as out-of-focus silhouettes seen from behind.
```

## Bloque de estilo — ilustraciones (avatares, conceptos)

```
For every illustration in this conversation use this art direction:
modern soft 3D illustration, matte clay-like materials, rounded friendly shapes, clearly
illustrated (never photorealistic), deep near-black background (#07060D), violet (#A78BFA)
and cyan (#22D3EE) accents with a soft glow, minimal composition, generous negative space.
No text, letters, logos or watermarks.
```

---

## A · Bloque 2 — Onboarding

| Archivo                    | Formato                 | Prompt                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `welcome-1-map.png`        | 1024×1536               | Aerial night view of a dense Mediterranean city from a high tilted drone angle, like a living 3D map. The city is dark and moody; a few squares and streets glow with small clusters of warm light points, as if showing where people are tonight, each busy spot wrapped in a soft violet and cyan halo. The lower 40% of the image fades into deep black, empty, for text overlay. |
| `welcome-2-connect.png`    | 1024×1536               | Close-up of two hands clinking cocktail glasses on a rooftop terrace at night, city lights as soft bokeh behind, violet and cyan reflections on the glass, warm and inviting. No faces. Lower 40% dark and calm for text overlay.                                                                                                                                                    |
| `welcome-3-safe.png`       | 1024×1536               | Quiet old-town street at night after rain, warm street lamps, wet cobblestones reflecting soft violet and cyan light, a sense of calm and safety, nobody in the street. Lower 40% dark for text overlay.                                                                                                                                                                             |
| `verification-shield.png`  | 1024×1024 · ilustración | A shield with a check mark merging with a minimal face-scan frame made of four corner brackets around an empty abstract silhouette (no facial features), small floating lock and sparkle details, conveying "we verify, we don't store".                                                                                                                                             |
| `phone-otp.png` (opcional) | 1024×1024 · ilustración | A floating smartphone seen at a slight angle, its screen showing six glowing dots in a row like a one-time code, a small speech bubble with a check mark beside it.                                                                                                                                                                                                                  |

> La pantalla de fecha de nacimiento y la de documentos legales van **sin imagen** a propósito
> (PRD 5.2: pantalla neutra; legal limpio y legible).

## B · Bloque 3 — Datos simulados

### Mapa simulado (hasta que llegue Mapbox en el Bloque 7)

| Archivo                  | Formato   | Prompt                                                                                                                                                                                                                                                                                                  |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `map-mock-portrait.png`  | 1024×1536 | Tilted top-down 3D night map of a fictional Mediterranean city district: dark charcoal building blocks with faint violet edge lighting, thin cyan street lines, a plaza and a seafront promenade, very low contrast overall so UI pins placed on top stand out. No labels, no text, no pins, no people. |
| `map-mock-landscape.png` | 1536×1024 | Same as above, landscape framing (for desktop).                                                                                                                                                                                                                                                         |

### Portadas de locales (una por tipo) — 1536×1024

Plantilla:

```
Interior of a {TIPO} at night, {DETALLES}. Empty, or with only out-of-focus silhouettes seen
from behind far in the background. Leave the bottom third darker for text overlay.
```

| Archivo                | {TIPO}                   | {DETALLES}                                                               |
| ---------------------- | ------------------------ | ------------------------------------------------------------------------ |
| `venue-nightclub.png`  | large nightclub          | dance floor seen from the DJ booth, haze, light beams in violet and cyan |
| `venue-club.png`       | intimate techno club     | raw concrete walls, low ceiling, strobe accents, dense haze              |
| `venue-pub.png`        | cozy pub                 | dark wooden bar, beer taps, warm amber lights, leather stools            |
| `venue-bar.png`        | modern cocktail bar      | backlit bottle shelves, amber glow, a crafted cocktail in the foreground |
| `venue-dive-bar.png`   | small underground bar    | brick walls, a red accent light, vinyl records, slightly gritty          |
| `venue-lounge.png`     | elegant lounge           | velvet sofas, gold accents, low warm light, candles on small tables      |
| `venue-terrace.png`    | rooftop terrace          | string lights, plants, city skyline bokeh, orange accent lights          |
| `venue-beach-club.png` | Mediterranean beach club | daybeds, lanterns, turquoise pool lights, dark sea and horizon           |

### Portadas de eventos — 1536×1024

| Archivo              | Prompt                                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `event-concert.png`  | Live concert seen from the crowd, stage lights cutting through haze, raised hands as dark silhouettes in the foreground, magenta (#E879F9) and violet light. No faces. |
| `event-techno.png`   | Warehouse techno party, industrial space, haze, a single wide magenta and cyan light beam, silhouettes from behind far away.                                           |
| `event-open-air.png` | Open-air summer night party in a plaza, festoon lights, paper lanterns, warm magenta and orange glow, blurry silhouettes from behind.                                  |

### Estados vacíos (opcional) — 1024×1024 · ilustración

| Archivo              | Prompt                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `empty-seen-all.png` | A small group of floating profile cards fanned out and gently fading away, with a tiny glowing map pin beside them, meaning "you've seen everyone here". |
| `empty-chats.png`    | Two speech bubbles floating apart with a soft glowing spark between them, waiting to connect.                                                            |
| `empty-events.png`   | A calendar page curling up into a little party popper with a few confetti pieces.                                                                        |

## C · Bloque 5 — Avatares ilustrados para perfiles de prueba (`is_test`) — 1024×1024

Usar el bloque de estilo de ilustraciones. Plantilla:

```
Shoulders-up illustrated portrait avatar of {PERSONA}, friendly relaxed expression, fully
clothed in {ROPA}, facing slightly to the side, soft rim light in violet and cyan, plain
dark background. Clearly an illustration, not a photo.
```

| Archivo         | {PERSONA}                                             | {ROPA}                                        |
| --------------- | ----------------------------------------------------- | --------------------------------------------- |
| `avatar-01.png` | a woman in her early 20s with curly dark hair         | a denim jacket                                |
| `avatar-02.png` | a man in his early 20s with a buzz cut                | an oversized hoodie                           |
| `avatar-03.png` | a non-binary person in their 20s with dyed lilac hair | a mesh top under a black jacket               |
| `avatar-04.png` | a woman in her late 20s with a sleek black bob        | a satin shirt                                 |
| `avatar-05.png` | a man in his late 20s with a short beard              | a linen shirt                                 |
| `avatar-06.png` | a woman around 30 with braided hair                   | a leather jacket                              |
| `avatar-07.png` | a man around 30 with glasses                          | a black t-shirt                               |
| `avatar-08.png` | a woman in her early 30s with short red hair          | a turtleneck                                  |
| `avatar-09.png` | a man in his early 30s with long wavy hair tied back  | a bomber jacket                               |
| `avatar-10.png` | a woman in her mid 30s with a wavy blond lob          | a blazer                                      |
| `avatar-11.png` | a man in his mid 30s with a shaved head               | a knit polo                                   |
| `avatar-12.png` | a non-binary person in their 30s with a mullet        | a vintage band-style t-shirt without any text |
| `avatar-13.png` | a woman around 40 with silver-streaked hair           | a silk scarf and dark top                     |
| `avatar-14.png` | a man around 40 with salt-and-pepper stubble          | an open-collar shirt                          |
| `avatar-15.png` | a woman in her early 40s with an afro                 | gold hoop earrings and a black dress          |
| `avatar-16.png` | a man in his early 40s with curly hair                | a cardigan                                    |
| `avatar-17.png` | a woman in her mid 40s with a pixie cut               | a structured jacket                           |
| `avatar-18.png` | a man in his mid 40s with a neat beard and glasses    | a dark suit jacket, no tie                    |
| `avatar-19.png` | a woman around 50 with long grey hair                 | a velvet top                                  |
| `avatar-20.png` | a man around 50 with a grey beard                     | a navy overshirt                              |
| `avatar-21.png` | a woman in her mid 50s with short silver hair         | statement earrings and a black blouse         |
| `avatar-22.png` | a man in his mid 50s, bald, with a warm smile         | a knit sweater                                |
| `avatar-23.png` | a woman around 60 with an elegant updo                | a burgundy jacket                             |
| `avatar-24.png` | a man around 60 with white hair                       | a linen blazer                                |

## D · Marca y compartir

| Archivo                        | Formato                 | Prompt                                                                                                                                                                                                                                                               |
| ------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `og-share.png`                 | 1536×1024               | Wide cinematic aerial night view of a Mediterranean city with a few glowing violet and cyan "live" hotspots, a large calm dark area on the left third for the app name (added later in code).                                                                        |
| `logo-concepts.png` (opcional) | 1024×1024 · ilustración | Four minimal app-icon concepts on a 2×2 grid for a nightlife app called "Nightlife Connect": combinations of a crescent moon, a map pin and a live pulse dot, flat vector style, violet-to-cyan gradient on near-black, no text. (El logo final se redibuja en SVG.) |

## Entrega

Sube los PNG al chat con estos nombres (no hace falta todo a la vez: primero la sección A).
Claude los convierte a WebP (640/1080/1600 px de ancho según uso, calidad ~80, sin EXIF),
comprueba el contraste del texto que vaya encima y los carga de forma diferida.
