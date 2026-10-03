import type { Gender } from '@/features/onboarding/model/onboarding-machine'
import { TEST_AVATARS } from '@/shared/images/catalog'

/** Gender/age in each authored prompt, in avatar-01 … avatar-24 order. */
const PERSONAS: readonly (readonly [Gender, number])[] = [
  ['woman', 22],
  ['man', 22],
  ['non_binary', 25],
  ['woman', 28],
  ['man', 28],
  ['woman', 30],
  ['man', 30],
  ['woman', 32],
  ['man', 32],
  ['woman', 35],
  ['man', 35],
  ['non_binary', 35],
  ['woman', 40],
  ['man', 40],
  ['woman', 42],
  ['man', 42],
  ['woman', 45],
  ['man', 45],
  ['woman', 50],
  ['man', 50],
  ['woman', 55],
  ['man', 55],
  ['woman', 60],
  ['man', 60],
]

/** Preserve mock identities and ages; pick an appropriate authored illustration. */
export function testAvatarFor(gender: Gender, age: number, seed: number): string {
  const closest = PERSONAS.map(([personaGender, personaAge], index) => ({
    personaGender,
    personaAge,
    index,
  }))
    .filter((persona) => persona.personaGender === gender)
    .sort((a, b) => Math.abs(a.personaAge - age) - Math.abs(b.personaAge - age))
    .slice(0, 2)
  const index = closest[seed % closest.length]?.index ?? 0
  return TEST_AVATARS[index]!.src
}
