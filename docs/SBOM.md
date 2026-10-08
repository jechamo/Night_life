# Inventario de dependencias — Bloque 10

- `sbom.cdx.json`: CycloneDX generado por `npm sbom --sbom-format cyclonedx` tras
  `npm ci`, sobre el frontend y las herramientas de desarrollo.
  627 componentes (08/10/2026); `npm audit` reportó cero vulnerabilidades.
- `edge-sbom.cdx.json`: CycloneDX del grafo npm de los imports Edge existentes:
  `@supabase/supabase-js@2.117.2` y `stripe@23.0.0`, resuelto sin ejecutar scripts.
  `npm audit` del lockfile separado reportó cero vulnerabilidades en 11 paquetes
  (raíz incluida). El grafo Deno confirma las mismas diez dependencias npm.

El inventario Edge es una resolución de 2026-10-04; el de frontend, de 2026-10-08. No inventar versiones de Auth,
Postgres, runtime administrado Edge ni infraestructura Vercel a partir de ellos.
Las funciones fijan sus imports directos; Supabase gestiona la compilación y el
runtime remotos. El SBOM Edge registra el grafo comprobado localmente, no una
atestación del sistema operativo del despliegue. Tampoco incluye cuentas de
proveedores, secretos o datos de usuarios.

Actualización 08/10/2026: `sbom.cdx.json` regenerado (627 componentes) tras añadir
`@playwright/test@1.63.0` (desarrollo). Se genera con `npm sbom --sbom-format cyclonedx`
sobre las dependencias instaladas (`npm ci`), no con `--package-lock-only`: esa opción
falla (ESBOMPROBLEMS) porque no resuelve las `bundleDependencies` del paquete opcional
`@tailwindcss/oxide-wasm32-wasi`. Los binarios opcionales listados son los de la
plataforma donde se genera (Linux x64 en CI; el inventario del 04/10 se hizo en Windows).
`npm audit`: 0 vulnerabilidades.

Regenerar ambos inventarios y ejecutar las auditorías al cambiar dependencias.
Conservar el lockfile principal y las versiones directas Edge verificadas; no
resolver imports flotantes durante una corrección de seguridad sin comprobar tipos.
