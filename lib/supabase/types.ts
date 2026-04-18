export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      call_attempts: {
        Row: {
          company_id: string
          id: string
          ts: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          company_id: string
          id?: string
          ts?: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          company_id?: string
          id?: string
          ts?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_attempts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          calendar_event_id: string | null
          callback_datetime: string | null
          company_id: string
          created_at: string
          id: string
          notes: string | null
          outcome: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          calendar_event_id?: string | null
          callback_datetime?: string | null
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          outcome: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          calendar_event_id?: string | null
          callback_datetime?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          outcome?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_members: {
        Row: {
          added_at: string
          campaign_id: string
          company_id: string
        }
        Insert: {
          added_at?: string
          campaign_id: string
          company_id: string
        }
        Update: {
          added_at?: string
          campaign_id?: string
          company_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          campaign_date: string
          created_at: string
          created_by_user_email: string | null
          created_by_user_id: string | null
          created_by_user_name: string | null
          id: string
          method: string
          name: string
          notes: string | null
        }
        Insert: {
          campaign_date: string
          created_at?: string
          created_by_user_email?: string | null
          created_by_user_id?: string | null
          created_by_user_name?: string | null
          id?: string
          method: string
          name: string
          notes?: string | null
        }
        Update: {
          campaign_date?: string
          created_at?: string
          created_by_user_email?: string | null
          created_by_user_id?: string | null
          created_by_user_name?: string | null
          id?: string
          method?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          area: string | null
          business_status: string | null
          calendar_event_id: string | null
          callback_at: string | null
          category: string | null
          city: string | null
          contact_address: string | null
          contact_method: string | null
          contact_name: string | null
          contact_notes: string | null
          country_code: string | null
          created_at: string
          domain: string | null
          email: string | null
          employee_count: string | null
          facebook: string | null
          founded_year: number | null
          geocoded_at: string | null
          id: string
          industry: string | null
          instagram: string | null
          is_chain: boolean | null
          last_called_at: string | null
          latitude: number | null
          linkedin: string | null
          location_link: string | null
          longitude: number | null
          name: string
          neighborhood: string | null
          not_interested_reason: string | null
          outcomes: string[]
          outscraper_place_id: string | null
          outscraper_task_id: string | null
          pain_points: string[]
          phone: string | null
          phone_carrier_type: string | null
          postal_code: string | null
          rating: number | null
          revenue: string | null
          reviews: number | null
          status: string
          street: string | null
          subtypes: string[] | null
          updated_at: string
          user_goals: string[]
          verified: boolean | null
          website: string | null
          working_hours: Json | null
          x_twitter: string | null
          youtube: string | null
        }
        Insert: {
          address?: string | null
          area?: string | null
          business_status?: string | null
          calendar_event_id?: string | null
          callback_at?: string | null
          category?: string | null
          city?: string | null
          contact_address?: string | null
          contact_method?: string | null
          contact_name?: string | null
          contact_notes?: string | null
          country_code?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          employee_count?: string | null
          facebook?: string | null
          founded_year?: number | null
          geocoded_at?: string | null
          id?: string
          industry?: string | null
          instagram?: string | null
          is_chain?: boolean | null
          last_called_at?: string | null
          latitude?: number | null
          linkedin?: string | null
          location_link?: string | null
          longitude?: number | null
          name: string
          neighborhood?: string | null
          not_interested_reason?: string | null
          outcomes?: string[]
          outscraper_place_id?: string | null
          outscraper_task_id?: string | null
          pain_points?: string[]
          phone?: string | null
          phone_carrier_type?: string | null
          postal_code?: string | null
          rating?: number | null
          revenue?: string | null
          reviews?: number | null
          status?: string
          street?: string | null
          subtypes?: string[] | null
          updated_at?: string
          user_goals?: string[]
          verified?: boolean | null
          website?: string | null
          working_hours?: Json | null
          x_twitter?: string | null
          youtube?: string | null
        }
        Update: {
          address?: string | null
          area?: string | null
          business_status?: string | null
          calendar_event_id?: string | null
          callback_at?: string | null
          category?: string | null
          city?: string | null
          contact_address?: string | null
          contact_method?: string | null
          contact_name?: string | null
          contact_notes?: string | null
          country_code?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          employee_count?: string | null
          facebook?: string | null
          founded_year?: number | null
          geocoded_at?: string | null
          id?: string
          industry?: string | null
          instagram?: string | null
          is_chain?: boolean | null
          last_called_at?: string | null
          latitude?: number | null
          linkedin?: string | null
          location_link?: string | null
          longitude?: number | null
          name?: string
          neighborhood?: string | null
          not_interested_reason?: string | null
          outcomes?: string[]
          outscraper_place_id?: string | null
          outscraper_task_id?: string | null
          pain_points?: string[]
          phone?: string | null
          phone_carrier_type?: string | null
          postal_code?: string | null
          rating?: number | null
          revenue?: string | null
          reviews?: number | null
          status?: string
          street?: string | null
          subtypes?: string[] | null
          updated_at?: string
          user_goals?: string[]
          verified?: boolean | null
          website?: string | null
          working_hours?: Json | null
          x_twitter?: string | null
          youtube?: string | null
        }
        Relationships: []
      }
      company_notes: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          churned_at: string | null
          company_id: string
          created_at: string
          discovery_calendar_event_id: string | null
          discovery_meeting_at: string | null
          discovery_meeting_contact: string | null
          follow_up_date: string | null
          id: string
          pilot_end_date: string | null
          pilot_start_date: string | null
          sample_website: string | null
          sent_date: string | null
          status: string
          updated_at: string
          won_at: string | null
        }
        Insert: {
          churned_at?: string | null
          company_id: string
          created_at?: string
          discovery_calendar_event_id?: string | null
          discovery_meeting_at?: string | null
          discovery_meeting_contact?: string | null
          follow_up_date?: string | null
          id?: string
          pilot_end_date?: string | null
          pilot_start_date?: string | null
          sample_website?: string | null
          sent_date?: string | null
          status?: string
          updated_at?: string
          won_at?: string | null
        }
        Update: {
          churned_at?: string | null
          company_id?: string
          created_at?: string
          discovery_calendar_event_id?: string | null
          discovery_meeting_at?: string | null
          discovery_meeting_contact?: string | null
          follow_up_date?: string | null
          id?: string
          pilot_end_date?: string | null
          pilot_start_date?: string | null
          sample_website?: string | null
          sent_date?: string | null
          status?: string
          updated_at?: string
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      outscraper_sync_log: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          records_imported: number | null
          records_skipped: number | null
          records_total: number | null
          started_at: string
          status: string
          task_id: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          records_imported?: number | null
          records_skipped?: number | null
          records_total?: number | null
          started_at?: string
          status?: string
          task_id: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          records_imported?: number | null
          records_skipped?: number | null
          records_total?: number | null
          started_at?: string
          status?: string
          task_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
