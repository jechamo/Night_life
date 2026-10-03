# Imágenes

Catálogo integrado el 2026-10-03: **46 imágenes nuevas** y las cinco existentes conservadas.
Generación mediante `image_gen` integrado a partir de `docs/design/IMAGE_PROMPTS.md`.
PNG en `docs/design/generated/`; `manifest.json` conserva el prompt final y sus variantes.

| Carpeta         | Recursos                                             | Anchos WebP     |
| --------------- | ---------------------------------------------------- | --------------- |
| `themes`        | 5 fondos de temas                                    | 640, 1080       |
| `maps`          | 2 mapas ficticios, vertical y horizontal             | 640, 1080       |
| `illustrations` | 3 estados vacíos nuevos + 3 ilustraciones existentes | 320, 640        |
| `venues`        | 8 tipos de locales                                   | 640, 1080, 1600 |
| `events`        | 3 portadas de eventos                                | 640, 1080, 1600 |
| `avatars`       | 24 adultos ficticios de estilo 3D ilustrado          | 320, 640        |
| `brand`         | Imagen social, también en `public/og-share.webp`     | 640, 1080, 1600 |
| `onboarding`    | 2 escenas existentes                                 | 640, 1080       |

Escenas neutras tintadas por tema; locales, eventos y avatares conservan el color.
WebP calidad 80 sin EXIF/GPS, `srcSet`, tamaños explícitos y carga diferida;
la primera imagen de bienvenida tiene prioridad. El service worker no precarga WebP.

Reprocesar: `node scripts/process-images.mjs`, con Sharp en el entorno de desarrollo.
`IMAGE_SHARP_MODULE` permite indicar su ruta. No añade dependencias a la app.
El logo opcional no se genera: se conserva la marca existente.

## Recursos anteriores

Generadas con GPT a partir de `docs/design/IMAGE_PROMPTS.md` y procesadas así:
WebP calidad 80, **sin metadatos** (`-strip`, sin EXIF/GPS), en escala de grises para que la
app las tiña con los colores del tema activo, y en dos anchos para `srcset`.

| Archivo                                  | Tipo                               | Anchos    | Uso previsto                                           |
| ---------------------------------------- | ---------------------------------- | --------- | ------------------------------------------------------ |
| `illustrations/illu-verification-*.webp` | Neutra tintable (fondo negro puro) | 320, 640  | Centro de verificación / "Verifica tu edad" (Bloque 2) |
| `illustrations/illu-phone-otp-*.webp`    | Neutra tintable (fondo negro puro) | 320, 640  | Paso Teléfono + OTP (Bloque 2)                         |
| `illustrations/illu-location-*.webp`     | Neutra tintable (fondo negro puro) | 320, 640  | Consentimiento de ubicación (Bloque 2)                 |
| `onboarding/onboarding-connect-*.webp`   | Neutra tintable (escena)           | 640, 1080 | Bienvenida, pantalla "conoce gente" (Bloque 2)         |
| `onboarding/onboarding-safe-*.webp`      | Neutra tintable (escena)           | 640, 1080 | Bienvenida, pantalla "segura" (Bloque 2)               |

Las ilustraciones tienen fondo negro puro: se muestran con `mix-blend-mode: screen` sobre el
brillo del color del tema, así el negro desaparece en los 5 temas.
