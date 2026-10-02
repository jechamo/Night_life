# Nightlife Connect

**Tu noche, segura y conectada.** Ocio nocturno + ligar, en tiempo real, con seguridad y
cumplimiento normativo. Web app (PWA) preparada para iOS y Android con Capacitor.

- Producto: [`docs/PRD.md`](docs/PRD.md) · Progreso: [`docs/PROGRESS.md`](docs/PROGRESS.md)
- Arquitectura: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Seguridad: [`docs/SECURITY.md`](docs/SECURITY.md)
- API: [`docs/API.md`](docs/API.md) · Decisiones: [`docs/adr/`](docs/adr)

## Desarrollo

Requisitos: Node 22+.

```bash
npm ci
npm run dev        # http://localhost:5173
npm run check      # tipos + lint + formato + tests
npm run build      # build de producción (dist/)
```

Stack: React 19, TypeScript, Vite, Tailwind CSS, ShadCN/Radix, Motion, TanStack Query, Zod,
i18next, Supabase (eu-west-1) y Vercel.
