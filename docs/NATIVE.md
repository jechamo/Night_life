# Paso a nativa — Bloques 10/11

El Bloque 10 prepara los contratos; el empaquetado iOS/Android y la facturación
de tiendas pertenecen al Bloque 11. No hay proyecto Capacitor, binarios, firma
de tiendas ni adaptadores nativos implementados. Referencias: PRD 3.3–3.5,
Anexo B y [guía oficial de Capacitor](https://capacitorjs.com/docs/getting-started).

## Punto de partida

`src/platform/platform.ts` reúne las capacidades. Las pantallas reciben puertos
mediante `usePlatform()`, sin importar implementaciones web. ESLint comprueba
esta separación. `detectRuntime()` reconoce Capacitor, pero `main.tsx` todavía
construye `createWebPlatform()` y emite un aviso si detecta una shell nativa.
Ese aviso no sustituye a `createNativePlatform()` ni acredita compatibilidad.

| Puerto                        | Web actual                                         | Trabajo para nativa                                                                 |
| ----------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `geolocation`                 | API del navegador, permisos y errores tipados      | Permisos iOS/Android; posición solo para cálculos de proximidad                     |
| `camera`, `images`            | Selector/cámara y procesamiento de imagen          | Cámara/galería, permisos, orientación, quitar metadatos antes de subir              |
| `secureStorage`               | `localStorage`, namespace `nl.secure.`             | Keychain/Keystore; probar renovación, logout y borrado de tokens                    |
| `preferences`                 | Preferencias no sensibles persistidas              | Almacén nativo asíncrono; conservar tema, idioma y movimiento                       |
| `deviceId`                    | ID local reiniciable                               | ID propio de instalación; sigue siendo señal auxiliar, nunca identidad de confianza |
| `browser`, `deepLinks`        | HTTPS permitido y retornos al origen               | Navegador del sistema, Universal Links/App Links y recepción validada               |
| `files`, `share`              | Descarga de Blob y compartir con fallback          | Archivos temporales privados, compartir y limpieza de export/PDF                    |
| `audio`, `haptics`            | Audio web y vibración/fallback                     | Interrupciones, ciclo de vida y feedback accesible                                  |
| `biometrics`, `notifications` | Disponibilidad/fallback web limitado               | Autenticación local y push nativo; no conceden roles ni entitlements                |
| `appUpdates`                  | Service worker, conexión y actualización explícita | Puerto sin registro SW; actualización de binario mediante tiendas                   |

El nombre `secureStorage` describe el contrato: la implementación web no cifra
`localStorage` ni protege frente a código ejecutado en el mismo origen. CSP,
renderizado seguro y dependencia auditada siguen siendo necesarios.

## Secuencia del Bloque 11

1. Elegir versiones y plugins desde documentación oficial, comprobar licencias y
   mantener el catálogo de dependencias autorizado. Crear configuración Capacitor,
   proyectos de tiendas y `createNativePlatform()`.
2. Seleccionar la factory por runtime antes de crear servicios. Nunca utilizar la
   factory web como fallback silencioso en un binario distribuido.
3. Registrar permisos con explicaciones ES/EN. Probar denegación, permiso limitado,
   retorno desde ajustes, pérdida de conexión y pausa/reanudación.
4. Pasar almacenamiento y retornos por los puertos. La sesión conserva su contador
   de generación para descartar resultados privados tras cambiar de usuario.
5. Implementar las estrategias `app_store` y `play_store`. Hoy la selección con
   `runtime=native` devuelve `disabled`; cambiar solo el runtime no implementa pagos.
   Verificar compras/restauración y eventos de tienda en servidor; el cliente sigue
   consultando entitlements y nunca concede ventajas por una pantalla de éxito.
6. Probar enlaces verificados, cancelación/retorno de verificación, fotos, permisos,
   teclado, safe areas, accesibilidad, borrado/export y suspensión de la app.

## Puerta de publicación

- ❌ Binarios iOS/Android firmados, permisos y enlaces asociados reales.
- ❌ Sandbox de ambas tiendas, restauración, doble entrega y revocación verificadas.
- ❌ VoiceOver/TalkBack y rendimiento medido en dispositivos reales.
- ❌ Revisión de políticas vigentes de tiendas, datos de empresa, privacidad y fichas.
- ✅ Contratos de plataforma y estrategia de pago con fallo cerrado existentes.

La contratación, secretos live, acuerdos y lanzamiento requieren la puerta del
Bloque 12. Una PWA instalada desde el navegador no acredita estas pruebas nativas.
