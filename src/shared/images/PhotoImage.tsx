import type { ComponentProps } from 'react'
import { TEST_AVATARS } from './catalog'

const TEST_AVATARS_BY_URL = new Map(TEST_AVATARS.map((image) => [image.src, image]))

/**
 * Responsive bundled illustrations for mock profiles. Uploaded/signed user photos
 * keep their original URL and never get substituted with a generated portrait.
 */
export function PhotoImage({
  src,
  sizes,
  loading = 'lazy',
  decoding = 'async',
  ...props
}: ComponentProps<'img'>) {
  const image = src ? TEST_AVATARS_BY_URL.get(src) : undefined
  return (
    <img
      src={src}
      srcSet={image?.srcSet}
      sizes={sizes}
      width={image?.width}
      height={image?.height}
      loading={loading}
      decoding={decoding}
      {...props}
    />
  )
}
