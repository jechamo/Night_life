# Inventario de dependencias — Bloque 10

- `sbom.cdx.json`: CycloneDX generado por `npm sbom --package-lock-only
--sbom-format cyclonedx` sobre el lockfile de frontend y herramientas de desarrollo.
  615 componentes; `npm audit` reportó cero vulnerabilidades.
- `edge-sbom.cdx.json`: CycloneDX del grafo npm de los imports Edge existentes:
  `@supabase/supabase-js@2.117.2` y `stripe@23.0.0`, resuelto sin ejecutar scripts.
  `npm audit` del lockfile separado reportó cero vulnerabilidades en 11 paquetes
  (raíz incluida). El grafo Deno confirma las mismas diez dependencias npm.

Los dos inventarios son resoluciones de 2026-10-04. No inventar versiones de Auth,
Postgres, runtime administrado Edge ni infraestructura Vercel a partir de ellos.
Las funciones fijan sus imports directos; Supabase gestiona la compilación y el
runtime remotos. El SBOM Edge registra el grafo comprobado localmente, no una
atestación del sistema operativo del despliegue. Tampoco incluye cuentas de
proveedores, secretos o datos de usuarios.

Regenerar ambos inventarios y ejecutar las auditorías al cambiar dependencias.
Conservar el lockfile principal y las versiones directas Edge verificadas; no
resolver imports flotantes durante una corrección de seguridad sin comprobar tipos.
