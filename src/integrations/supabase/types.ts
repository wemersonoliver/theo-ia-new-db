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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appointment_slots: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          max_appointments_per_slot: number | null
          slot_duration_minutes: number | null
          start_time: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          max_appointments_per_slot?: number | null
          slot_duration_minutes?: number | null
          start_time: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          max_appointments_per_slot?: number | null
          slot_duration_minutes?: number | null
          start_time?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          confirmed_by_client: boolean | null
          contact_name: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          notes: string | null
          phone: string
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          confirmed_by_client?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          phone: string
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          confirmed_by_client?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          phone?: string
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          notes: string | null
          phone: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          phone?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entrevistas_config: {
        Row: {
          company_name: string
          created_at: string
          generated_prompt: string | null
          id: string
          messages: Json
          segment: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name: string
          created_at?: string
          generated_prompt?: string | null
          id?: string
          messages?: Json
          segment: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string
          created_at?: string
          generated_prompt?: string | null
          id?: string
          messages?: Json
          segment?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_base_documents: {
        Row: {
          content_text: string | null
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          status: string | null
          user_id: string
        }
        Insert: {
          content_text?: string | null
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          status?: string | null
          user_id: string
        }
        Update: {
          content_text?: string | null
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notification_contacts: {
        Row: {
          created_at: string
          id: string
          name: string | null
          notify_appointments: boolean | null
          notify_handoffs: boolean | null
          phone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          notify_appointments?: boolean | null
          notify_handoffs?: boolean | null
          phone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          notify_appointments?: boolean | null
          notify_handoffs?: boolean | null
          phone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string | null
          evolution_api_key: string | null
          evolution_api_url: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_blocked: boolean | null
          phone: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean | null
          phone?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean | null
          phone?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_ai_config: {
        Row: {
          active: boolean | null
          agent_name: string | null
          business_days: number[] | null
          business_hours_end: string | null
          business_hours_start: string | null
          created_at: string | null
          custom_prompt: string | null
          delay_between_messages: number | null
          handoff_message: string | null
          id: string
          initial_message_1: string | null
          initial_message_2: string | null
          initial_message_3: string | null
          keyword_activation_enabled: boolean | null
          max_messages_without_human: number | null
          out_of_hours_message: string | null
          pre_service_active: boolean | null
          reminder_enabled: boolean | null
          reminder_hours_before: number | null
          reminder_message_template: string | null
          response_delay_seconds: number | null
          trigger_keywords: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          agent_name?: string | null
          business_days?: number[] | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          created_at?: string | null
          custom_prompt?: string | null
          delay_between_messages?: number | null
          handoff_message?: string | null
          id?: string
          initial_message_1?: string | null
          initial_message_2?: string | null
          initial_message_3?: string | null
          keyword_activation_enabled?: boolean | null
          max_messages_without_human?: number | null
          out_of_hours_message?: string | null
          pre_service_active?: boolean | null
          reminder_enabled?: boolean | null
          reminder_hours_before?: number | null
          reminder_message_template?: string | null
          response_delay_seconds?: number | null
          trigger_keywords?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          agent_name?: string | null
          business_days?: number[] | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          created_at?: string | null
          custom_prompt?: string | null
          delay_between_messages?: number | null
          handoff_message?: string | null
          id?: string
          initial_message_1?: string | null
          initial_message_2?: string | null
          initial_message_3?: string | null
          keyword_activation_enabled?: boolean | null
          max_messages_without_human?: number | null
          out_of_hours_message?: string | null
          pre_service_active?: boolean | null
          reminder_enabled?: boolean | null
          reminder_hours_before?: number | null
          reminder_message_template?: string | null
          response_delay_seconds?: number | null
          trigger_keywords?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_ai_sessions: {
        Row: {
          created_at: string | null
          handed_off_at: string | null
          id: string
          last_human_message_at: string | null
          messages: Json | null
          messages_without_human: number | null
          phone: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          handed_off_at?: string | null
          id?: string
          last_human_message_at?: string | null
          messages?: Json | null
          messages_without_human?: number | null
          phone: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          handed_off_at?: string | null
          id?: string
          last_human_message_at?: string | null
          messages?: Json | null
          messages_without_human?: number | null
          phone?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          ai_active: boolean | null
          contact_name: string | null
          created_at: string | null
          id: string
          last_message_at: string | null
          messages: Json | null
          phone: string
          total_messages: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          messages?: Json | null
          phone: string
          total_messages?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_active?: boolean | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          messages?: Json | null
          phone?: string
          total_messages?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          created_at: string | null
          id: string
          instance_name: string
          last_sync_at: string | null
          phone_number: string | null
          profile_name: string | null
          qr_code_base64: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          instance_name: string
          last_sync_at?: string | null
          phone_number?: string | null
          profile_name?: string | null
          qr_code_base64?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_name?: string
          last_sync_at?: string | null
          phone_number?: string | null
          profile_name?: string | null
          qr_code_base64?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_pending_responses: {
        Row: {
          created_at: string | null
          id: string
          phone: string
          processed: boolean | null
          scheduled_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          phone: string
          processed?: boolean | null
          scheduled_at: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          phone?: string
          processed?: boolean | null
          scheduled_at?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user"
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
    Enums: {
      app_role: ["super_admin", "admin", "user"],
    },
  },
} as const
