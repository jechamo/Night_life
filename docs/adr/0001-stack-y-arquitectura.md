# ADR 0001 — Stack y arquitectura base

- **Estado:** aceptada (Bloque 1)
- **Fecha:** 2026-10-02

## Contexto

El PRD (3.1, 3.4, 3.5) fija React + TypeScript + Vite (SPA), Tailwind + ShadCN/Radix,
Motion, TanStack Query, Zod, i18next y Supabase, organización por funcionalidades y
puertos/adaptadores.

## Decisión

- Versiones estables más recientes compatibles entre sí (oct-2026): React 19.3, Vite 8
  (Rolldown), React Router 8, Tailwind 4.3, Motion 13.5, TanStack Query 5, Zod 4,
  i18next 26, Vitest 5, ESLint 10.
- **TypeScript 6.0** (no 7.0): `typescript-eslint` aún no soporta TS 7 (peer `<6.1`).
- **Motion 13.5** (no 14.0): la 14.0.0 se publicó el mismo día; se evita una major sin rodaje.
- Utilidades de ShadCN incluidas como parte de "ShadCN/Radix" (3.5): `radix-ui`,
  `class-variance-authority`, `clsx`, `tailwind-merge`. Los componentes se escriben a mano
  con el patrón ShadCN (no se usa la CLI de registro remota).
- Inyección de dependencias con un contenedor de servicios (`AppServices`) en contexto
  React: los bloques 1-4 inyectan mocks y el Bloque 5 inyecta servicios Supabase sin
  tocar hooks ni UI.
- Capas: UI → hooks → servicios → adaptadores. La UI nunca importa `@supabase/*`
  (regla ESLint `no-restricted-imports`).

## Consecuencias

- Paquetes de desarrollo nuevos fuera de la lista literal de 3.5 pero de las familias
  permitidas: `@testing-library/dom`, `@testing-library/jest-dom`, `@testing-library/user-event`,
  `jsdom` (entorno de Vitest), `typescript-eslint`, `@eslint/js`, `eslint-plugin-react-hooks`,
  `globals`, `@tailwindcss/vite`, `@vitejs/plugin-react`, `@types/*`. Todos oficiales.
