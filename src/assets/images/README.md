# Imágenes

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
