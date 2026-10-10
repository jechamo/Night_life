# App nativa — Bloque 11

Estado tras el **Bloque 11a** (10/10/2026): contenedor Capacitor 8 con adaptadores
nativos para todos los puertos de `src/platform`, proyectos `android/` e `ios/` versionados
y desbloqueo biométrico opcional. Las compras en tiendas (RevenueCat Test Store) y el Modo
viaje son el **Bloque 11b**. Firma, cuentas de desarrollador, fichas y publicación, el
Bloque 12. Referencias: PRD 3.3–3.5, Anexo B, [Capacitor](https://capacitorjs.com/docs).

## Identidad y compilación

- appId / bundle id `com.nightlifeconnect.app` (decisión del propietario, 10/10/2026).
- `npm run build:native` = `tsc -b` + `vite build --mode native` → `dist-native/`:
  sin service worker ni manifest web, CSP como `<meta>` derivada de `vercel.json`
  (`scripts/native-csp.ts`) y `VITE_APP_URL` público desde `.env.native` (versionado, sin
  secretos). El build falla si falta un `VITE_APP_URL` HTTPS.
- `npm run cap:sync` = build nativo + `cap sync` (copia a `android/` e `ios/`).
- Android: `cd android && gradlew assembleDebug` (JDK de Android Studio en `JAVA_HOME`,
  SDK en `ANDROID_HOME`). Compilado y probado en emulador API 36.
- iOS: Swift Package Manager (sin CocoaPods). Generado en Windows; compilar exige macOS +
  Xcode (Bloque 12). `Info.plist` en inglés y `es.lproj/InfoPlist.strings` en español.
- El bundle web no cambia: `@/platform/native` se carga con `import()` dinámico y los
  plugins van en el chunk `vendor-native`, que el HTML web no precarga.

## Dependencias nativas fijadas

- Android: bloqueo de dependencias de Gradle (`buildscript-gradle.lockfile`,
  `app/gradle.lockfile`; la raíz no tiene dependencias propias). Tras actualizar Capacitor
  o un plugin: `cd android && gradlew buildEnvironment :app:dependencies --write-locks`.
- iOS: `Package.resolved` (copia compartida del workspace y junto a `CapApp-SPM`) fija
  `capacitor-swift-pm` 8.5.3, `ion-ios-camera` 2.0.0, `ion-ios-filesystem` 2.0.0,
  `ion-ios-geolocation` 3.0.0 y `keychain-swift` 21.0.0 por commit. Escrito a partir de las
  etiquetas de GitHub; Xcode lo confirmará o actualizará al resolver en el Bloque 12.

## Selección de la plataforma

`src/app/create-platform.ts` elige la factory por runtime antes de crear servicios. En la
shell nativa nunca se usa la web como respaldo: sin `VITE_APP_URL` el arranque falla.
`html[data-runtime=native]` activa las variables `--safe-area-inset-*` que inyecta
`SystemBars` (WebView de Android < 140). `connectNativeBridge` enruta los enlaces abiertos
por el sistema y el botón atrás de Android (atrás en el historial; en la primera pantalla,
sale de la app).

| Puerto            | Nativo (Bloque 11a)                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `secureStorage`   | `@aparajita/capacitor-secure-storage`: Keychain / Keystore, `afterFirstUnlockThisDeviceOnly`               |
| `preferences`     | `@capacitor/preferences` (grupo `nl.pref`)                                                                 |
| `geolocation`     | `@capacitor/geolocation`, solo primer plano y bajo petición; sin caché de posición                         |
| `camera`          | `@capacitor/camera` (`takePhoto` / `chooseFromGallery`, sin metadatos ni galería); selfie y QR vía WebView |
| `images`, `audio` | Los mismos de la web (canvas y audio del WebView)                                                          |
| `haptics`         | `@capacitor/haptics`                                                                                       |
| `share`           | `@capacitor/share`                                                                                         |
| `files`           | `@capacitor/filesystem` en caché privada + hoja de compartir; se borra siempre después                     |
| `browser`         | `@capacitor/browser` (SFSafariViewController / Custom Tabs) con la misma allowlist                         |
| `deepLinks`       | `@capacitor/app`: esquema `com.nightlifeconnect.app://` y App Links del dominio público                    |
| `biometrics`      | `@aparajita/capacitor-biometric-auth` (biometría o código del dispositivo)                                 |
| `notifications`   | Solo permiso (`@capacitor/local-notifications`); push remoto en el Bloque 12                               |
| `appState`        | `@capacitor/app`: primer plano / segundo plano y botón atrás (nuevo puerto)                                |
| `appUpdates`      | Solo estado de conexión; el binario se actualiza por las tiendas                                           |
| `deviceId`        | El mismo ID aleatorio de instalación que la web, guardado en preferencias                                  |

Los dos plugins `@aparajita` (MIT) los autorizó el propietario el 10/10/2026 porque no
existe plugin oficial `@capacitor/*` para Keychain/Keystore ni biometría.

## Desbloqueo biométrico

Ajustes › Seguridad (solo si el dispositivo tiene biometría o código). Activarlo exige
pasar la biometría. Al abrir la app o volver tras 30 s fuera, se tapa la app (inerte, sin
desmontar) hasta desbloquear. Si la biometría desaparece, la app queda cerrada y solo se
puede cerrar sesión (después, login normal por OTP). Cerrar sesión desactiva el bloqueo.
No concede roles, sesión ni ventajas.

## Permisos

Android pide cámara, ubicación aproximada/precisa (sin segundo plano), biometría y
notificaciones, cada una al usarla. Se eliminan del manifiesto fusionado
`SCHEDULE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED` y `WAKE_LOCK` (de local-notifications, no
se usan). `allowBackup=false` y reglas de extracción vacías: la sesión no se copia a la nube
ni a otro móvil. iOS: textos de cámara, fotos, ubicación en uso y Face ID (EN/ES).

## Enlaces y retornos

Las URL de retorno siguen en el origen HTTPS público (los proveedores exigen HTTPS). Hasta
verificar App Links (`assetlinks.json` con el certificado de firma de release) y Universal
Links (Team ID de Apple) en el Bloque 12, Android pregunta con qué abrir y el retorno de
Veriff puede abrirse en el navegador: la persona cierra la hoja y la app recarga el estado
al volver (el resultado llega por webhook). Solo se aceptan nuestro host y nuestro esquema.

## Edge Functions y CORS

`_shared/http.ts` admite además `https://localhost` (Android) y `capacitor://localhost`
(iOS), exactos. Redesplegadas en 11a: `verification` (v11), `signed-documents` (v17),
`delete-account` (v17) y `test-tools` (v15). Las de pagos (`billing-account`,
`create-portal-session`, `request-withdrawal`, `create-checkout-session`) se redesplegarán
con los cambios de tiendas del Bloque 11b.

## Equipos con antivirus que inspecciona TLS

Norton (Web/Mail Shield) sustituye los certificados HTTPS. Para compilar, Gradle necesita
un truststore temporal con esa raíz (`JAVA_TOOL_OPTIONS=-Djavax.net.ssl.trustStore=…`), y
para que el emulador llegue a Supabase, un overlay **local y no versionado** en
`android/app/src/debug/` (`network_security_config` con `debug-overrides`, que Android
ignora en release). Nunca se sube al repositorio (`.gitignore`).

## Puerta de publicación (Bloque 12)

- ❌ Firma de release, cuentas de Apple/Google, fichas 18+, privacy manifest y
  «Seguridad de los datos», URL de borrado de cuenta.
- ❌ App Links / Universal Links verificados; compilación y prueba en iPhone real.
- ❌ Push remoto (APNs/FCM), VoiceOver/TalkBack y rendimiento en dispositivos reales.
- ❌ Compras de tiendas reales (en 11b solo Test Store, nunca en una build de release).
- ✅ Contenedor, adaptadores nativos, permisos, CSP, almacenamiento seguro y biometría.
