// Generated from the deployed Supabase schema (MCP generate_typescript_types).
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
          id: string
          reason: string
          until: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          reason: string
          until?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string
          until?: string | null
          user_id?: string | null
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
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          id?: never
          kind: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          id?: never
          kind?: string
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
          id: string
          kind: string
          status: string
          user_id: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          due_at?: string
          id?: string
          kind: string
          status?: string
          user_id?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          due_at?: string
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
          id: string
          is_test: boolean
          location: unknown
          origin: string
          place_name: string
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
          id?: string
          is_test?: boolean
          location: unknown
          origin: string
          place_name: string
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
          id?: string
          is_test?: boolean
          location?: unknown
          origin?: string
          place_name?: string
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
      invoices: {
        Row: {
          amount_cents: number
          id: string
          issued_at: string
          plan_code: string
          provider: string
          provider_invoice_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          id?: string
          issued_at?: string
          plan_code: string
          provider: string
          provider_invoice_id?: string | null
          status: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          id?: string
          issued_at?: string
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
          created_at: string
          id: string
          user_a: string
          user_b: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          user_a: string
          user_b: string
          venue_id?: string | null
        }
        Update: {
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
          processed_at: string
          provider: string
          provider_event_id: string
          type: string
          user_id: string | null
        }
        Insert: {
          id?: string
          processed_at?: string
          provider: string
          provider_event_id: string
          type: string
          user_id?: string | null
        }
        Update: {
          id?: string
          processed_at?: string
          provider?: string
          provider_event_id?: string
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
      ratings: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          user_id: string
          venue_id: string | null
          vibe: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          user_id: string
          venue_id?: string | null
          vibe: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
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
          requested_by?: string | null
          starts_on?: string
          status?: string
          tier?: string
          venue_id?: string
        }
        Relationships: [
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
          plan_code: string
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
          withdrawal_requested_at: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          current_period_end: string
          id?: string
          plan_code: string
          provider: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          started_at?: string
          status: string
          updated_at?: string
          user_id: string
          withdrawal_requested_at?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          current_period_end?: string
          id?: string
          plan_code?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
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
        ]
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
          address: string
          created_at: string
          description: string
          google_place_id: string | null
          hours: string
          id: string
          is_test: boolean
          location: unknown
          name: string
          price: number
          type: Database['public']['Enums']['venue_type']
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          description?: string
          google_place_id?: string | null
          hours?: string
          id?: string
          is_test?: boolean
          location: unknown
          name: string
          price?: number
          type: Database['public']['Enums']['venue_type']
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          description?: string
          google_place_id?: string | null
          hours?: string
          id?: string
          is_test?: boolean
          location?: unknown
          name?: string
          price?: number
          type?: Database['public']['Enums']['venue_type']
          updated_at?: string
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
      admin_dashboard: { Args: never; Returns: Json }
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
      admin_resolve_verification: {
        Args: { p_approve: boolean; p_note?: string; p_session: string }
        Returns: undefined
      }
      admin_set_flag: {
        Args: { p_key: string; p_value: string }
        Returns: undefined
      }
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
      check_signup: {
        Args: { p_device_id?: string; p_phone: string }
        Returns: string
      }
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
      feature_enabled: { Args: { _key: string }; Returns: boolean }
      has_entitlement: { Args: { _key: string }; Returns: boolean }
      purge_test_data: { Args: never; Returns: number }
      request_verification_review: { Args: { p_level: string }; Returns: Json }
      save_consents: {
        Args: { p_choices: Json; p_city?: string }
        Returns: undefined
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
      sign_documents: { Args: { p_slugs: string[] }; Returns: undefined }
      simulate_verification_result: {
        Args: { p_level: string; p_outcome: string }
        Returns: Json
      }
      update_my_profile: { Args: { p: Json }; Returns: undefined }
      verification_snapshot: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: 'user' | 'tester' | 'venue_manager' | 'admin'
      event_status: 'unconfirmed' | 'confirmed' | 'official' | 'removed'
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
      event_status: ['unconfirmed', 'confirmed', 'official', 'removed'],
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
