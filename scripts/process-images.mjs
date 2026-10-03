// Asset pipeline only: uses sharp from the developer environment, not the app bundle.
// IMAGE_SHARP_MODULE may point to a preinstalled sharp package (no new app dependency).
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'

const require = createRequire(import.meta.url)
const root = process.cwd()
const prompts = await readFile(path.join(root, 'docs/design/IMAGE_PROMPTS.md'), 'utf8')
const base =
  'Cinematic premium nightlife photography quality, shot at night, deep shadows, subtle film grain, shallow depth of field, elegant and restrained, never cheesy. Generic Spanish / Mediterranean setting, no recognizable landmarks or real venues. No text, letters, readable signs, logos, watermarks or brand names anywhere. No recognizable people and no faces: people may only appear as out-of-focus silhouettes seen from behind.'
const items = []
for (const line of prompts.split('\n')) {
  const cells = line
    .split('|')
    .slice(1, -1)
    .map((x) => x.trim())
  const name = cells[0]?.match(/`([^`]+)\.png`/)?.[1]
  if (!name || name === 'logo-concepts') continue
  let prompt = cells[1]
  let folder,
    width = 1024,
    height = 1024,
    widths
  const neutral = /^(onboarding|map-mock|illu)/.test(name) || name === 'theme-mono'
  if (name.startsWith('theme-')) {
    folder = 'themes'
    height = 1536
    widths = [640, 1080]
  } else if (name.startsWith('onboarding-')) {
    folder = 'onboarding'
    height = 1536
    widths = [640, 1080]
  } else if (name.startsWith('map-')) {
    folder = 'maps'
    widths = [640, 1080]
    width = name.endsWith('landscape') ? 1536 : 1024
    height = name.endsWith('landscape') ? 1024 : 1536
    prompt =
      'Tilted top-down 3D night map of a fictional Mediterranean city district: dark building blocks with faint light-grey edges, thin light street lines, a plaza and a seafront promenade, very low contrast overall so UI pins placed on top stand out. Monochrome, neutral greys on black. No labels, no text, no pins, no people.'
  } else if (name.startsWith('illu-')) {
    folder = 'illustrations'
    widths = [320, 640]
    prompt = `Soft 3D clay illustration of ${cells[1]}. Pearl-white and light-grey matte materials only, monochrome, no colour, rounded friendly shapes, minimal composition, centred with generous empty space, on a pure black background (#000000). Clearly an illustration, not a photo. No text, letters, logos, brands or watermarks.`
  } else if (name.startsWith('venue-')) {
    folder = 'venues'
    width = 1536
    height = 1024
    widths = [640, 1080, 1600]
    prompt = `Interior of a ${cells[1]} at night, ${cells[2]}. Natural, realistic venue lighting. Empty, or with only out-of-focus silhouettes seen from behind far in the background. Leave the bottom third darker for text overlay.`
  } else if (name.startsWith('event-')) {
    folder = 'events'
    width = 1536
    height = 1024
    widths = [640, 1080, 1600]
  } else if (name.startsWith('avatar-')) {
    folder = 'avatars'
    widths = [320, 640]
    prompt = `Use case: stylized-concept. A visibly stylized 3D clay CARTOON character bust, shoulders-up illustrated avatar of ${cells[1]}, friendly relaxed expression, fully clothed in ${cells[2]}, facing slightly to the side, soft studio light, plain mid-grey background, natural colours. Rounded toy-like sculpted shapes, slightly oversized head and expressive cartoon eyes, simplified chunky sculpted hair, smooth matte clay skin with absolutely no pores, simplified fabric without photographic detail. It must unmistakably look like an animated illustration, never a realistic human or a photograph. One fictional adult character only. No text, letters, logos, brands or watermarks.`
  } else {
    folder = 'brand'
    width = 1536
    height = 1024
    widths = [640, 1080, 1600]
    prompt = cells[2]
  }
  const fullPrompt = `${name.startsWith('avatar-') || name.startsWith('illu-') ? '' : base + ' '}Create one ${width}x${height} PNG image, ${width === height ? 'square' : width < height ? 'portrait 2:3' : 'landscape 3:2'} composition. ${prompt}`
  const source = `docs/design/generated/${name}.png`
  const outputs = widths.map((w) => `src/assets/images/${folder}/${name}-${w}.webp`)
  let available = false
  try {
    await access(path.join(root, source))
    available = true
  } catch {
    /* Not generated yet. */
  }
  items.push({
    name,
    folder,
    width,
    height,
    widths,
    neutral,
    prompt: fullPrompt,
    source,
    outputs,
    available,
  })
}

if (process.argv.includes('--list')) {
  process.stdout.write(JSON.stringify(items))
} else {
  const sharp = require(process.env.IMAGE_SHARP_MODULE || 'sharp')
  const results = []
  for (const item of items) {
    if (!item.available) continue
    const metadata = await sharp(item.source).metadata()
    // Normalize the saved PNG to the requested deliverable dimensions without metadata.
    if (metadata.width !== item.width || metadata.height !== item.height) {
      const png = await sharp(item.source).rotate().resize(item.width, item.height).png().toBuffer()
      await writeFile(item.source, png)
    }
    for (let i = 0; i < item.widths.length; i++) {
      const dest = item.outputs[i]
      await mkdir(path.dirname(dest), { recursive: true })
      let image = sharp(item.source).rotate().resize({ width: item.widths[i] })
      if (item.neutral) image = image.grayscale()
      await image.webp({ quality: 80, effort: 6 }).toFile(dest)
    }
    results.push({
      ...item,
      generatedWidth: metadata.width,
      generatedHeight: metadata.height,
      mode: 'built-in image_gen',
      quality: 80,
      metadata: 'stripped',
    })
  }
  await writeFile('docs/design/generated/manifest.json', JSON.stringify(results, null, 2) + '\n')
  process.stdout.write(`Processed ${results.length} generated assets.\n`)
}
