// Generated shape of the Supabase schema (public). Regenerate after every migration.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.18' }
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
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: string
          id?: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: string
          id?: number
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
          key?: string
          kind?: string
          max_value?: number | null
          min_value?: number | null
          updated_at?: string
          updated_by?: string | null
          value?: string
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
          granted?: boolean
          id?: string
          kind?: string
          method?: string
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
          template?: string
          user_id?: string
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
        Row: { created_at: string; id: string; name: string; phone: string; user_id: string }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          user_id?: string
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
          key?: string
          source?: string
          starts_at?: string
          status?: string
          user_id?: string
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
      user_preferences: {
        Row: {
          age_max: number
          age_min: number
          interested_in: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          age_max?: number
          age_min?: number
          interested_in?: string[]
          updated_at?: string
          user_id?: string
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
          role?: Database['public']['Enums']['app_role']
          user_id?: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: Database['public']['Enums']['app_role']
          user_id?: string
        }
        Relationships: []
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
          amount_cents?: number
          id?: string
          issued_at?: string
          plan_code?: string
          provider?: string
          provider_invoice_id?: string | null
          status?: string
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
          kind?: string
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
      verification_status: {
        Row: {
          age_threshold_used: number | null
          age_verification_method: string | null
          age_verified: boolean
          identity_verified: boolean
          phone_verified: boolean
          photo_verified: boolean
          provider_session_id: string | null
          reverification_required: boolean
          updated_at: string
          user_id: string
          verification_date: string | null
          verification_provider: string | null
        }
        Insert: {
          age_threshold_used?: number | null
          age_verification_method?: string | null
          age_verified?: boolean
          identity_verified?: boolean
          phone_verified?: boolean
          photo_verified?: boolean
          provider_session_id?: string | null
          reverification_required?: boolean
          updated_at?: string
          user_id?: string
          verification_date?: string | null
          verification_provider?: string | null
        }
        Update: {
          age_threshold_used?: number | null
          age_verification_method?: string | null
          age_verified?: boolean
          identity_verified?: boolean
          phone_verified?: boolean
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
    Views: { [_ in never]: never }
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
      admin_set_flag: { Args: { p_key: string; p_value: string }; Returns: undefined }
      admin_set_role: {
        Args: {
          p_granted: boolean
          p_role: Database['public']['Enums']['app_role']
          p_user: string
        }
        Returns: undefined
      }
      admin_set_setting: { Args: { p_key: string; p_value: number }; Returns: undefined }
      check_signup: { Args: { p_device_id?: string; p_phone: string }; Returns: string }
      complete_onboarding: { Args: { p: Json }; Returns: undefined }
      feature_enabled: { Args: { _key: string }; Returns: boolean }
      has_entitlement: { Args: { _key: string }; Returns: boolean }
      purge_test_data: { Args: never; Returns: number }
      save_consents: { Args: { p_choices: Json; p_city?: string }; Returns: undefined }
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
      update_my_profile: { Args: { p: Json }; Returns: undefined }
    }
    Enums: {
      app_role: 'user' | 'tester' | 'venue_manager' | 'admin'
      event_status: 'unconfirmed' | 'confirmed' | 'official' | 'removed'
      gender: 'woman' | 'man' | 'non_binary' | 'other'
      traffic_light: 'green' | 'yellow' | 'red'
      venue_type:
        'nightclub' | 'club' | 'pub' | 'bar' | 'dive_bar' | 'lounge' | 'terrace' | 'beach_club'
    }
    CompositeTypes: { [_ in never]: never }
  }
}
