# ADR 0006 — Onboarding, legal y verificación simulados (Bloque 2)

- **Estado:** aceptada (Bloque 2)
- **Fecha:** 2026-10-02

## Decisión

- **Máquina de estados pura** (`onboardingReducer`) con el orden obligatorio de PRD 5.2:
  fecha de nacimiento → firma legal → teléfono + OTP → consentimientos → perfil →
  preferencias (solo con consentimiento de orientación) → tema. No se pueden saltar pasos,
  y tras verificar el teléfono no se puede volver a los pasos previos a la cuenta.
- **Datos personales solo en memoria** del componente del onboarding (fecha, teléfono,
  nombre, fotos). Menor de 18 ⇒ estado `not_eligible` sin datos. Al salir se descartan.
- **Backend simulado** (`src/mocks/mock-store.ts`) persistido en preferencias locales solo para
  que los testers no pierdan el progreso entre recargas. Contiene únicamente flags no
  personales (onboarding completado, firmas con versión y fecha, consentimientos sí/no,
  ciudad elegida y estado de las verificaciones). Desaparece en el Bloque 5.
- **Verificación como puerto** (`VerificationService.start` devuelve redirección externa o
  interna). El adaptador real (Bloque 6) devolverá la URL de Yoti (en lista blanca); el mock
  devuelve `/verification/sandbox`, que **solo funciona con `verification_mode = sandbox` y
  rol `tester`** (nunca hay _bypass_ para usuarios normales).
- **Bloqueo "Verifica tu edad"**: `canPerform()` (falla cerrado) + `AgeGateProvider`. Es UX;
  el servidor aplicará la misma regla en el Bloque 6.
- **Fotos**: el puerto `platform.images.sanitize()` recodifica en el dispositivo (canvas →
  WebP/JPEG) y elimina EXIF/GPS antes de cualquier subida.
- **Documentos legales**: estructurados (título, resumen, secciones) y renderizados como
  texto, nunca como HTML. Son borradores con marcadores `[DATOS EMPRESA]` para el abogado.
- **Imágenes neutras tintadas por tema** (`TintedScene`, `Illustration`) y firmas por tema con
  _fallback_ CSS (`LiveCityArt`) hasta que existan.

## Consecuencias

- Dependencias añadidas (lista 3.5): `react-hook-form`, `@hookform/resolvers` (paquete oficial
  de RHF para Zod), `date-fns`.
- La firma ocurre antes de crear la cuenta: en el Bloque 5 la evidencia se guarda pendiente y se
  vincula al usuario al verificar el OTP, en la misma transacción.
- "Ya tengo cuenta" (inicio de sesión de usuarios existentes) llega con Supabase Auth (Bloque 5).
