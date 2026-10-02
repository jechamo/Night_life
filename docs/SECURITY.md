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

## Controles añadidos (Bloque 2)

| Riesgo                                 | Control                                                                                                                                                               | Dónde                                              |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Menores (6.15 E)                       | Pantalla de edad neutra (no revela el límite); menor ⇒ estado terminal sin datos; casilla "soy mayor de 18" en la firma; bloqueo "Verifica tu edad" que falla cerrado | `onboarding-machine.ts`, `verification.ts` + tests |
| Privacidad por defecto                 | Ningún consentimiento ni casilla premarcada; orientación (art. 9) exige firma explícita; revocar es un toque                                                          | `consents.ts`, `OrientationConsentSheet` + tests   |
| Fotos (API4/D)                         | Recodificación en el dispositivo (canvas) ⇒ sin EXIF/GPS; tipos y tamaño limitados (15 MB)                                                                            | `platform/images`                                  |
| Datos personales en cliente            | Fecha, teléfono, nombre y fotos solo en memoria durante el onboarding; el mock persistente no guarda datos personales                                                 | ADR 0006                                           |
| Enumeración / abuso de OTP (A07, API6) | Errores genéricos (número baneado = "no podemos completar el alta"), límites de envío y de intentos simulados; el teléfono solo se muestra enmascarado                | `PhoneStep`, mock                                  |
| Bypass de verificación (6.14)          | Simulador solo con `verification_mode = sandbox` **y** rol `tester`                                                                                                   | `ProviderSandboxScreen`                            |
| XSS (A05)                              | Documentos legales como texto estructurado, nunca HTML                                                                                                                | `LegalDocumentSheet`                               |
| IA (6.12 C)                            | Aviso previo de IA con revisión humana y método alternativo                                                                                                           | `AiNotice`                                         |

## Controles añadidos (Bloque 3)

| Riesgo                           | Control                                                                                                                                                                                                           | Dónde                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Privacidad de estadísticas (4.3) | `presentStats`: con menos de 5 personas solo "Menos de 5"; filtros de edad excluyen lugares bajo umbral                                                                                                           | `places/model/stats.ts` + tests    |
| Seguimiento / acoso (6.15 D, E)  | Nunca se muestra la ubicación exacta ni la hora de check-in de otras personas; bloqueo mutuo e instantáneo (oculta en swipes y borra match); motivo "Me siento seguido/a"; modo discreto; semáforo rojo invisible | `matching.ts`, `SafetySheet`, mock |
| Check-in (6.3)                   | Posición leída una vez vía plataforma, comprobación de 150 m y solo "lugar + hora"; sin verificar, check-in invisible                                                                                             | `attendance.ts`, `useCheckIn`      |
| Scraping de perfiles (API6)      | Ver perfiles exige edad verificada (pantalla y ruta directa); el servidor limitará consultas en el Bloque 8                                                                                                       | `SwipeScreen`, `PersonScreen`      |
| Eventos trampa (6.15 E)          | Solo lugares públicos (casilla obligatoria), 3 confirmaciones en 24 h, 3 reportes "falso" ⇒ oculto, aviso de seguridad en no confirmados, máx. 2/día, antiduplicados                                              | `events.ts` + tests                |
| XSS (A05)                        | Mensajes, objetos perdidos, bios y descripciones como texto plano (sin HTML)                                                                                                                                      | `MessageBubble`, `LostFoundPanel`  |
| Abuso de likes (API6)            | Límite diario de 5 (ilimitado solo con entitlement); el servidor lo aplicará                                                                                                                                      | `likesRemaining` + tests           |
| Patrocinios (6.11)               | Solo si cumplen los filtros, máx. 2 arriba y 1/5, etiqueta siempre visible, no alteran datos                                                                                                                      | `sponsored.ts` + tests             |

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

### Bloque 2 — 2026-10-02 ✅ sin hallazgos críticos ni altos

- Security Advisors de Supabase: 0 avisos (sin cambios de esquema en este bloque).
- RLS / migraciones / Edge Functions nuevas: ninguna (bloque de frontend con mocks).
- Dependencias añadidas: `react-hook-form`, `@hookform/resolvers`, `date-fns` (lista 3.5); `npm audit`: 0.
- Auditoría de red (Playwright, recorrido completo del onboarding): 0 orígenes externos
  (solo URLs `blob:` locales de las vistas previas de fotos), 0 errores de consola.
- Sin `dangerouslySetInnerHTML`, sin `console.log`, sin acceso a almacenamiento fuera de `src/platform`.

### Bloque 3 — 2026-10-02 ✅ sin hallazgos críticos ni altos

- Security Advisors de Supabase: 0 avisos (sin cambios de esquema).
- RLS / migraciones / Edge Functions nuevas: ninguna (frontend con mocks).
- Dependencias añadidas: ninguna. `npm audit`: 0 vulnerabilidades.
- Auditoría de red (Playwright: mapa, ficha, swipe, match, chat, perfil, crear evento; 5 temas y
  escritorio): 0 orígenes externos, 0 errores de consola. Avatares SVG `data:` (permitido por CSP).
- Sin `dangerouslySetInnerHTML` ni `console.log`; APIs del dispositivo solo vía `src/platform`.
