# ADR 0002 — Hosting en Vercel y desarrollo con Claude Code (en lugar de Lovable)

- **Estado:** aceptada (Bloque 1) — decisión del propietario del producto
- **Fecha:** 2026-10-02

## Contexto

El PRD se escribió para Lovable (desarrollo + hosting). El propietario decide que el
desarrollo lo haga Claude Code sobre el repositorio de GitHub y que la web se aloje en
Vercel. Supabase se mantiene: proyecto `Nightlife_Connect` (`ocrpfeqfqzchhrghqcfb`,
eu-west-1, PostgreSQL 17).

## Decisión

- **Hosting:** Vercel (SPA estática). `vercel.json` define rewrites de SPA y las cabeceras
  de seguridad de 6.15 A02 (CSP estricta, HSTS, nosniff, Referrer-Policy,
  Permissions-Policy, `frame-ancestors 'none'`). Al permitir cabeceras reales no hace
  falta CSP por `<meta>`.
- **Toolbar/feedback de Vercel desactivados** en el proyecto: inyectan scripts de terceros
  (`vercel.live`) que el PRD prohíbe (3.2) y que la CSP bloquearía.
- **"Knowledge" de Lovable → `CLAUDE.md` + `docs/PRD.md` + `docs/PROGRESS.md`.**
- Los puntos del PRD específicos de Lovable (eliminar scripts del editor, escáner de
  seguridad de Lovable) no aplican; se sustituyen por ESLint, auditoría de npm, Security
  Advisors de Supabase y la auditoría de red con Playwright.

## Consecuencias

- La lista de terceros (6.12 B) cambia "Lovable (si aloja la web)" por **Vercel Inc.**
  (EE. UU., DPF + cláusulas tipo). Sirve solo estáticos: no procesa datos personales más
  allá de logs técnicos de acceso (IP), que deben figurar en la Política de Privacidad y en
  el contrato de encargado. **Pendiente de revisar con el abogado** (bloque legal).
- Los despliegues de _preview_ quedan protegidos por la autenticación de Vercel por defecto.
