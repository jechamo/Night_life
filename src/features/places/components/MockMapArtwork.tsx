import { MOCK_MAPS } from '@/shared/images/catalog'

/** Decorative fictional district: neutral artwork tinted with the current theme. */
export function MockMapArtwork() {
  const { portrait, landscape } = MOCK_MAPS
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 isolate overflow-hidden bg-background"
    >
      <picture>
        <source
          media="(min-width: 1024px)"
          srcSet={landscape.srcSet}
          sizes="(min-width: 1600px) 1080px, 70vw"
          width={landscape.width}
          height={landscape.height}
        />
        <img
          src={portrait.src}
          srcSet={portrait.srcSet}
          sizes="100vw"
          width={portrait.width}
          height={portrait.height}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="size-full object-cover opacity-65"
        />
      </picture>
      <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary opacity-50 mix-blend-color" />
      <div className="absolute inset-0 shadow-[inset_0_0_180px_80px_var(--nl-background)]" />
    </div>
  )
}
