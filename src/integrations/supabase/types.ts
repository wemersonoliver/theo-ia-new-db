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
      admin_notification_contacts: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      appointment_types: {
        Row: {
          created_at: string | null
          days_of_week: number[]
          description: string | null
          duration_minutes: number
          end_time: string
          id: string
          is_active: boolean
          max_appointments_per_slot: number
          name: string
          start_time: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          days_of_week?: number[]
          description?: string | null
          duration_minutes?: number
          end_time?: string
          id?: string
          is_active?: boolean
          max_appointments_per_slot?: number
          name: string
          start_time?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          days_of_week?: number[]
          description?: string | null
          duration_minutes?: number
          end_time?: string
          id?: string
          is_active?: boolean
          max_appointments_per_slot?: number
          name?: string
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
          appointment_type_id: string | null
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
          appointment_type_id?: string | null
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
          appointment_type_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "appointments_appointment_type_id_fkey"
            columns: ["appointment_type_id"]
            isOneToOne: false
            referencedRelation: "appointment_types"
            referencedColumns: ["id"]
          },
        ]
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
      crm_activities: {
        Row: {
          content: string
          created_at: string
          deal_id: string
          id: string
          metadata: Json | null
          type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deal_id: string
          id?: string
          metadata?: Json | null
          type?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deal_id?: string
          id?: string
          metadata?: Json | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_products: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          product_id: string
          quantity: number
          unit_price_cents: number
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          product_id: string
          quantity?: number
          unit_price_cents?: number
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          product_id?: string
          quantity?: number
          unit_price_cents?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_products_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          contact_id: string | null
          created_at: string
          description: string | null
          expected_close_date: string | null
          id: string
          lost_at: string | null
          lost_reason: string | null
          position: number
          priority: string
          stage_id: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
          value_cents: number | null
          won_at: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          position?: number
          priority?: string
          stage_id: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
          value_cents?: number | null
          won_at?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          position?: number
          priority?: string
          stage_id?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
          value_cents?: number | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          pipeline_id: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          pipeline_id: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
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
      followup_config: {
        Row: {
          bargaining_tools: string | null
          created_at: string | null
          enabled: boolean
          evening_window_end: string
          evening_window_start: string
          exclude_handoff: boolean
          id: string
          inactivity_hours: number
          max_days: number
          morning_window_end: string
          morning_window_start: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bargaining_tools?: string | null
          created_at?: string | null
          enabled?: boolean
          evening_window_end?: string
          evening_window_start?: string
          exclude_handoff?: boolean
          id?: string
          inactivity_hours?: number
          max_days?: number
          morning_window_end?: string
          morning_window_start?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bargaining_tools?: string | null
          created_at?: string | null
          enabled?: boolean
          evening_window_end?: string
          evening_window_start?: string
          exclude_handoff?: boolean
          id?: string
          inactivity_hours?: number
          max_days?: number
          morning_window_end?: string
          morning_window_start?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      followup_tracking: {
        Row: {
          context_summary: string | null
          created_at: string | null
          current_step: number
          engagement_data: Json | null
          id: string
          last_sent_at: string | null
          next_scheduled_at: string | null
          phone: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          context_summary?: string | null
          created_at?: string | null
          current_step?: number
          engagement_data?: Json | null
          id?: string
          last_sent_at?: string | null
          next_scheduled_at?: string | null
          phone: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          context_summary?: string | null
          created_at?: string | null
          current_step?: number
          engagement_data?: Json | null
          id?: string
          last_sent_at?: string | null
          next_scheduled_at?: string | null
          phone?: string
          status?: string
          updated_at?: string | null
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
      onboarding_tutorial_videos: {
        Row: {
          created_at: string
          id: string
          step_key: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          step_key: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          step_key?: string
          updated_at?: string
          video_url?: string | null
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
      products: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          price_cents: number
          quantity: number
          sku: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price_cents?: number
          quantity?: number
          sku?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price_cents?: number
          quantity?: number
          sku?: string | null
          updated_at?: string
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
          onboarding_completed: boolean
          phone: string | null
          updated_at: string | null
          user_code: number
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean | null
          onboarding_completed?: boolean
          phone?: string | null
          updated_at?: string | null
          user_code?: number
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_blocked?: boolean | null
          onboarding_completed?: boolean
          phone?: string | null
          updated_at?: string | null
          user_code?: number
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount_cents: number | null
          cancelled_at: string | null
          created_at: string | null
          currency: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          expires_at: string | null
          id: string
          kiwify_order_id: string | null
          kiwify_product_id: string | null
          plan_type: string | null
          product_name: string | null
          raw_data: Json | null
          refunded_at: string | null
          started_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          expires_at?: string | null
          id?: string
          kiwify_order_id?: string | null
          kiwify_product_id?: string | null
          plan_type?: string | null
          product_name?: string | null
          raw_data?: Json | null
          refunded_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          expires_at?: string | null
          id?: string
          kiwify_order_id?: string | null
          kiwify_product_id?: string | null
          plan_type?: string | null
          product_name?: string | null
          raw_data?: Json | null
          refunded_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_ticket_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          sender_id: string
          sender_type: string
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          sender_id: string
          sender_type?: string
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          sender_id?: string
          sender_type?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_notes: string | null
          closed_at: string | null
          created_at: string | null
          description: string
          id: string
          priority: string
          status: string
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          closed_at?: string | null
          created_at?: string | null
          description: string
          id?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          closed_at?: string | null
          created_at?: string | null
          description?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      system_ai_config: {
        Row: {
          active: boolean | null
          agent_name: string | null
          created_at: string | null
          custom_prompt: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          agent_name?: string | null
          created_at?: string | null
          custom_prompt?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          agent_name?: string | null
          created_at?: string | null
          custom_prompt?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_whatsapp_conversations: {
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
        }
        Relationships: []
      }
      system_whatsapp_instance: {
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
          business_address: string | null
          business_days: number[] | null
          business_hours_end: string | null
          business_hours_start: string | null
          business_latitude: number | null
          business_location_name: string | null
          business_longitude: number | null
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
          business_address?: string | null
          business_days?: number[] | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          business_latitude?: number | null
          business_location_name?: string | null
          business_longitude?: number | null
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
          business_address?: string | null
          business_days?: number[] | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          business_latitude?: number | null
          business_location_name?: string | null
          business_longitude?: number | null
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
          pairing_code: string | null
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
          pairing_code?: string | null
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
          pairing_code?: string | null
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
