export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
      companies: {
        Row: {
          address: string | null
          business_status: string | null
          category: string | null
          city: string | null
          country_code: string | null
          created_at: string
          domain: string | null
          email: string | null
          employee_count: string | null
          facebook: string | null
          founded_year: number | null
          id: string
          industry: string | null
          instagram: string | null
          is_chain: boolean | null
          last_called_at: string | null
          linkedin: string | null
          location_link: string | null
          name: string
          outscraper_place_id: string | null
          outscraper_task_id: string | null
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
          verified: boolean | null
          website: string | null
          working_hours: Json | null
          x_twitter: string | null
          youtube: string | null
        }
        Insert: {
          address?: string | null
          business_status?: string | null
          category?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          employee_count?: string | null
          facebook?: string | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          instagram?: string | null
          is_chain?: boolean | null
          last_called_at?: string | null
          linkedin?: string | null
          location_link?: string | null
          name: string
          outscraper_place_id?: string | null
          outscraper_task_id?: string | null
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
          verified?: boolean | null
          website?: string | null
          working_hours?: Json | null
          x_twitter?: string | null
          youtube?: string | null
        }
        Update: {
          address?: string | null
          business_status?: string | null
          category?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          employee_count?: string | null
          facebook?: string | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          instagram?: string | null
          is_chain?: boolean | null
          last_called_at?: string | null
          linkedin?: string | null
          location_link?: string | null
          name?: string
          outscraper_place_id?: string | null
          outscraper_task_id?: string | null
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
          user_id: string
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
