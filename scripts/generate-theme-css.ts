/**
 * Regenerates src/styles/themes.generated.css from the theme registry.
 * Run with `npm run tokens` (Node >= 22 strips the TypeScript types natively).
 * `src/shared/theme/themes.test.ts` fails if the committed file is out of date.
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildThemeCss } from '../src/shared/theme/theme-css.ts'

const target = fileURLToPath(new URL('../src/styles/themes.generated.css', import.meta.url))
writeFileSync(target, buildThemeCss(), 'utf8')
console.warn(`Theme tokens written to ${target}`)
