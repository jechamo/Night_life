# ADR 0004 — Temas como tokens generados desde TypeScript

- **Estado:** aceptada (Bloque 1)

## Decisión

`src/shared/theme/themes.ts` es la única fuente de verdad de los 5 temas (colores,
tipografías, estilo de mapa, paleta del heatmap, perfil de movimiento). Un script
(`npm run tokens`) genera `src/styles/themes.generated.css` con variables `--nl-*`
bajo `[data-theme='…']`; Tailwind las expone como utilidades (`bg-primary`,
`font-display`…).

- Cambiar de tema = cambiar `data-theme` en `<html>` (sin JS de estilos).
- Al estar acotadas por atributo, cualquier elemento puede previsualizar otro tema
  (las tarjetas del selector se pintan con su propio tema).
- `themes.test.ts` comprueba **WCAG 2.1 AA** de cada tema (texto, texto atenuado, botones
  rellenos, estados, acentos por tipo de lugar sobre fondo, superficie y cristal).
- Un test falla si el CSS generado no coincide con el registro.
- La transición de tema usa View Transitions (fundido) con _fallback_ de opacidad (WAAPI).
  Cyberpunk añade un _glitch_ de 280 ms (solo `transform`) si no hay movimiento reducido.

## Movimiento

- Duraciones de transición entre 150 y 400 ms (los _springs_ usan `visualDuration`).
- "Reducir movimiento" efectivo = preferencia del sistema **o** ajuste de la app **o** tema
  Mono. Se aplica con `MotionConfig reducedMotion="always"` (Motion elimina transformaciones
  y deja fundidos) y `data-motion="reduced"` para las animaciones CSS.
- Los bucles ambientales (pulso "en directo", flotación de estados vacíos) no son
  transiciones y quedan fuera de la regla de 150-400 ms; se detienen o pasan a fundido con
  movimiento reducido.
