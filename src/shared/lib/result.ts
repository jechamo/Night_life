/**
 * Typed result for services (PRD 3.4 "Errores"): services never throw to the UI,
 * they return success or a typed error code that the UI maps to a generic,
 * translated message.
 */
export type Ok<T> = { readonly ok: true; readonly value: T }
export type Err<E> = { readonly ok: false; readonly error: E }
export type Result<T, E> = Ok<T> | Err<E>

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value })
export const err = <E>(error: E): Err<E> => ({ ok: false, error })
