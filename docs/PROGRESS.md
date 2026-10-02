# Progreso — Nightlife Connect

Registro por bloque (PRD 11.1): qué se hizo, decisiones, desviaciones y pendientes.
**No se pasa al siguiente bloque sin un OK explícito del propietario.**

| Bloque                                              | Estado                                       |
| --------------------------------------------------- | -------------------------------------------- |
| 1 – Cimientos, diseño y arquitectura                | ✅ Aprobado (OK del propietario, 2026-10-02) |
| 2 – Onboarding, legal y verificación (mock)         | ✅ Terminado, pendiente de OK                |
| 3 – App principal y experiencia de match (mock)     | ⏳                                           |
| 4 – Paneles, web pública y pantallas de pago (mock) | ⏳                                           |
| 5 – Backend base, legal y modo pruebas              | ⏳                                           |
| 6 – Verificaciones reales                           | ⏳                                           |
| 7 – Mapa, lugares, eventos y estadísticas reales    | ⏳                                           |
| 8 – Ligar, match en tiempo real y chat              | ⏳                                           |
| 9 – Seguridad, derechos, negocio y pagos en test    | ⏳                                           |
| 10 – Auditoría OWASP, pulido, PWA y QA              | ⏳                                           |

---

## Bloque 1 — Cimientos, diseño y arquitectura preparada (2026-10-02)

### Qué se hizo

- Proyecto React 19 + TypeScript 6 estricto + Vite 8 + Tailwind 4 + componentes estilo ShadCN/Radix.
- Estructura por funcionalidades (`src/features`, `src/shared`, `src/platform`, `src/i18n`, `src/mocks`).
- **Capa de plataforma** con 12 servicios (interfaz + implementación web) y estrategia de pagos
  (Stripe web / desactivado / tiendas futuras). ESLint prohíbe APIs del dispositivo fuera de ella.
- **Feature flags** (valores iniciales de 6.13, validación Zod por flag, fallo cerrado) y
  **entitlements** (`hasEntitlement`, `useEntitlement`), con mocks. Política del paywall pura y probada.
- **5 temas** (Neon Noir, Cyberpunk, Velvet, Sunset, Mono) como tokens generados desde TS, con
  contraste AA verificado por tests, acentos por tipo de lugar, estilo de mapa y heatmap por tema.
  Cambio instantáneo con View Transitions (fallback de opacidad) y _glitch_ breve en Cyberpunk.
- **Librería de movimiento:** tokens 150-400 ms, _springs_ con `visualDuration`, presets
  (fade, rise, scale, sello), "Reducir movimiento" (sistema, ajuste de la app o tema Mono).
- **Fuentes autoalojadas** (OFL): Inter, Space Grotesk, Unbounded, JetBrains Mono, Playfair Display.
- **Componentes base:** Button/ButtonLink, Chip con acento, Badge (verificado con sello, en directo,
  Aquí Ahora, Patrocinado, No confirmado), AnimatedCounter, LivePulse, BottomSheet con física de
  muelle, SegmentedControl, Switch, Skeleton, EmptyState animado, ScreenHeader, ListRow, Card/GlassCard.
- **Tab Bar** flotante de cristal (Descubre, Esta Noche, Chats, Perfil) con indicador animado.
- Pantallas: placeholders animados de las 4 pestañas, Perfil → Temas, Perfil → Ajustes
  (reducir movimiento, idioma ES/EN) y **Kit de componentes** (solo con `test_tools_enabled`).
- **PWA:** manifest, iconos (incl. _maskable_), _service worker_ solo para el _shell_.
- **i18n** ES/EN con claves tipadas; ningún texto fijo en componentes.
- Error Boundary por pantalla, pantalla 404, Result tipado en servicios.
- Vercel: `vercel.json` con SPA y cabeceras de seguridad.
- Docs: `PRD.md`, `ARCHITECTURE.md`, `API.md`, `SECURITY.md`, ADR 0001-0005, `CLAUDE.md`.

### Decisiones

Ver ADR 0001-0005. Las más relevantes:

- Desarrollo con Claude Code y hosting en **Vercel** en vez de Lovable (ADR 0002).
- TypeScript 6.0 (no 7.0) y Motion 13.5 (no 14.0) por compatibilidad/estabilidad.
- Temas en TS → CSS generado + tests de contraste AA.
- Paywall `visible` sin posibilidad de compra ⇒ "Próximamente".
- El tipo "bar" (no tiene acento en el PRD) usa un ámbar cercano al de "pub".

### Desviaciones

- El PRD menciona Lovable (Knowledge, escáner, scripts del editor): sustituido por `CLAUDE.md`,
  ESLint, `npm audit`, Security Advisors y auditoría de red con Playwright.
- Dependencias de desarrollo de las familias permitidas no listadas literalmente (ADR 0001).
- `paid_dm` se diseñará en el Bloque 9 (no es una ventaja recurrente).

### Hecho cuando

- ✅ Los 5 temas funcionan con animación (View Transitions + fallback; test de componente).
- ✅ Se respeta "reducir movimiento" (sistema, ajuste de la app y tema Mono; tests + Playwright).
- ✅ No hay CDNs externos (auditoría de red: 0 orígenes externos; fuentes/iconos autoalojados).
- ✅ Ningún componente accede directamente a las APIs del dispositivo (regla ESLint que rompe el build).

### Cómo probarlo

1. `npm ci && npm run dev` → http://localhost:5173
2. Perfil → Temas: cambia entre los 5 temas (Cyberpunk hace un _glitch_ breve).
3. Perfil → Ajustes: activa "Reducir movimiento" o el modo del sistema → solo fundidos; cambia el idioma.
4. Perfil → Kit de componentes: contadores, chips, badges (toca "Foto verificada" para el sello),
   selector, ficha con muelle (arrástrala hacia abajo) y estado de flags/entitlements.
5. `npm run check` (tipos, lint, formato y 136 tests) y `npm run build` (sin advertencias).

### Despliegue

- Vercel, proyecto `nightlife-connect` (equipo chaplications-projects): https://nightlife-connect-beige.vercel.app
- Protegido con Vercel Authentication (requiere sesión de Vercel) hasta el lanzamiento.
- Toolbar/feedback de Vercel desactivados (scripts de terceros, ADR 0002).
- Pendiente (propietario): conectar el repo en Vercel → Settings → Git para desplegar en cada push
  (el conector de Vercel usado no tiene permiso para enlazar GitHub).

### Puerta de seguridad

Ver `docs/SECURITY.md` → Bloque 1: sin hallazgos críticos ni altos.

### Pendiente / para el siguiente bloque

- Imágenes: el propietario genera con GPT las de `docs/design/IMAGE_PROMPTS.md` (firmas por tema, neutras tintables y contenido; prioridad 1 para el Bloque 2).

- Bloque 2: onboarding completo, firma legal, consentimientos y Centro de verificación (mock).
- Dudas abiertas para el propietario (ver respuesta del Bloque 1): proveedor SMS, contrato de Yoti,
  textos legales (abogado), dominio definitivo, datos de empresa.

---

## Bloque 2 — Onboarding, legal y verificación (mock) (2026-10-02)

### Qué se hizo

- **Bienvenida animada** (3 pantallas con gesto o botones): firma del tema activo (con _fallback_
  "ciudad en directo" mientras no haya imagen) y escenas neutras tintadas con el tema.
- **Onboarding completo** con máquina de estados pura y probada (PRD 5.2):
  1. Fecha de nacimiento en pantalla neutra (no muestra el límite de edad). Menor ⇒ no se crea
     cuenta ni se guarda nada.
  2. Documentos legales (Términos, Normas, Privacidad, versionados y legibles en ficha) con
     3 casillas **no premarcadas**, "Firmo y acepto" y "No acepto" igual de visible.
  3. Teléfono + OTP (prefijo, E.164, reenvío con cuenta atrás, errores tipados genéricos:
     número baneado, límite de SMS, código erróneo, demasiados intentos) y email opcional.
  4. Consentimientos (orientación con **firma** explícita art. 9, ubicación precisa con permiso
     del navegador, promociones LSSI, analítica), todos desactivados por defecto, con base legal
     y consecuencia; sin ubicación se elige ciudad.
  5. Perfil: 2-5 fotos **recodificadas en el dispositivo sin EXIF**, nombre, género, bio y
     Anthem (próximamente).
  6. Preferencias (solo con consentimiento de orientación): a quién y rango de edad 18-60+.
  7. Elegir tema → entrada en la app.
- **Información por capas** en cada formulario con enlace a la Política de Privacidad.
- **Centro de verificación** (teléfono, edad, foto, identidad) con estados simulados, revisión
  humana, aviso de IA y "nunca guardamos…".
- **Verificación de edad** (pantalla informativa + otro método), **foto** e **identidad** con
  consentimiento explícito, y **simulador del proveedor** (sandbox, solo testers).
- **Bloqueo "Verifica tu edad"** para ver perfiles, likes, chat, "Voy", check-in visible, crear
  eventos y promos de alcohol (probado desde Esta Noche).
- **Perfil → Consentimientos** para retirar o dar consentimientos igual de fácil.
- Herramienta de pruebas "Reiniciar onboarding".
- Imágenes de la sección 1 de `docs/design/IMAGE_PROMPTS.md` integradas (WebP, sin EXIF).

### Decisiones

Ver ADR 0006. Bio limitada a 300 caracteres (el PRD no fija límite). Prefijos de teléfono de
España y países vecinos de la UE.

### Desviaciones

- Las firmas de tema (5 imágenes) aún no existen: se usa un _fallback_ CSS animado.
- "Ya tengo cuenta" se añade con Supabase Auth en el Bloque 5.
- PDF firmado y email: Bloque 5 (PRD 11.2).

### Hecho cuando

- ✅ El flujo se puede recorrer completo (test de integración + recorrido con Playwright).
- ✅ No hay casillas premarcadas (comprobado en tests: firma legal, consentimientos y firma de
  orientación empiezan desmarcados).

### Cómo probarlo

1. Abre la app: si no has hecho el onboarding verás la bienvenida.
2. Fecha adulta → firma → teléfono cualquiera (+34 6xx xxx xxx) → código **123456** (se muestra
   en modo pruebas). El número +34 600 000 000 simula un teléfono baneado.
3. Consentimientos → perfil (2 fotos) → preferencias → tema.
4. Esta Noche → "Ver perfiles" ⇒ "Verifica tu edad" → Continuar con Yoti → simulador → Aprobado.
5. Perfil → Reiniciar onboarding para repetirlo. Prueba también una fecha de menor y "No acepto".

### Puerta de seguridad

Ver `docs/SECURITY.md` → Bloque 2: sin hallazgos críticos ni altos.

### Pendiente

- Imágenes: firmas de tema (prioridad 1) y las de los bloques 3 y 5.
- Bloque 3: Descubre (mapa simulado, ficha, "Quién hay"), Esta Noche (swipe y match), Chats,
  Perfil y Crear evento.
