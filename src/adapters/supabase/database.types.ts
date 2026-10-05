export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: string
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: string
          id?: never
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: string
          id?: never
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          allowed_values: string[] | null
          key: string
          kind: string
          max_value: number | null
          min_value: number | null
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          allowed_values?: string[] | null
          key: string
          kind: string
          max_value?: number | null
          min_value?: number | null
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          allowed_values?: string[] | null
          key?: string
          kind?: string
          max_value?: number | null
          min_value?: number | null
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      appeals: {
        Row: {
          created_at: string
          decision_id: string
          explanation: string | null
          id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decision_id: string
          explanation?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          decision_id?: string
          explanation?: string | null
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'appeals_decision_id_fkey'
            columns: ['decision_id']
            isOneToOne: true
            referencedRelation: 'moderation_decisions'
            referencedColumns: ['id']
          },
        ]
      }
      attendance: {
        Row: {
          created_at: string
          event_id: string | null
          expires_at: string
          id: string
          is_test: boolean
          kind: string
          user_id: string
          venue_id: string | null
          visible: boolean
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          expires_at: string
          id?: string
          is_test?: boolean
          kind: string
          user_id: string
          venue_id?: string | null
          visible?: boolean
        }
        Update: {
          created_at?: string
          event_id?: string | null
          expires_at?: string
          id?: string
          is_test?: boolean
          kind?: string
          user_id?: string
          venue_id?: string | null
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'attendance_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'attendance_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      ban_identifiers: {
        Row: {
          created_at: string
          expires_at: string | null
          hmac: string
          id: string
          kind: string
          reason: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          hmac: string
          id?: string
          kind: string
          reason?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          hmac?: string
          id?: string
          kind?: string
          reason?: string
        }
        Relationships: []
      }
      bans: {
        Row: {
          created_at: string
          created_by: string | null
          decision_id: string | null
          id: string
          reason: string
          until: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decision_id?: string | null
          id?: string
          reason: string
          until?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decision_id?: string | null
          id?: string
          reason?: string
          until?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'bans_decision_id_fkey'
            columns: ['decision_id']
            isOneToOne: false
            referencedRelation: 'moderation_decisions'
            referencedColumns: ['id']
          },
        ]
      }
      billing_notices: {
        Row: {
          attempts: number
          created_at: string
          id: string
          lease_token: string | null
          lease_until: string | null
          next_attempt_at: string
          sent_at: string | null
          source_ref: string
          status: string
          template: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          lease_token?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          sent_at?: string | null
          source_ref: string
          status?: string
          template: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          lease_token?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          sent_at?: string | null
          source_ref?: string
          status?: string
          template?: string
          user_id?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          consent_key: string | null
          created_at: string
          document_slug: string | null
          document_version: string | null
          granted: boolean
          id: string
          kind: string
          method: string
          user_id: string | null
        }
        Insert: {
          consent_key?: string | null
          created_at?: string
          document_slug?: string | null
          document_version?: string | null
          granted: boolean
          id?: string
          kind: string
          method: string
          user_id?: string | null
        }
        Update: {
          consent_key?: string | null
          created_at?: string
          document_slug?: string | null
          document_version?: string | null
          granted?: boolean
          id?: string
          kind?: string
          method?: string
          user_id?: string | null
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          created_at: string
          delta: number
          id: number
          kind: string
          mode: string
          origin_ref: string | null
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: never
          kind: string
          mode?: string
          origin_ref?: string | null
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: never
          kind?: string
          mode?: string
          origin_ref?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      data_requests: {
        Row: {
          closed_at: string | null
          created_at: string
          due_at: string
          explanation: string | null
          id: string
          kind: string
          status: string
          user_id: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          due_at?: string
          explanation?: string | null
          id?: string
          kind: string
          status?: string
          user_id?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          due_at?: string
          explanation?: string | null
          id?: string
          kind?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          lease_token: string | null
          lease_until: string | null
          next_attempt_at: string
          sent_at: string | null
          status: string
          template: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          sent_at?: string | null
          status?: string
          template: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          lease_token?: string | null
          lease_until?: string | null
          next_attempt_at?: string
          sent_at?: string | null
          status?: string
          template?: string
          user_id?: string
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          created_at: string
          ends_at: string | null
          granted_by: string | null
          id: string
          key: string
          mode: string
          origin_ref: string | null
          source: string
          starts_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          granted_by?: string | null
          id?: string
          key: string
          mode?: string
          origin_ref?: string | null
          source: string
          starts_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          granted_by?: string | null
          id?: string
          key?: string
          mode?: string
          origin_ref?: string | null
          source?: string
          starts_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      event_confirmations: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'event_confirmations_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
      event_reports: {
        Row: {
          created_at: string
          event_id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'event_reports_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
      events: {
        Row: {
          address: string
          category: string
          created_at: string
          created_by: string | null
          description: string
          ends_at: string
          external_id: string | null
          hidden_at: string | null
          id: string
          is_test: boolean
          location: unknown
          origin: string
          place_name: string
          source: string
          starts_at: string
          status: Database['public']['Enums']['event_status']
          title: string
          venue_id: string | null
        }
        Insert: {
          address: string
          category: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at: string
          external_id?: string | null
          hidden_at?: string | null
          id?: string
          is_test?: boolean
          location: unknown
          origin: string
          place_name: string
          source?: string
          starts_at: string
          status?: Database['public']['Enums']['event_status']
          title: string
          venue_id?: string | null
        }
        Update: {
          address?: string
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          ends_at?: string
          external_id?: string | null
          hidden_at?: string | null
          id?: string
          is_test?: boolean
          location?: unknown
          origin?: string
          place_name?: string
          source?: string
          starts_at?: string
          status?: Database['public']['Enums']['event_status']
          title?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'events_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      flash_alerts: {
        Row: {
          body: string
          contains_alcohol: boolean
          created_at: string
          ends_at: string
          id: string
          starts_at: string
          status: string
          title: string
          venue_id: string
        }
        Insert: {
          body: string
          contains_alcohol?: boolean
          created_at?: string
          ends_at: string
          id?: string
          starts_at: string
          status?: string
          title: string
          venue_id: string
        }
        Update: {
          body?: string
          contains_alcohol?: boolean
          created_at?: string
          ends_at?: string
          id?: string
          starts_at?: string
          status?: string
          title?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'flash_alerts_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      gdpr_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          subject_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          subject_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          subject_id?: string | null
        }
        Relationships: []
      }
      illegal_content_notices: {
        Row: {
          category: string
          created_at: string
          email: string
          id: string
          reference: string
          report_id: string
          url: string
        }
        Insert: {
          category: string
          created_at?: string
          email: string
          id?: string
          reference: string
          report_id: string
          url: string
        }
        Update: {
          category?: string
          created_at?: string
          email?: string
          id?: string
          reference?: string
          report_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: 'illegal_content_notices_report_id_fkey'
            columns: ['report_id']
            isOneToOne: false
            referencedRelation: 'reports'
            referencedColumns: ['id']
          },
        ]
      }
      invoices: {
        Row: {
          amount_cents: number
          hosted_url: string | null
          id: string
          issued_at: string
          mode: string
          payment_intent_id: string | null
          plan_code: string
          provider: string
          provider_invoice_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          hosted_url?: string | null
          id?: string
          issued_at?: string
          mode?: string
          payment_intent_id?: string | null
          plan_code: string
          provider: string
          provider_invoice_id?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          hosted_url?: string | null
          id?: string
          issued_at?: string
          mode?: string
          payment_intent_id?: string | null
          plan_code?: string
          provider?: string
          provider_invoice_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_plan_code_fkey'
            columns: ['plan_code']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['code']
          },
        ]
      }
      legal_documents: {
        Row: {
          created_at: string
          effective_at: string
          id: string
          language: string
          sections: Json
          slug: string
          status: string
          summary: string
          title: string
          version: string
        }
        Insert: {
          created_at?: string
          effective_at: string
          id?: string
          language: string
          sections: Json
          slug: string
          status?: string
          summary: string
          title: string
          version: string
        }
        Update: {
          created_at?: string
          effective_at?: string
          id?: string
          language?: string
          sections?: Json
          slug?: string
          status?: string
          summary?: string
          title?: string
          version?: string
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          from_user: string
          id: string
          kind: string
          to_user: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          kind?: string
          to_user: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          kind?: string
          to_user?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'likes_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      lost_and_found: {
        Row: {
          created_at: string
          event_id: string | null
          expires_at: string
          id: string
          is_test: boolean
          parent_id: string | null
          text: string
          user_id: string | null
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          expires_at?: string
          id?: string
          is_test?: boolean
          parent_id?: string | null
          text: string
          user_id?: string | null
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          expires_at?: string
          id?: string
          is_test?: boolean
          parent_id?: string | null
          text?: string
          user_id?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'lost_and_found_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lost_and_found_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'lost_and_found'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'lost_and_found_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      matches: {
        Row: {
          contact_kind: string
          created_at: string
          id: string
          user_a: string
          user_b: string
          venue_id: string | null
        }
        Insert: {
          contact_kind?: string
          created_at?: string
          id?: string
          user_a: string
          user_b: string
          venue_id?: string | null
        }
        Update: {
          contact_kind?: string
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'matches_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          id: string
          match_id: string
          read_at: string | null
          sender_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          read_at?: string | null
          sender_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          read_at?: string | null
          sender_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
        ]
      }
      moderation_decisions: {
        Row: {
          action: string
          created_at: string
          decided_by: string | null
          explanation: string
          id: string
          reason: string
          report_id: string | null
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          decided_by?: string | null
          explanation: string
          id?: string
          reason: string
          report_id?: string | null
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          decided_by?: string | null
          explanation?: string
          id?: string
          reason?: string
          report_id?: string | null
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'moderation_decisions_report_id_fkey'
            columns: ['report_id']
            isOneToOne: false
            referencedRelation: 'reports'
            referencedColumns: ['id']
          },
        ]
      }
      payment_events: {
        Row: {
          id: string
          mode: string
          processed_at: string
          provider: string
          provider_event_id: string
          simulated: boolean
          type: string
          user_id: string | null
        }
        Insert: {
          id?: string
          mode?: string
          processed_at?: string
          provider: string
          provider_event_id: string
          simulated?: boolean
          type: string
          user_id?: string | null
        }
        Update: {
          id?: string
          mode?: string
          processed_at?: string
          provider?: string
          provider_event_id?: string
          simulated?: boolean
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      place_stats: {
        Row: {
          average_age: number | null
          event_id: string | null
          going_tonight: number
          green_percent: number | null
          id: string
          people: number
          ratio: Json | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          average_age?: number | null
          event_id?: string | null
          going_tonight?: number
          green_percent?: number | null
          id?: string
          people?: number
          ratio?: Json | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          average_age?: number | null
          event_id?: string | null
          going_tonight?: number
          green_percent?: number | null
          id?: string
          people?: number
          ratio?: Json | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'place_stats_event_id_fkey'
            columns: ['event_id']
            isOneToOne: true
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'place_stats_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: true
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      plans: {
        Row: {
          active: boolean
          apple_product_id: string | null
          billing_interval: string | null
          billing_interval_count: number
          code: string
          created_at: string
          credits: Json
          currency: string
          entitlements: string[]
          google_product_id: string | null
          kind: string
          price_cents: number
          stripe_price_id_live: string | null
          stripe_price_id_test: string | null
        }
        Insert: {
          active?: boolean
          apple_product_id?: string | null
          billing_interval?: string | null
          billing_interval_count?: number
          code: string
          created_at?: string
          credits?: Json
          currency?: string
          entitlements?: string[]
          google_product_id?: string | null
          kind: string
          price_cents: number
          stripe_price_id_live?: string | null
          stripe_price_id_test?: string | null
        }
        Update: {
          active?: boolean
          apple_product_id?: string | null
          billing_interval?: string | null
          billing_interval_count?: number
          code?: string
          created_at?: string
          credits?: Json
          currency?: string
          entitlements?: string[]
          google_product_id?: string | null
          kind?: string
          price_cents?: number
          stripe_price_id_live?: string | null
          stripe_price_id_test?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          anthem: Json | null
          banned: boolean
          bio: string
          birthdate: string
          city: string | null
          created_at: string
          discreet: boolean
          gender: Database['public']['Enums']['gender']
          id: string
          inactivity_warned_at: string | null
          is_test: boolean
          language: string
          last_active_at: string
          name: string
          onboarded_at: string | null
          photos: string[]
          suspended: boolean
          theme_id: string
          traffic_light: Database['public']['Enums']['traffic_light']
          updated_at: string
        }
        Insert: {
          anthem?: Json | null
          banned?: boolean
          bio?: string
          birthdate: string
          city?: string | null
          created_at?: string
          discreet?: boolean
          gender: Database['public']['Enums']['gender']
          id: string
          inactivity_warned_at?: string | null
          is_test?: boolean
          language?: string
          last_active_at?: string
          name: string
          onboarded_at?: string | null
          photos?: string[]
          suspended?: boolean
          theme_id?: string
          traffic_light?: Database['public']['Enums']['traffic_light']
          updated_at?: string
        }
        Update: {
          anthem?: Json | null
          banned?: boolean
          bio?: string
          birthdate?: string
          city?: string | null
          created_at?: string
          discreet?: boolean
          gender?: Database['public']['Enums']['gender']
          id?: string
          inactivity_warned_at?: string | null
          is_test?: boolean
          language?: string
          last_active_at?: string
          name?: string
          onboarded_at?: string | null
          photos?: string[]
          suspended?: boolean
          theme_id?: string
          traffic_light?: Database['public']['Enums']['traffic_light']
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          days: number
          expires_at: string
          max_uses: number
          plan_code: string
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          days: number
          expires_at: string
          max_uses: number
          plan_code: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          days?: number
          expires_at?: string
          max_uses?: number
          plan_code?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: 'promo_codes_plan_code_fkey'
            columns: ['plan_code']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['code']
          },
        ]
      }
      promo_redemptions: {
        Row: {
          code: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'promo_redemptions_code_fkey'
            columns: ['code']
            isOneToOne: false
            referencedRelation: 'promo_codes'
            referencedColumns: ['code']
          },
        ]
      }
      purchase_orders: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          mode: string
          paid_at: string | null
          plan_code: string
          price_id: string
          provider_payment_intent_id: string | null
          provider_session_id: string | null
          provider_subscription_id: string | null
          refunded_at: string | null
          simulated: boolean
          sponsorship_from: string | null
          status: string
          user_id: string | null
          venue_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          mode: string
          paid_at?: string | null
          plan_code: string
          price_id: string
          provider_payment_intent_id?: string | null
          provider_session_id?: string | null
          provider_subscription_id?: string | null
          refunded_at?: string | null
          simulated?: boolean
          sponsorship_from?: string | null
          status?: string
          user_id?: string | null
          venue_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          mode?: string
          paid_at?: string | null
          plan_code?: string
          price_id?: string
          provider_payment_intent_id?: string | null
          provider_session_id?: string | null
          provider_subscription_id?: string | null
          refunded_at?: string | null
          simulated?: boolean
          sponsorship_from?: string | null
          status?: string
          user_id?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'purchase_orders_plan_code_fkey'
            columns: ['plan_code']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['code']
          },
          {
            foreignKeyName: 'purchase_orders_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      ratings: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          night_date: string
          user_id: string
          venue_id: string | null
          vibe: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          night_date?: string
          user_id: string
          venue_id?: string | null
          vibe: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          night_date?: string
          user_id?: string
          venue_id?: string | null
          vibe?: string
        }
        Relationships: [
          {
            foreignKeyName: 'ratings_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ratings_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      reports: {
        Row: {
          comment: string
          created_at: string
          id: string
          notice_reference: string | null
          reason: string
          reporter_id: string | null
          status: string
          target_event_id: string | null
          target_user_id: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          comment?: string
          created_at?: string
          id?: string
          notice_reference?: string | null
          reason: string
          reporter_id?: string | null
          status?: string
          target_event_id?: string | null
          target_user_id?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          notice_reference?: string | null
          reason?: string
          reporter_id?: string | null
          status?: string
          target_event_id?: string | null
          target_user_id?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'reports_target_event_id_fkey'
            columns: ['target_event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
      safety_escalations: {
        Row: {
          created_at: string
          created_by: string | null
          explanation: string
          id: string
          report_id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          explanation: string
          id?: string
          report_id: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          explanation?: string
          id?: string
          report_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'safety_escalations_report_id_fkey'
            columns: ['report_id']
            isOneToOne: true
            referencedRelation: 'reports'
            referencedColumns: ['id']
          },
        ]
      }
      signup_attempts: {
        Row: {
          created_at: string
          id: number
          subject_hmac: string
        }
        Insert: {
          created_at?: string
          id?: never
          subject_hmac: string
        }
        Update: {
          created_at?: string
          id?: never
          subject_hmac?: string
        }
        Relationships: []
      }
      sponsorships: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          invoice_ref: string | null
          mode: string
          purchase_order_id: string | null
          requested_by: string | null
          starts_on: string
          status: string
          tier: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          invoice_ref?: string | null
          mode?: string
          purchase_order_id?: string | null
          requested_by?: string | null
          starts_on: string
          status?: string
          tier: string
          venue_id: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          invoice_ref?: string | null
          mode?: string
          purchase_order_id?: string | null
          requested_by?: string | null
          starts_on?: string
          status?: string
          tier?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sponsorships_purchase_order_id_fkey'
            columns: ['purchase_order_id']
            isOneToOne: true
            referencedRelation: 'purchase_orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sponsorships_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          current_period_end: string
          id: string
          mode: string
          plan_code: string
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          simulated: boolean
          started_at: string
          status: string
          updated_at: string
          user_id: string
          venue_id: string | null
          withdrawal_requested_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          current_period_end: string
          id?: string
          mode?: string
          plan_code: string
          provider: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          simulated?: boolean
          started_at?: string
          status: string
          updated_at?: string
          user_id: string
          venue_id?: string | null
          withdrawal_requested_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          current_period_end?: string
          id?: string
          mode?: string
          plan_code?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          simulated?: boolean
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          venue_id?: string | null
          withdrawal_requested_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'subscriptions_plan_code_fkey'
            columns: ['plan_code']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['code']
          },
          {
            foreignKeyName: 'subscriptions_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      swipe_passes: {
        Row: {
          created_at: string
          person_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          person_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          person_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_devices: {
        Row: {
          device_hmac: string
          first_seen_at: string
          user_id: string
        }
        Insert: {
          device_hmac: string
          first_seen_at?: string
          user_id: string
        }
        Update: {
          device_hmac?: string
          first_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          age_max: number
          age_min: number
          interested_in: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          age_max: number
          age_min: number
          interested_in: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          age_max?: number
          age_min?: number
          interested_in?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: Database['public']['Enums']['app_role']
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role: Database['public']['Enums']['app_role']
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: Database['public']['Enums']['app_role']
          user_id?: string
        }
        Relationships: []
      }
      venue_claims: {
        Row: {
          created_at: string
          evidence: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          evidence: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          evidence?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'venue_claims_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      venue_managers: {
        Row: {
          created_at: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'venue_managers_venue_id_fkey'
            columns: ['venue_id']
            isOneToOne: false
            referencedRelation: 'venues'
            referencedColumns: ['id']
          },
        ]
      }
      venues: {
        Row: {
          accessibility: Json
          address: string
          business_status: string
          catalog_owned: boolean
          city: string
          created_at: string
          description: string
          dress_code: string
          fixture_key: string | null
          google_expires_at: string | null
          google_fetched_at: string | null
          google_maps_uri: string
          google_place_id: string | null
          hours: string
          id: string
          is_test: boolean
          location: unknown
          location_source: string
          min_age: number | null
          music: string[]
          name: string
          notes: string
          opening_hours: Json
          osm_ref: string | null
          phone: string
          photos: Json
          price: number | null
          rating: number | null
          rating_count: number
          type: Database['public']['Enums']['venue_type']
          updated_at: string
          website: string
        }
        Insert: {
          accessibility?: Json
          address: string
          business_status?: string
          catalog_owned?: boolean
          city?: string
          created_at?: string
          description?: string
          dress_code?: string
          fixture_key?: string | null
          google_expires_at?: string | null
          google_fetched_at?: string | null
          google_maps_uri?: string
          google_place_id?: string | null
          hours?: string
          id?: string
          is_test?: boolean
          location?: unknown
          location_source?: string
          min_age?: number | null
          music?: string[]
          name: string
          notes?: string
          opening_hours?: Json
          osm_ref?: string | null
          phone?: string
          photos?: Json
          price?: number | null
          rating?: number | null
          rating_count?: number
          type: Database['public']['Enums']['venue_type']
          updated_at?: string
          website?: string
        }
        Update: {
          accessibility?: Json
          address?: string
          business_status?: string
          catalog_owned?: boolean
          city?: string
          created_at?: string
          description?: string
          dress_code?: string
          fixture_key?: string | null
          google_expires_at?: string | null
          google_fetched_at?: string | null
          google_maps_uri?: string
          google_place_id?: string | null
          hours?: string
          id?: string
          is_test?: boolean
          location?: unknown
          location_source?: string
          min_age?: number | null
          music?: string[]
          name?: string
          notes?: string
          opening_hours?: Json
          osm_ref?: string | null
          phone?: string
          photos?: Json
          price?: number | null
          rating?: number | null
          rating_count?: number
          type?: Database['public']['Enums']['venue_type']
          updated_at?: string
          website?: string
        }
        Relationships: []
      }
      verification_sessions: {
        Row: {
          active: boolean
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          level: string
          method: string
          mode: string
          provider: string
          provider_session_id: string | null
          reason: string | null
          state: string
          threshold: number
          user_id: string
        }
        Insert: {
          active?: boolean
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          level: string
          method: string
          mode: string
          provider: string
          provider_session_id?: string | null
          reason?: string | null
          state?: string
          threshold: number
          user_id: string
        }
        Update: {
          active?: boolean
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          level?: string
          method?: string
          mode?: string
          provider?: string
          provider_session_id?: string | null
          reason?: string | null
          state?: string
          threshold?: number
          user_id?: string
        }
        Relationships: []
      }
      verification_status: {
        Row: {
          age_mode: string | null
          age_threshold_used: number | null
          age_verification_method: string | null
          age_verified: boolean
          identity_mode: string | null
          identity_verified: boolean
          phone_verified: boolean
          photo_mode: string | null
          photo_verified: boolean
          provider_session_id: string | null
          reverification_required: boolean
          updated_at: string
          user_id: string
          verification_date: string | null
          verification_provider: string | null
        }
        Insert: {
          age_mode?: string | null
          age_threshold_used?: number | null
          age_verification_method?: string | null
          age_verified?: boolean
          identity_mode?: string | null
          identity_verified?: boolean
          phone_verified?: boolean
          photo_mode?: string | null
          photo_verified?: boolean
          provider_session_id?: string | null
          reverification_required?: boolean
          updated_at?: string
          user_id: string
          verification_date?: string | null
          verification_provider?: string | null
        }
        Update: {
          age_mode?: string | null
          age_threshold_used?: number | null
          age_verification_method?: string | null
          age_verified?: boolean
          identity_mode?: string | null
          identity_verified?: boolean
          phone_verified?: boolean
          photo_mode?: string | null
          photo_verified?: boolean
          provider_session_id?: string | null
          reverification_required?: boolean
          updated_at?: string
          user_id?: string
          verification_date?: string | null
          verification_provider?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      account_activity: { Args: never; Returns: undefined }
      admin_case_action: {
        Args: {
          p_action: string
          p_id: string
          p_note?: string
          p_section: string
        }
        Returns: undefined
      }
      admin_case_list: { Args: { p_section: string }; Returns: Json }
      admin_configure_provider: {
        Args: {
          p_capability: string
          p_daily: number
          p_enabled: boolean
          p_monthly: number
          p_observed_usage?: number
        }
        Returns: Json
      }
      admin_create_venue: { Args: { p: Json }; Returns: string }
      admin_dashboard: { Args: never; Returns: Json }
      admin_delete_venue: { Args: { p_venue: string }; Returns: undefined }
      admin_entitlement: {
        Args: { p_days?: number; p_key: string; p_user: string }
        Returns: undefined
      }
      admin_import_catalogue: { Args: { p_items: Json }; Returns: Json }
      admin_import_osm_venues: {
        Args: { p_city: string; p_items: Json }
        Returns: Json
      }
      admin_list_users: {
        Args: { p_limit?: number; p_query?: string }
        Returns: {
          created_at: string
          id: string
          is_test: boolean
          name: string
          phone_hint: string
          roles: string[]
        }[]
      }
      admin_list_venues: {
        Args: { p_city?: string; p_query?: string }
        Returns: Json
      }
      admin_moderate: {
        Args: {
          p_action: string
          p_id: string
          p_note: string
          p_section: string
        }
        Returns: undefined
      }
      admin_promo: {
        Args: { p_code: string; p_days: number; p_max: number }
        Returns: string
      }
      admin_provider_access: { Args: never; Returns: Json }
      admin_resolve_verification: {
        Args: { p_approve: boolean; p_note?: string; p_session: string }
        Returns: undefined
      }
      admin_set_flag: {
        Args: { p_key: string; p_value: string }
        Returns: undefined
      }
      admin_set_map_token: { Args: { p_token: string }; Returns: Json }
      admin_set_role: {
        Args: {
          p_granted: boolean
          p_role: Database['public']['Enums']['app_role']
          p_user: string
        }
        Returns: undefined
      }
      admin_set_setting: {
        Args: { p_key: string; p_value: number }
        Returns: undefined
      }
      admin_upsert_venue_from_google: { Args: { p: Json }; Returns: string }
      admin_verification_reviews: {
        Args: never
        Returns: {
          created_at: string
          id: string
          is_test: boolean
          level: string
          method: string
          mode: string
          provider: string
          reason: string
          user_name: string
        }[]
      }
      attach_verification_provider: {
        Args: { p_provider: string; p_session: string }
        Returns: undefined
      }
      begin_simulated_verification: {
        Args: { p_consent?: boolean; p_level: string; p_method?: string }
        Returns: Json
      }
      begin_verification: {
        Args: { p_consent?: boolean; p_level: string; p_method?: string }
        Returns: Json
      }
      billing_apply: { Args: { p: Json }; Returns: Json }
      billing_attach_session: {
        Args: { p_order: string; p_session: string }
        Returns: undefined
      }
      billing_customer: {
        Args: { p_customer?: string; p_mode: string; p_user: string }
        Returns: string
      }
      billing_price_notice: {
        Args: { p_mode: string; p_ref: string; p_subscription: string }
        Returns: undefined
      }
      billing_start_order: { Args: { p_code: string }; Returns: Json }
      billing_start_venue_order: {
        Args: { p_code: string; p_from?: string; p_venue: string }
        Returns: Json
      }
      cancel_going: { Args: never; Returns: Json }
      chat_messages: {
        Args: { p_before?: string; p_before_id?: string; p_match: string }
        Returns: Json
      }
      chat_read: { Args: { p_match: string }; Returns: undefined }
      chat_send: { Args: { p_match: string; p_text: string }; Returns: Json }
      chat_summaries: { Args: never; Returns: Json }
      chat_typing: {
        Args: { p_match: string; p_typing: boolean }
        Returns: undefined
      }
      check_in: {
        Args: {
          p_lat: number
          p_lng: number
          p_place_id: string
          p_visible?: boolean
        }
        Returns: Json
      }
      check_out: { Args: never; Returns: Json }
      check_signup: {
        Args: { p_device_id?: string; p_phone: string }
        Returns: string
      }
      claim_billing_work: { Args: { p_key: string }; Returns: Json }
      claim_signed_email: { Args: { p_user?: string }; Returns: Json }
      complete_onboarding: { Args: { p: Json }; Returns: undefined }
      complete_provider_verification: {
        Args: {
          p_event: string
          p_identity_ok: boolean
          p_method?: string
          p_occurred: string
          p_outcome: string
          p_over_threshold: boolean
          p_provider: string
          p_provider_session: string
          p_reference: string
          p_threshold?: number
        }
        Returns: boolean
      }
      confirm_event: { Args: { p_id: string }; Returns: Json }
      create_event: { Args: { p: Json }; Returns: Json }
      cron_places_tick: { Args: never; Returns: Json }
      defer_provider_erasure: {
        Args: { p_provider: string; p_session: string; p_status: number }
        Returns: undefined
      }
      export_my_data: { Args: never; Returns: Json }
      feature_enabled: { Args: { _key: string }; Returns: boolean }
      finish_billing_notice: {
        Args: { p_id: string; p_lease: string; p_status: string }
        Returns: undefined
      }
      finish_signed_email: {
        Args: { p_id: string; p_lease: string; p_status: string }
        Returns: undefined
      }
      get_event: { Args: { p_id: string }; Returns: Json }
      get_place_stats: { Args: { p_place_id: string }; Returns: Json }
      has_entitlement: { Args: { _key: string }; Returns: boolean }
      list_cities: { Args: never; Returns: string[] }
      list_events: { Args: { p_city?: string }; Returns: Json }
      lost_found_delete: { Args: { p_id: string }; Returns: undefined }
      lost_found_edit: { Args: { p_id: string; p_text: string }; Returns: Json }
      lost_found_list: { Args: { p_place_id: string }; Returns: Json }
      lost_found_post: {
        Args: { p_place_id: string; p_text: string }
        Returns: Json
      }
      lost_found_reply: {
        Args: { p_post_id: string; p_text: string }
        Returns: Json
      }
      managed_venues: { Args: never; Returns: Json }
      matching_block: { Args: { p_person: string }; Returns: undefined }
      matching_candidates: { Args: { p_place?: string }; Returns: Json }
      matching_like: { Args: { p_person: string }; Returns: Json }
      matching_likes_you: { Args: never; Returns: Json }
      matching_matches: { Args: never; Returns: Json }
      matching_pass: { Args: { p_person: string }; Returns: undefined }
      matching_person: { Args: { p_person: string }; Returns: Json }
      matching_report: {
        Args: { p_comment: string; p_person: string; p_reason: string }
        Returns: undefined
      }
      matching_sponsored_cards: { Args: { p_place?: string }; Returns: Json }
      matching_status: { Args: never; Returns: Json }
      matching_undo: { Args: never; Returns: Json }
      matching_unmatch: { Args: { p_match: string }; Returns: undefined }
      moderation_appeal: {
        Args: { p_decision: string; p_text: string }
        Returns: Json
      }
      moderation_decisions: { Args: never; Returns: Json }
      moderation_reports: { Args: never; Returns: Json }
      my_attendance: { Args: never; Returns: Json }
      my_entitlements: { Args: never; Returns: Json }
      my_vibe: { Args: { p_place_id: string }; Returns: string }
      premium_incognito: { Args: { p_on: boolean }; Returns: Json }
      premium_notify: { Args: { p_on: boolean }; Returns: Json }
      premium_paid_dm: {
        Args: { p_person: string; p_text: string }
        Returns: Json
      }
      premium_redeem: { Args: { p_code: string }; Returns: Json }
      premium_social_state: { Args: never; Returns: Json }
      premium_spark: { Args: { p_person: string }; Returns: Json }
      premium_sparks_seen: { Args: never; Returns: Json }
      premium_spotlight: { Args: { p_place?: string }; Returns: Json }
      premium_state: { Args: never; Returns: Json }
      prepare_erasure: { Args: { p_user: string }; Returns: undefined }
      provider_erasure_result: {
        Args: { p_id: string; p_status: number }
        Returns: undefined
      }
      provider_reserve: {
        Args: { p_capability: string; p_mode: string; p_n?: number }
        Returns: boolean
      }
      purge_test_data: { Args: never; Returns: number }
      record_verification_cleanup: {
        Args: { p_http_status: number; p_session: string }
        Returns: undefined
      }
      report_event: {
        Args: { p_id: string; p_reason: string }
        Returns: undefined
      }
      request_data_right: { Args: { p_kind: string }; Returns: string }
      request_verification_review: { Args: { p_level: string }; Returns: Json }
      reserve_document_email: { Args: { p_user: string }; Returns: boolean }
      reserve_map_load: { Args: never; Returns: Json }
      save_consents: {
        Args: { p_choices: Json; p_city?: string }
        Returns: undefined
      }
      save_emergency_contacts: { Args: { p: Json }; Returns: Json }
      search_places: {
        Args: {
          p_city?: string
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_max_age?: number
          p_max_people?: number
          p_min_age?: number
          p_min_green?: number
          p_min_people?: number
          p_open_now?: boolean
          p_query?: string
          p_sort?: string
          p_types?: string[]
        }
        Returns: Json
      }
      search_public_profiles: {
        Args: { p_limit?: number }
        Returns: {
          age: number
          bio: string
          gender: Database['public']['Enums']['gender']
          id: string
          is_test: boolean
          name: string
          traffic_light: Database['public']['Enums']['traffic_light']
        }[]
      }
      set_anthem: { Args: { p_anthem: Json }; Returns: undefined }
      set_going: { Args: { p_place_id: string }; Returns: Json }
      sign_documents: { Args: { p_slugs: string[] }; Returns: undefined }
      sim_advance_expiry: { Args: never; Returns: Json }
      sim_fill_venue: {
        Args: { p_count?: number; p_venue: string }
        Returns: Json
      }
      sim_import_events: {
        Args: { p_city?: string; p_count?: number }
        Returns: Json
      }
      sim_seed_places: { Args: never; Returns: Json }
      sim_social: { Args: { p_action: string }; Returns: Json }
      simulate_billing: {
        Args: { p_action?: string; p_code: string }
        Returns: Json
      }
      simulate_verification_result: {
        Args: { p_level: string; p_outcome: string }
        Returns: Json
      }
      submit_illegal_content_notice: { Args: { p: Json }; Returns: string }
      update_my_profile: { Args: { p: Json }; Returns: undefined }
      update_venue_details: {
        Args: { p: Json; p_venue: string }
        Returns: undefined
      }
      venue_billing_state: { Args: { p_venue: string }; Returns: Json }
      venue_claim: {
        Args: { p_evidence: string; p_venue: string }
        Returns: Json
      }
      venue_edit: { Args: { p: Json; p_venue: string }; Returns: Json }
      venue_flash_alert: { Args: { p: Json; p_venue: string }; Returns: string }
      venue_official_event: {
        Args: { p: Json; p_venue: string }
        Returns: string
      }
      venue_sponsorship: {
        Args: { p_from: string; p_tier: string; p_to: string; p_venue: string }
        Returns: Json
      }
      venue_stats: { Args: { p_venue: string }; Returns: Json }
      verification_snapshot: { Args: never; Returns: Json }
      visible_flash_alerts: { Args: { p_venue: string }; Returns: Json }
      visible_sponsors: { Args: never; Returns: Json }
      visible_sponsorships: { Args: never; Returns: Json }
      vote_vibe: { Args: { p_place_id: string; p_vibe: string }; Returns: Json }
      who_is_there: { Args: { p_place_id: string }; Returns: Json }
    }
    Enums: {
      app_role: 'user' | 'tester' | 'venue_manager' | 'admin'
      event_status:
        'unconfirmed' | 'confirmed' | 'official' | 'removed' | 'under_review' | 'archived'
      gender: 'woman' | 'man' | 'non_binary' | 'other'
      traffic_light: 'green' | 'yellow' | 'red'
      venue_type:
        'nightclub' | 'club' | 'pub' | 'bar' | 'dive_bar' | 'lounge' | 'terrace' | 'beach_club'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ['user', 'tester', 'venue_manager', 'admin'],
      event_status: ['unconfirmed', 'confirmed', 'official', 'removed', 'under_review', 'archived'],
      gender: ['woman', 'man', 'non_binary', 'other'],
      traffic_light: ['green', 'yellow', 'red'],
      venue_type: [
        'nightclub',
        'club',
        'pub',
        'bar',
        'dive_bar',
        'lounge',
        'terrace',
        'beach_club',
      ],
    },
  },
} as const
