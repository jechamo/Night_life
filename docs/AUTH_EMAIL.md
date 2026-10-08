# Entrar con código por email — configuración de Supabase Auth (R1)

El código está desplegado detrás del flag `email_login_enabled` (apagado). Antes de
encenderlo, el propietario configura Supabase Auth en el panel del proyecto
`Nightlife_Connect`. Nada de esto tiene coste: se usa el Gmail del proyecto (ADR 0009).

## 1. SMTP propio (obligatorio)

Ojo: el Gmail ya configurado (ADR 0009) lo usan las **Edge Functions** de la app (PDF firmado,
avisos de facturación) con sus propios secretos. Los emails de **Supabase Auth**
(confirmaciones y códigos) salen por otra configuración, la de Auth. Supabase Auth ya ha
enviado confirmaciones (4 envíos, 1 email confirmado hasta el 05/10), pero desde aquí no se
puede ver si usa ese Gmail o el servidor de pruebas de Supabase. Compruébalo primero:
si en SMTP Settings ya figura `smtp.gmail.com`, este paso está hecho.

Authentication › Emails › SMTP Settings › Enable custom SMTP:

- Host `smtp.gmail.com`, puerto `465` (SSL) o `587` (STARTTLS).
- Usuario: el Gmail del proyecto. Contraseña: una **contraseña de aplicación** de Google
  (requiere verificación en dos pasos en esa cuenta). Nunca la contraseña normal.
- Remitente: `Nightlife Connect` y el mismo Gmail.
- Límite práctico de Gmail: ~500 envíos/día. Suficiente hasta el lanzamiento.

El SMTP por defecto de Supabase solo admite unos pocos emails por hora y es para pruebas.

## 2. Código de 6 dígitos (obligatorio)

- Authentication › Providers › Email: activado, «Confirm email» activado,
  **Email OTP Length = 6** y caducidad de 600 s.
- Authentication › Emails › Templates › **Magic Link**: el cuerpo debe incluir
  `{{ .Token }}` (el código). Plantilla propuesta (ES/EN):

  ```html
  <h2>Tu código de Nightlife Connect / Your Nightlife Connect code</h2>
  <p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
  <p>Caduca en 10 minutos. Si no lo has pedido tú, ignora este email.</p>
  <p>It expires in 10 minutes. If you did not ask for it, ignore this email.</p>
  ```

- «Change Email Address» se queda como está: confirma con enlace, igual que hoy en el alta.

## 3. Límites

Authentication › Rate Limits: emails por hora moderados (p. ej. 30) y el límite de
verificaciones por IP por defecto. La app además nunca revela si un email tiene cuenta.

## 4. Seguridad comprobada

- La app pide el código con `shouldCreateUser: false`: no se crean cuentas por email.
- Aunque alguien creara un usuario solo con email por la API de Auth, no puede terminar
  el alta: `complete_onboarding` exige teléfono confirmado (prueba SQL
  «unconfirmed phone cannot onboard») y todas las RPC exigen cuenta completa y no
  baneada ni suspendida (`private.require_registered`).
- Activar el flag exige rol admin con segundo factor (prueba SQL de RLS).

## 5. Activar

1. Añadir y confirmar el email en una cuenta de prueba (Perfil › Ajustes › Cuenta aparece
   al encender el flag; también se puede encender, probar y volver a apagar).
2. Admin › Feature flags › `email_login_enabled` = `on`.
3. Probar: cerrar sesión › «Ya tengo cuenta» › email › código › entra en Inicio.
4. Si algo falla, volver a `off`: la app vuelve exactamente al login por SMS.
