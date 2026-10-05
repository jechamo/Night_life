# Cierre funcional de monetización web — 2026-10-05

Solicitud: completar las funciones anunciadas de los bloques 8 y 9, publicar y enviar el resultado a jchamorrorodriguez@gmail.com.

## Alcance y decisiones

- Chispa: acción en perfiles/deck, consume un crédito en una transacción con el like; aviso anónimo persistente al destinatario y actualización en tiempo real.
- Foco: activación desde el deck, consume un crédito; prioridad durante 30 minutos en el local seleccionado (requiere check-in vigente) o la ciudad del perfil, manteniendo todos los filtros de compatibilidad, edad, bloqueo y semáforo. La zona general usa la ciudad del descubrimiento existente, no un radio GPS nuevo.
- Prioridad VIP: ordenar los likes recibidos y los candidatos compatibles con likes entrantes antes de los ordinarios.
- Incógnito VIP: preferencia persistida; solo los usuarios a quienes se ha dado like y los matches existentes pueden ver el perfil. Al vencer VIP deja de aplicarse.
- Temas: conservar gratis los cinco temas base (PRD 8.2); añadir temas exclusivos del Pase y volver a un tema base al perder el permiso.
- Patrocinadas: tarjetas de locales propios, etiquetadas, cercanos y abiertos, como máximo una por cada diez perfiles; el Pase elimina estas tarjetas.
- Mensaje previo al match: activar la función ya existente, con consumo y validación del semáforo en el servidor.
- Catálogo: Chispas de 1/5/15, Pase mensual/trimestral/anual; precios de prueba propuestos: 1 Chispa 1,49 €, 15 Chispas 11,99 €, Pase trimestral 26,99 €, anual 89,99 €. Mantener los precios existentes.
- Locales: Checkout Stripe para patrocinios de 30 días (Destacado 29 €, Plus 49 €, Top 79 €) y Estadísticas Pro mensual (19,99 €). Importes provisionales de prueba; ningún cobro real ni activación de modo live.
- Pro: mantener estadísticas básicas gratuitas; detalles por hora/edad/semáforo y comparación de zona bajo suscripción, con umbrales de anonimato.

## Implementación

1. Migraciones aditivas, RPC públicas invoker y funciones privadas de autorización/consumo. Serializar saldo y acciones para evitar gasto duplicado; aislar TEST/LIVE.
2. Extender facturación con productos de local y permisos por local, separados de la suscripción personal. Checkout valida la gestión del local; webhook firmado activa, renueva y revoca por cancelación/reembolso. Reservas de patrocinio con caducidad y límite de huecos por ciudad.
3. Hooks/servicios/adaptadores, controles accesibles y traducciones ES/EN. No llamadas de Supabase desde pantallas.
4. Catálogo Stripe TEST, tipos generados y flags desplegados con los controles existentes de testers.
5. Pruebas de consumo, idempotencia, ranking, privacidad, permisos de local y ciclos de pago; comprobación de tipos/lint/formato/build, Advisors y auditoría de dependencias/red.
6. Commit/push, despliegues Edge y web, comprobación de versión publicada. Documentar evidencias y enviar un correo con resultados reales y limitaciones.

## Criterio de cierre

Cada ventaja anunciada tiene una acción observable y autorización del servidor. El correo debe distinguir el despliegue de producción de los pagos en Stripe TEST. No declarar completada la QA física pendiente del bloque 10 ni iniciar aplicaciones nativas del bloque 11.
