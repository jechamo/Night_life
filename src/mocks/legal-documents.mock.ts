import type { Language } from '@/i18n'
import type { LegalDocument, LegalDocumentSlug } from '@/features/legal/model/legal'
import { getPublicLegalDraft } from './legal-public.mock'

/**
 * DRAFT legal texts for the mock phase (PRD 6.1). They must be written/reviewed by a
 * lawyer before launch; [DATOS EMPRESA] markers are filled with the company data.
 * From Block 5 they live versioned in `legal_documents`.
 */
type Draft = Omit<LegalDocument, 'slug' | 'version' | 'effectiveAt'>

const ES: Partial<Record<LegalDocumentSlug, Draft>> = {
  terms: {
    title: 'Términos y Condiciones',
    summary: 'Las reglas del servicio: quién puede usarlo, qué ofrecemos y qué no está permitido.',
    sections: [
      {
        heading: 'Quiénes somos',
        body: 'Nightlife Connect es un servicio de [DATOS EMPRESA: razón social, NIF, domicilio, email de contacto].',
      },
      {
        heading: 'Solo mayores de edad',
        body: 'El servicio es exclusivamente para mayores de 18 años. Para ver perfiles, dar likes, chatear, marcar «Voy», hacer check-in visible o crear eventos es obligatorio verificar la mayoría de edad.',
      },
      {
        heading: 'Qué ofrecemos',
        body: 'Información en tiempo real sobre locales y eventos, estadísticas agregadas y anónimas de afluencia y herramientas para conocer gente. Las funciones básicas, las verificaciones y la seguridad son siempre gratuitas.',
      },
      {
        heading: 'Tu cuenta',
        body: 'Una cuenta por persona y por teléfono. Eres responsable de lo que publiques. Puedes eliminar tu cuenta cuando quieras desde la app.',
      },
      {
        heading: 'Moderación',
        body: 'Aplicamos las Normas de la Comunidad. Las decisiones se explican y puedes recurrirlas; siempre las revisa una persona.',
      },
      {
        heading: 'Ley aplicable',
        body: 'Legislación española. [DATOS EMPRESA: jurisdicción y datos de resolución de litigios].',
      },
    ],
  },
  community: {
    title: 'Normas de la Comunidad',
    summary: 'Respeto, consentimiento y seguridad. Lo que hace que la noche funcione para todos.',
    sections: [
      {
        heading: 'Respeto y consentimiento',
        body: 'No se toleran el acoso, la insistencia tras un «no», el odio ni la discriminación. El semáforo rojo significa invisible: respétalo.',
      },
      {
        heading: 'Personas reales',
        body: 'Tus fotos tienen que ser tuyas y actuales. Prohibido suplantar a otras personas o crear perfiles falsos.',
      },
      {
        heading: 'Nada de menores',
        body: 'Si sospechas que alguien es menor, repórtalo con el motivo «posible menor». Suspendemos la cuenta de forma cautelar.',
      },
      {
        heading: 'Eventos honestos',
        body: 'Solo en lugares públicos y reales. Los eventos falsos se ocultan tras 3 reportes y se revisan.',
      },
      {
        heading: 'Tres avisos',
        body: '3 reportes válidos en 6 horas suspenden la cuenta hasta la revisión humana.',
      },
    ],
  },
  privacy: {
    title: 'Política de Privacidad',
    summary:
      'Qué datos tratamos, para qué, con qué base legal, cuánto tiempo y cuáles son tus derechos.',
    sections: [
      {
        heading: 'Responsable',
        body: '[DATOS EMPRESA: razón social, NIF, domicilio, email del Delegado de Protección de Datos].',
      },
      {
        heading: 'Qué tratamos',
        body: 'Teléfono (y email opcional), fecha de nacimiento declarada, perfil, preferencias (solo con tu consentimiento explícito), check-ins sin posición GPS, likes, matches y mensajes, y resultados de verificación como sí/no.',
      },
      {
        heading: 'Lo que nunca guardamos',
        body: 'DNI, imágenes de documentos, selfies, vídeos ni descriptores faciales. Las fotos se suben sin metadatos de ubicación.',
      },
      {
        heading: 'Bases legales',
        body: 'Contrato, interés legítimo (seguridad y antifraude), protección de menores, obligación legal y tu consentimiento, que puedes retirar en cualquier momento.',
      },
      {
        heading: 'Plazos',
        body: 'Check-ins 30 días, objetos perdidos 48 horas, datos técnicos 90 días, moderación 2 años. El resto, mientras la cuenta esté activa.',
      },
      {
        heading: 'Tus derechos',
        body: 'Acceso, rectificación, supresión, oposición, limitación y portabilidad desde Privacidad y datos, con respuesta en un mes como máximo. Puedes reclamar ante la AEPD.',
      },
      {
        heading: 'Terceros',
        body: 'Proveedores en la UE o con garantías adecuadas. Consulta la lista pública de terceros.',
      },
    ],
  },
}

const EN: Partial<Record<LegalDocumentSlug, Draft>> = {
  terms: {
    title: 'Terms and Conditions',
    summary: 'The service rules: who can use it, what we offer and what is not allowed.',
    sections: [
      {
        heading: 'Who we are',
        body: 'Nightlife Connect is a service of [COMPANY DATA: legal name, tax ID, address, contact email].',
      },
      {
        heading: 'Adults only',
        body: 'The service is only for people aged 18 or over. Viewing profiles, liking, chatting, marking “Going”, visible check-ins and creating events require age verification.',
      },
      {
        heading: 'What we offer',
        body: 'Real-time information about venues and events, aggregated anonymous crowd statistics and tools to meet people. Core features, verifications and safety are always free.',
      },
      {
        heading: 'Your account',
        body: 'One account per person and phone number. You are responsible for what you post. You can delete your account at any time from the app.',
      },
      {
        heading: 'Moderation',
        body: 'We apply the Community Guidelines. Decisions are explained and can be appealed; a person always reviews them.',
      },
      {
        heading: 'Governing law',
        body: 'Spanish law. [COMPANY DATA: jurisdiction and dispute resolution details].',
      },
    ],
  },
  community: {
    title: 'Community Guidelines',
    summary: 'Respect, consent and safety. What makes the night work for everyone.',
    sections: [
      {
        heading: 'Respect and consent',
        body: 'No harassment, no insisting after a “no”, no hate or discrimination. A red light means invisible: respect it.',
      },
      {
        heading: 'Real people',
        body: 'Your photos must be yours and recent. Impersonation and fake profiles are forbidden.',
      },
      {
        heading: 'No minors',
        body: 'If you suspect someone is a minor, report them with the “possible minor” reason. We suspend the account as a precaution.',
      },
      {
        heading: 'Honest events',
        body: 'Only in real public places. Fake events are hidden after 3 reports and reviewed.',
      },
      {
        heading: 'Three strikes',
        body: '3 valid reports within 6 hours suspend the account until a human review.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    summary: 'Which data we process, why, on which legal basis, for how long and your rights.',
    sections: [
      {
        heading: 'Controller',
        body: '[COMPANY DATA: legal name, tax ID, address, Data Protection Officer email].',
      },
      {
        heading: 'What we process',
        body: 'Phone (and optional email), declared date of birth, profile, preferences (only with your explicit consent), check-ins without GPS position, likes, matches and messages, and verification results as yes/no.',
      },
      {
        heading: 'What we never keep',
        body: 'ID numbers, document images, selfies, videos or face descriptors. Photos are uploaded without location metadata.',
      },
      {
        heading: 'Legal bases',
        body: 'Contract, legitimate interest (safety and anti-fraud), protection of minors, legal obligation and your consent, which you can withdraw at any time.',
      },
      {
        heading: 'Retention',
        body: 'Check-ins 30 days, lost & found 48 hours, technical data 90 days, moderation 2 years. Everything else while the account is active.',
      },
      {
        heading: 'Your rights',
        body: 'Access, rectification, erasure, objection, restriction and portability from Privacy & data, answered within one month. You can complain to the Spanish DPA (AEPD).',
      },
      {
        heading: 'Third parties',
        body: 'Providers in the EU or with adequate safeguards. See the public third-party list.',
      },
    ],
  },
}

export const MOCK_LEGAL_VERSION = '1.0'
export const MOCK_LEGAL_EFFECTIVE_AT = '2026-10-01T00:00:00Z'

export function getMockLegalDocument(
  slug: LegalDocumentSlug,
  language: Language,
): LegalDocument | null {
  const draft = (language === 'en' ? EN : ES)[slug] ?? getPublicLegalDraft(slug, language)
  return draft
    ? { slug, version: MOCK_LEGAL_VERSION, effectiveAt: MOCK_LEGAL_EFFECTIVE_AT, ...draft }
    : null
}
