# Progreso — Nightlife Connect

Registro por bloque (PRD 11.1): qué se hizo, decisiones, desviaciones y pendientes.
**No se pasa al siguiente bloque sin un OK explícito del propietario.**

| Bloque                                              | Estado                                       |
| --------------------------------------------------- | -------------------------------------------- |
| 1 – Cimientos, diseño y arquitectura                | ✅ Aprobado (OK del propietario, 2026-10-02) |
| 2 – Onboarding, legal y verificación (mock)         | ⏳                                           |
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
