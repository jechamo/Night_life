import type { Language } from '@/i18n'
import type { LegalDocument, LegalDocumentSlug } from '@/features/legal/model/legal'

/**
 * DRAFTS of the public legal pages that are not signed at sign-up (PRD 6.1 docs 1 and
 * 5-10). A lawyer must review them before launch; [DATOS EMPRESA] markers are filled
 * with the company data. From Block 5 they live versioned in `legal_documents`.
 */
type Draft = Omit<LegalDocument, 'slug' | 'version' | 'effectiveAt'>
type PublicSlug = Exclude<LegalDocumentSlug, 'terms' | 'community' | 'privacy'>

const ES: Record<PublicSlug, Draft> = {
  legal_notice: {
    title: 'Aviso Legal',
    summary: 'Quién está detrás de Nightlife Connect y cómo contactarnos.',
    sections: [
      {
        heading: 'Titular',
        body: '[DATOS EMPRESA: razón social, NIF, domicilio social, datos registrales y email de contacto].',
      },
      {
        heading: 'Punto de contacto DSA',
        body: 'Punto único de contacto para autoridades y usuarios (Reglamento de Servicios Digitales, arts. 11 y 12): [DATOS EMPRESA: email]. Idiomas: español e inglés.',
      },
      {
        heading: 'Propiedad intelectual',
        body: 'La marca, el diseño y el código pertenecen al titular. Los contenidos publicados por los usuarios son suyos; nos dan una licencia limitada para mostrarlos en el servicio.',
      },
      {
        heading: 'Responsabilidad',
        body: 'La información de locales y eventos es orientativa. Las estadísticas son agregadas y anónimas y pueden no reflejar la realidad exacta.',
      },
    ],
  },
  cookies: {
    title: 'Política de Cookies y Tecnologías Similares',
    summary: 'Solo usamos almacenamiento técnico necesario. Sin cookies de publicidad ni rastreo.',
    sections: [
      {
        heading: 'Qué usamos',
        body: 'Almacenamiento local del navegador para recordar tu sesión, tu tema, el idioma y tus preferencias de movimiento. Son técnicos y necesarios para que el servicio funcione.',
      },
      {
        heading: 'Qué no usamos',
        body: 'No hay cookies de publicidad, ni redes de anuncios, ni píxeles de seguimiento de terceros.',
      },
      {
        heading: 'Analítica',
        body: 'Solo si la aceptas en el onboarding o en Ajustes, autoalojada o en la UE, y como máximo 13 meses. Puedes retirarla cuando quieras.',
      },
    ],
  },
  ranking: {
    title: 'Transparencia de Clasificación y Patrocinados',
    summary: 'Cómo ordenamos locales, eventos y personas, y cómo se marcan los patrocinios.',
    sections: [
      {
        heading: 'Orden en el mapa y en las listas',
        body: 'Por distancia, si está abierto y afluencia en directo. Los filtros que eliges se aplican siempre antes que cualquier otro criterio.',
      },
      {
        heading: 'Patrocinados',
        body: 'Llevan siempre la etiqueta «Patrocinado», solo aparecen si cumplen tus filtros, los huecos son limitados y nunca alteran las estadísticas.',
      },
      {
        heading: 'Personas',
        body: 'El emparejamiento funciona por reglas, sin IA: compatibilidad mutua, cercanía y actividad de esta noche. Las ventajas de pago dan visibilidad, nunca saltan los filtros ni el semáforo de la otra persona.',
      },
    ],
  },
  venues: {
    title: 'Condiciones para Locales y Organizadores',
    summary: 'Reclamar y gestionar la ficha de tu local es gratis.',
    sections: [
      {
        heading: 'Reclamar la ficha',
        body: 'Debes acreditar que gestionas el local. Revisamos cada solicitud a mano antes de darte acceso.',
      },
      {
        heading: 'Qué puedes hacer',
        body: 'Editar descripción, horario y precio, publicar eventos oficiales y ver estadísticas agregadas (nunca datos de personas concretas, y solo con un mínimo de asistentes).',
      },
      {
        heading: 'Obligaciones',
        body: 'Información veraz, respeto de la normativa de alcohol y de tu comunidad autónoma, y de las Normas de la Comunidad.',
      },
    ],
  },
  sponsorship: {
    title: 'Condiciones de Patrocinio',
    summary: 'Tres niveles (Destacado, Destacado Plus y Top) con reglas fijas.',
    sections: [
      {
        heading: 'Niveles',
        body: 'Destacado, Destacado Plus y Top. [PRECIOS A DEFINIR]. En el MVP se contratan por factura y los activa el equipo.',
      },
      {
        heading: 'Reglas fijas',
        body: 'Etiqueta siempre visible, sin alterar datos, solo si cumple los filtros del usuario y con huecos limitados.',
      },
      {
        heading: 'Alcohol y Flash Alerts',
        body: 'Solo a mayores con edad verificada que lo hayan consentido y según la normativa autonómica.',
      },
    ],
  },
  premium: {
    title: 'Condiciones de Premium',
    summary:
      'Suscripciones, pase de una noche y extras sueltos. Lo básico y la seguridad siempre son gratis.',
    sections: [
      {
        heading: 'Qué compras',
        body: 'Ventajas de comodidad (Pase, Pase VIP, Pase de una noche) y extras sueltos (Chispas, Foco, Mensaje directo). Precios con IVA incluido antes de pagar.',
      },
      {
        heading: 'Renovación y cancelación',
        body: 'Las suscripciones se renuevan cada mes hasta que canceles en dos toques desde Mi suscripción. Mantienes las ventajas hasta el final del periodo pagado.',
      },
      {
        heading: 'Desistimiento',
        body: 'Tienes 14 días desde la compra para desistir desde Mi suscripción, con reembolso completo. En las apps, las compras las gestiona la tienda (Apple o Google) según sus condiciones.',
      },
      {
        heading: 'Pagos',
        body: 'Los procesa una pasarela segura (Stripe en la web; App Store o Google Play en las apps). Nunca vemos ni guardamos tu tarjeta. Facturas disponibles en Mi suscripción.',
      },
    ],
  },
  third_parties: {
    title: 'Lista pública de terceros',
    summary:
      'Proveedores que tratan datos para prestar el servicio, dónde están y con qué garantías.',
    sections: [
      {
        heading: 'Supabase',
        body: 'Base de datos, autenticación, archivos y funciones. Unión Europea (eu-west-1).',
      },
      {
        heading: 'Vercel',
        body: 'Alojamiento de la web. Región UE para las funciones; red de entrega global con garantías del Marco de Privacidad de Datos UE-EE. UU. y cláusulas tipo.',
      },
      {
        heading: 'Proveedor de SMS',
        body: 'Envío del código OTP. [Por definir, con garantías UE].',
      },
      {
        heading: 'Veriff',
        body: 'Verificación de edad e identidad en integración de test; solo recibimos el resultado. Unión Europea. Las decisiones de prueba no acreditan identidad real.',
      },
      {
        heading: 'Yoti',
        body: 'Alternativa de verificación de edad e identidad; solo recibimos el resultado. Reino Unido (decisión de adecuación).',
      },
      {
        heading: 'Mapbox y Google Places',
        body: 'Mapa y datos de locales (las consultas a Google se hacen desde el servidor). EE. UU. (DPF / cláusulas tipo).',
      },
      { heading: 'Spotify', body: 'Solo si conectas tu Anthem. Unión Europea.' },
      {
        heading: 'Email transaccional',
        body: 'Documentos firmados y avisos. [Por definir, preferiblemente UE].',
      },
      {
        heading: 'Stripe',
        body: 'Pagos web. Irlanda / EE. UU. Integrado en modo de pruebas y desactivado para el público.',
      },
      {
        heading: 'Apple y Google',
        body: 'Compras dentro de las apps y notificaciones push, cuando existan las apps nativas. EE. UU. (DPF).',
      },
    ],
  },
}

const EN: Record<PublicSlug, Draft> = {
  legal_notice: {
    title: 'Legal Notice',
    summary: 'Who is behind Nightlife Connect and how to reach us.',
    sections: [
      {
        heading: 'Owner',
        body: '[COMPANY DATA: legal name, tax ID, registered address, registry data and contact email].',
      },
      {
        heading: 'DSA point of contact',
        body: 'Single point of contact for authorities and users (Digital Services Act, arts. 11 and 12): [COMPANY DATA: email]. Languages: Spanish and English.',
      },
      {
        heading: 'Intellectual property',
        body: 'The brand, design and code belong to the owner. Content posted by users is theirs; they grant us a limited licence to show it in the service.',
      },
      {
        heading: 'Liability',
        body: 'Venue and event information is indicative. Stats are aggregated and anonymous and may not reflect reality exactly.',
      },
    ],
  },
  cookies: {
    title: 'Cookies and Similar Technologies Policy',
    summary: 'We only use necessary technical storage. No advertising or tracking cookies.',
    sections: [
      {
        heading: 'What we use',
        body: 'Browser local storage to remember your session, theme, language and motion preferences. They are technical and necessary for the service to work.',
      },
      {
        heading: 'What we do not use',
        body: 'No advertising cookies, ad networks or third-party tracking pixels.',
      },
      {
        heading: 'Analytics',
        body: 'Only if you accept it during onboarding or in Settings, self-hosted or in the EU, for 13 months at most. You can withdraw it any time.',
      },
    ],
  },
  ranking: {
    title: 'Ranking and Sponsored Content Transparency',
    summary: 'How we order venues, events and people, and how sponsorships are labelled.',
    sections: [
      {
        heading: 'Order on the map and in lists',
        body: 'By distance, whether it is open and live attendance. The filters you choose always apply before any other criterion.',
      },
      {
        heading: 'Sponsored',
        body: 'Always labelled "Sponsored", only shown if they match your filters, with limited slots, and they never alter the stats.',
      },
      {
        heading: 'People',
        body: 'Matching is rule-based, without AI: mutual compatibility, proximity and tonight’s activity. Paid perks give visibility; they never skip filters or the other person’s traffic light.',
      },
    ],
  },
  venues: {
    title: 'Terms for Venues and Organisers',
    summary: 'Claiming and managing your venue’s page is free.',
    sections: [
      {
        heading: 'Claiming the page',
        body: 'You must prove you manage the venue. We review every request by hand before granting access.',
      },
      {
        heading: 'What you can do',
        body: 'Edit description, opening hours and price, publish official events and see aggregated stats (never individual data, and only above a minimum number of people).',
      },
      {
        heading: 'Obligations',
        body: 'Truthful information, compliance with alcohol rules in your region, and with the Community Guidelines.',
      },
    ],
  },
  sponsorship: {
    title: 'Sponsorship Terms',
    summary: 'Three tiers (Featured, Featured Plus and Top) with fixed rules.',
    sections: [
      {
        heading: 'Tiers',
        body: 'Featured, Featured Plus and Top. [PRICES TBD]. In the MVP they are invoiced and activated by the team.',
      },
      {
        heading: 'Fixed rules',
        body: 'Label always visible, data never altered, only shown if it matches the user’s filters, with limited slots.',
      },
      {
        heading: 'Alcohol and Flash Alerts',
        body: 'Only to age-verified adults who consented, and according to regional rules.',
      },
    ],
  },
  premium: {
    title: 'Premium Terms',
    summary: 'Subscriptions, one-night pass and extras. The basics and safety are always free.',
    sections: [
      {
        heading: 'What you buy',
        body: 'Comfort perks (Pass, VIP Pass, One-night pass) and extras (Sparks, Spotlight, Direct message). Prices include VAT and are shown before paying.',
      },
      {
        heading: 'Renewal and cancellation',
        body: 'Subscriptions renew every month until you cancel in two taps from My subscription. You keep the perks until the end of the paid period.',
      },
      {
        heading: 'Withdrawal',
        body: 'You have 14 days from purchase to withdraw from My subscription, with a full refund. In the apps, purchases are handled by the store (Apple or Google) under its terms.',
      },
      {
        heading: 'Payments',
        body: 'Handled by a secure gateway (Stripe on the web; App Store or Google Play in the apps). We never see or store your card. Invoices are in My subscription.',
      },
    ],
  },
  third_parties: {
    title: 'Public list of third parties',
    summary:
      'Providers that process data to run the service, where they are and with what safeguards.',
    sections: [
      {
        heading: 'Supabase',
        body: 'Database, authentication, files and functions. European Union (eu-west-1).',
      },
      {
        heading: 'Vercel',
        body: 'Web hosting. EU region for functions; global delivery network under the EU-US Data Privacy Framework and standard clauses.',
      },
      { heading: 'SMS provider', body: 'Sends the OTP code. [TBD, with EU safeguards].' },
      {
        heading: 'Veriff',
        body: 'Age and identity verification in a test integration; we only receive the result. European Union. Test decisions do not prove a real identity.',
      },
      {
        heading: 'Yoti',
        body: 'Alternative age and identity verification; we only receive the result. United Kingdom (adequacy decision).',
      },
      {
        heading: 'Mapbox and Google Places',
        body: 'Map and venue data (Google is queried from the server). USA (DPF / standard clauses).',
      },
      { heading: 'Spotify', body: 'Only if you connect your Anthem. European Union.' },
      {
        heading: 'Transactional email',
        body: 'Signed documents and notices. [TBD, preferably EU].',
      },
      {
        heading: 'Stripe',
        body: 'Web payments. Ireland / USA. Integrated in test mode and disabled for the public.',
      },
      {
        heading: 'Apple and Google',
        body: 'In-app purchases and push notifications, once native apps exist. USA (DPF).',
      },
    ],
  },
}

export function getPublicLegalDraft(slug: LegalDocumentSlug, language: Language): Draft | null {
  const source = language === 'en' ? EN : ES
  return slug in source ? source[slug as PublicSlug] : null
}
