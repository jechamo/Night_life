# Nightlife Connect — instrucciones para Claude Code

Este repositorio sustituye al "Knowledge" de Lovable (ADR 0002).

## Antes de cada bloque

1. Lee `docs/PRD.md` (fuente de verdad) — al menos las secciones que indica el bloque en PRD 11.2.
2. Lee `docs/PROGRESS.md` y `docs/ARCHITECTURE.md`.
3. Escribe el plan del bloque y después implementa.

## Al terminar cada bloque

- Checklist "Hecho cuando" con ✅/❌, cómo probarlo, actualizar `docs/PROGRESS.md` y `docs/SECURITY.md`.
- Puerta de seguridad (PRD 11.1.7): Security Advisors de Supabase, revisión de RLS/migraciones/Edge
  Functions, `npm audit`, auditoría de red.
- Hacer commit y push del bloque validado; comunicar SHA, URL del despliegue y resultados.
- Terminar con: **"Bloque X terminado. ¿Me das OK para pasar al Bloque X+1?"** y no continuar sin OK.

## Reglas

- No añadir dependencias ni terceros fuera de PRD 3.5 sin permiso. No inventar requisitos.
- UI → hooks → servicios → adaptadores. La UI nunca llama a Supabase.
- Funciones del dispositivo solo vía `src/platform` (`usePlatform()`).
- Flags solo vía `useFeatureFlag` / `feature_enabled()`. Permisos de pago solo vía entitlements.
- Ningún texto fijo: todo en `src/i18n/locales/{es,en}.json`.
- Animar solo `transform` y `opacity`; 150-400 ms; respetar reducir movimiento.
- Temas: editar `src/shared/theme/themes.ts` y ejecutar `npm run tokens`.
- Bloques 1-4: mocks solo en `src/mocks/`. Desde el Bloque 5: datos reales y `is_test`.
- Supabase: proyecto `Nightlife_Connect` (ref `ocrpfeqfqzchhrghqcfb`, eu-west-1). Cambios de esquema
  siempre con migraciones versionadas; nada destructivo sin confirmación explícita.
- Migraciones y Edge Functions con MCP de Supabase; despliegues y comprobaciones con MCP de Vercel.
- Antes del Bloque 12 no contratar, ampliar planes ni activar proveedores facturables. Usar
  pruebas gratuitas sin cargos o simulación persistida en Supabase (PRD 11.3).

## Comandos

- `npm run dev` · `npm run build` · `npm run check` (tsc + eslint + prettier + vitest) · `npm run tokens`
