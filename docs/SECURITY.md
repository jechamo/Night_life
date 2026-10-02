# Seguridad — modelo de amenazas y controles

Documento vivo (PRD 6.15). Se actualiza en la puerta de seguridad de cada bloque.

## Controles implementados (Bloque 1)

| Riesgo (OWASP)                    | Control                                                                                                                                                                                                                                  | Dónde                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| A01 Control de acceso / API7 SSRF | Navegación externa solo a lista blanca (HTTPS, sin credenciales en URL, sin puertos, sin dominios parecidos)                                                                                                                             | `src/platform/in-app-browser/allowlist.ts` + tests |
| A02 Configuración                 | CSP estricta (`script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `connect-src` limitado a Supabase), HSTS, nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy (cámara y ubicación solo `self`), COOP | `vercel.json`                                      |
| A02                               | Sin _source maps_ en producción                                                                                                                                                                                                          | `vite.config.ts`                                   |
| A02                               | Toolbar/feedback de Vercel desactivados (scripts de terceros)                                                                                                                                                                            | Proyecto de Vercel                                 |
| A03 Cadena de suministro          | Solo dependencias de 3.5 (y familias oficiales, ADR 0001); lockfile versionado; `npm audit` = 0 vulnerabilidades                                                                                                                         | `package-lock.json`                                |
| A05 Inyección / XSS               | Sin `dangerouslySetInnerHTML`; React escapa; i18n con `escapeValue: false` solo porque React ya escapa y nunca se inyecta HTML traducido                                                                                                 | —                                                  |
| A08 Integridad                    | El cliente no decide permisos: flags y entitlements son solo UX; el servidor aplicará RLS / `has_entitlement()`                                                                                                                          | `src/shared/flags`, `src/shared/entitlements`      |
| A09 Logs limpios                  | El Error Boundary solo registra el tipo de error, nunca el mensaje (puede contener datos)                                                                                                                                                | `ScreenErrorBoundary`                              |
| A10 Fallar cerrado                | Flags inválidos o no cargados ⇒ valores seguros (pagos off, herramientas de prueba off, verificación live). Entitlements denegados mientras cargan o si `premium_enabled = off`                                                          | `flags.ts`, `use-entitlement.ts` + tests           |
| API5 Autorización de función      | Herramientas de prueba ocultas tras `test_tools_enabled` en UI (el servidor añadirá rol + flag)                                                                                                                                          | `FeatureGate`                                      |
| Privacidad (3.1)                  | El _service worker_ solo cachea el _shell_; nunca respuestas de API                                                                                                                                                                      | `vite.config.ts`                                   |
| Privacidad (3.2)                  | Fuentes e iconos autoalojados; 0 peticiones a terceros (verificado con auditoría de red Playwright)                                                                                                                                      | `src/assets/fonts`, `lucide-react` empaquetado     |
| Capa de plataforma                | ESLint impide APIs del dispositivo fuera de `src/platform`                                                                                                                                                                               | `eslint.config.js`                                 |

### Decisiones aceptadas con riesgo bajo

- `style-src 'unsafe-inline'`: necesario para estilos en línea de Radix (react-remove-scroll)
  y Motion. `script-src` sigue sin `unsafe-inline`. Riesgo bajo (no permite ejecutar JS).
- `secureStorage` en web usa `localStorage` (no hay alternativa más fuerte para una SPA).
  En nativo se usará Keychain/Keystore (Anexo B). Mitigación: CSP estricta contra XSS y JWT
  de corta duración con rotación (Bloque 5).
- `workbox-build` arrastra `glob@11` (aviso de deprecación, sin CVE). Solo en build.

## Modelo de amenazas (STRIDE) — esqueleto, se completa por bloques

| Área                                  | Bloque | Estado                                          |
| ------------------------------------- | ------ | ----------------------------------------------- |
| Alta y OTP                            | 5      | Pendiente                                       |
| Verificación (Yoti, foto)             | 6      | Pendiente                                       |
| Check-in y "Aquí Ahora" (seguimiento) | 7      | Pendiente                                       |
| Likes y chat                          | 8      | Pendiente                                       |
| Reportes / moderación                 | 9      | Pendiente                                       |
| Eventos de usuarios                   | 7      | Pendiente                                       |
| Pagos y entitlements                  | 9      | Pendiente (política de cliente lista y probada) |
| Herramientas de prueba y admin        | 4-5    | Pendiente (gate de UI listo)                    |

## Puertas de seguridad por bloque

### Bloque 1 — 2026-10-02 ✅ sin hallazgos críticos ni altos

- Security Advisors de Supabase (`Nightlife_Connect`): **0 avisos** (esquema `public` aún vacío;
  se repiten en el Bloque 5 con las primeras migraciones).
- RLS / migraciones / Edge Functions nuevas: ninguna.
- Dependencias añadidas: revisadas (oficiales, mantenidas); `npm audit`: 0 vulnerabilidades.
- Auditoría de red (Playwright, build de producción): 0 orígenes externos, 0 errores de consola.
- Puntos de 6.15 aplicados: A01 (lista blanca), A02 (cabeceras), A03, A05, A09, A10, API5 (UI).
