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
      account_members: {
        Row: {
          account_id: string
          created_at: string
          id: string
          invited_at: string
          invited_by: string | null
          last_seen_at: string | null
          must_change_password: boolean
          permissions: Json
          role: Database["public"]["Enums"]["account_role"]
          status: Database["public"]["Enums"]["account_member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          last_seen_at?: string | null
          must_change_password?: boolean
          permissions?: Json
          role?: Database["public"]["Enums"]["account_role"]
          status?: Database["public"]["Enums"]["account_member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          last_seen_at?: string | null
          must_change_password?: boolean
          permissions?: Json
          role?: Database["public"]["Enums"]["account_role"]
          status?: Database["public"]["Enums"]["account_member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_members_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          business_code: number
          created_at: string
          id: string
          is_igreen: boolean
          name: string
          owner_user_id: string
          pro_trial_activated: boolean
          pro_trial_activated_at: string | null
          trial_extra_days: number
          updated_at: string
        }
        Insert: {
          business_code?: number
          created_at?: string
          id?: string
          is_igreen?: boolean
          name?: string
          owner_user_id: string
          pro_trial_activated?: boolean
          pro_trial_activated_at?: string | null
          trial_extra_days?: number
          updated_at?: string
        }
        Update: {
          business_code?: number
          created_at?: string
          id?: string
          is_igreen?: boolean
          name?: string
          owner_user_id?: string
          pro_trial_activated?: boolean
          pro_trial_activated_at?: string | null
          trial_extra_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      admin_crm_activities: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          deal_id: string
          id: string
          metadata: Json
          type: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          deal_id: string
          id?: string
          metadata?: Json
          type?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string
          id?: string
          metadata?: Json
          type?: string
        }
        Relationships: []
      }
      admin_crm_deal_tasks: {
        Row: {
          assigned_to: string | null
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          deal_id: string
          description: string | null
          due_date: string | null
          id: string
          reminder_sent: boolean
          reminder_sent_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          deal_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_crm_deals: {
        Row: {
          business_data_updated_at: string | null
          business_name: string | null
          business_segment: string | null
          business_summary: string | null
          created_at: string
          description: string | null
          expected_close_date: string | null
          id: string
          lost_at: string | null
          lost_reason: string | null
          onboarding_completed: boolean
          position: number
          priority: string
          stage_id: string
          subscription_plan: string | null
          subscription_status: string | null
          tags: string[]
          title: string
          updated_at: string
          user_ref_id: string | null
          value_cents: number | null
          won_at: string | null
        }
        Insert: {
          business_data_updated_at?: string | null
          business_name?: string | null
          business_segment?: string | null
          business_summary?: string | null
          created_at?: string
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          onboarding_completed?: boolean
          position?: number
          priority?: string
          stage_id: string
          subscription_plan?: string | null
          subscription_status?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          user_ref_id?: string | null
          value_cents?: number | null
          won_at?: string | null
        }
        Update: {
          business_data_updated_at?: string | null
          business_name?: string | null
          business_segment?: string | null
          business_summary?: string | null
          created_at?: string
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          onboarding_completed?: boolean
          position?: number
          priority?: string
          stage_id?: string
          subscription_plan?: string | null
          subscription_status?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_ref_id?: string | null
          value_cents?: number | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "admin_crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_crm_pipelines: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_crm_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          pipeline_id: string
          position: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          pipeline_id: string
          position?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          pipeline_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_crm_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "admin_crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
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
      ai_credit_transactions: {
        Row: {
          amount_cents: number
          balance_after_cents: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          balance_after_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          balance_after_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_credits: {
        Row: {
          balance_cents: number
          created_at: string
          id: string
          total_added_cents: number
          total_consumed_cents: number
          updated_at: string
          user_id: string
          voice_enabled: boolean
        }
        Insert: {
          balance_cents?: number
          created_at?: string
          id?: string
          total_added_cents?: number
          total_consumed_cents?: number
          updated_at?: string
          user_id: string
          voice_enabled?: boolean
        }
        Update: {
          balance_cents?: number
          created_at?: string
          id?: string
          total_added_cents?: number
          total_consumed_cents?: number
          updated_at?: string
          user_id?: string
          voice_enabled?: boolean
        }
        Relationships: []
      }
      ai_pricing_config: {
        Row: {
          gemini_text_input_per_1k_cents: number
          gemini_text_output_per_1k_cents: number
          gemini_vision_per_image_cents: number
          groq_audio_per_minute_cents: number
          id: string
          suggested_margin_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          gemini_text_input_per_1k_cents?: number
          gemini_text_output_per_1k_cents?: number
          gemini_vision_per_image_cents?: number
          groq_audio_per_minute_cents?: number
          id?: string
          suggested_margin_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          gemini_text_input_per_1k_cents?: number
          gemini_text_output_per_1k_cents?: number
          gemini_vision_per_image_cents?: number
          groq_audio_per_minute_cents?: number
          id?: string
          suggested_margin_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          audio_seconds: number
          cost_cents: number
          created_at: string
          id: string
          image_count: number
          kind: string
          metadata: Json
          reference_id: string | null
          source: string | null
          tokens_input: number
          tokens_output: number
          user_id: string
        }
        Insert: {
          audio_seconds?: number
          cost_cents?: number
          created_at?: string
          id?: string
          image_count?: number
          kind: string
          metadata?: Json
          reference_id?: string | null
          source?: string | null
          tokens_input?: number
          tokens_output?: number
          user_id: string
        }
        Update: {
          audio_seconds?: number
          cost_cents?: number
          created_at?: string
          id?: string
          image_count?: number
          kind?: string
          metadata?: Json
          reference_id?: string | null
          source?: string | null
          tokens_input?: number
          tokens_output?: number
          user_id?: string
        }
        Relationships: []
      }
      ai_voice_usage: {
        Row: {
          characters_count: number
          cost_cents: number
          created_at: string
          id: string
          phone: string
          source: string
          user_id: string | null
        }
        Insert: {
          characters_count: number
          cost_cents?: number
          created_at?: string
          id?: string
          phone: string
          source?: string
          user_id?: string | null
        }
        Update: {
          characters_count?: number
          cost_cents?: number
          created_at?: string
          id?: string
          phone?: string
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      appointment_slots: {
        Row: {
          account_id: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
          account_id: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
          account_id: string | null
          appointment_date: string
          appointment_time: string
          appointment_type_id: string | null
          assigned_to: string | null
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
          account_id?: string | null
          appointment_date: string
          appointment_time: string
          appointment_type_id?: string | null
          assigned_to?: string | null
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
          account_id?: string | null
          appointment_date?: string
          appointment_time?: string
          appointment_type_id?: string | null
          assigned_to?: string | null
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
      attendance_flow_runs: {
        Row: {
          current_step: number
          finished_at: string | null
          flow_id: string
          id: string
          last_error: string | null
          next_run_at: string
          phone: string
          started_at: string
          status: string
          trigger_message: string | null
        }
        Insert: {
          current_step?: number
          finished_at?: string | null
          flow_id: string
          id?: string
          last_error?: string | null
          next_run_at?: string
          phone: string
          started_at?: string
          status?: string
          trigger_message?: string | null
        }
        Update: {
          current_step?: number
          finished_at?: string | null
          flow_id?: string
          id?: string
          last_error?: string | null
          next_run_at?: string
          phone?: string
          started_at?: string
          status?: string
          trigger_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_flow_runs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "attendance_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_flow_steps: {
        Row: {
          caption: string | null
          content: string | null
          created_at: string
          delay_before_seconds: number
          flow_id: string
          id: string
          media_path: string | null
          media_url: string | null
          position: number
          recording_indicator: boolean
          type: string
          typing_indicator: boolean
          updated_at: string
        }
        Insert: {
          caption?: string | null
          content?: string | null
          created_at?: string
          delay_before_seconds?: number
          flow_id: string
          id?: string
          media_path?: string | null
          media_url?: string | null
          position?: number
          recording_indicator?: boolean
          type: string
          typing_indicator?: boolean
          updated_at?: string
        }
        Update: {
          caption?: string | null
          content?: string | null
          created_at?: string
          delay_before_seconds?: number
          flow_id?: string
          id?: string
          media_path?: string | null
          media_url?: string | null
          position?: number
          recording_indicator?: boolean
          type?: string
          typing_indicator?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_flow_steps_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "attendance_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_flows: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          only_first_contact: boolean
          pause_support_ai: boolean
          trigger_match_mode: string
          trigger_text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          only_first_contact?: boolean
          pause_support_ai?: boolean
          trigger_match_mode?: string
          trigger_text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          only_first_contact?: boolean
          pause_support_ai?: boolean
          trigger_match_mode?: string
          trigger_text?: string
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          account_id: string | null
          address: string | null
          assigned_to: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          notes: string | null
          person_name: string | null
          person_name_checked_at: string | null
          phone: string
          profile_picture_updated_at: string | null
          profile_picture_url: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          address?: string | null
          assigned_to?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          person_name?: string | null
          person_name_checked_at?: string | null
          phone: string
          profile_picture_updated_at?: string | null
          profile_picture_url?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          address?: string | null
          assigned_to?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          person_name?: string | null
          person_name_checked_at?: string | null
          phone?: string
          profile_picture_updated_at?: string | null
          profile_picture_url?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          account_id: string | null
          content: string
          created_at: string
          deal_id: string
          id: string
          metadata: Json | null
          type: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          content: string
          created_at?: string
          deal_id: string
          id?: string
          metadata?: Json | null
          type?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
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
          account_id: string | null
          created_at: string
          deal_id: string
          id: string
          product_id: string
          quantity: number
          unit_price_cents: number
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          deal_id: string
          id?: string
          product_id: string
          quantity?: number
          unit_price_cents?: number
          user_id: string
        }
        Update: {
          account_id?: string | null
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
      crm_deal_tasks: {
        Row: {
          account_id: string | null
          assigned_to: string | null
          completed: boolean
          completed_at: string | null
          completed_by: string | null
          created_at: string
          deal_id: string
          description: string | null
          due_date: string | null
          id: string
          reminder_sent: boolean
          reminder_sent_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          assigned_to?: string | null
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          deal_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          assigned_to?: string | null
          completed?: boolean
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          deal_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_deals: {
        Row: {
          account_id: string | null
          assigned_to: string | null
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
          account_id?: string | null
          assigned_to?: string | null
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
          account_id?: string | null
          assigned_to?: string | null
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
          account_id: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
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
          account_id: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
      crm_tag_automations: {
        Row: {
          account_id: string
          created_at: string
          enabled: boolean
          id: string
          pipeline_id: string
          tag: string
          target_stage_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          pipeline_id: string
          tag: string
          target_stage_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          pipeline_id?: string
          tag?: string
          target_stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tag_automations_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tag_automations_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tag_automations_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_followup_enrollments: {
        Row: {
          account_id: string
          contact_id: string | null
          created_at: string
          current_step: number
          flow_id: string
          id: string
          last_sent_at: string | null
          metadata: Json
          next_scheduled_at: string | null
          phone: string
          started_at: string
          status: string
          stop_reason: string | null
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          contact_id?: string | null
          created_at?: string
          current_step?: number
          flow_id: string
          id?: string
          last_sent_at?: string | null
          metadata?: Json
          next_scheduled_at?: string | null
          phone: string
          started_at?: string
          status?: string
          stop_reason?: string | null
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          contact_id?: string | null
          created_at?: string
          current_step?: number
          flow_id?: string
          id?: string
          last_sent_at?: string | null
          metadata?: Json
          next_scheduled_at?: string | null
          phone?: string
          started_at?: string
          status?: string
          stop_reason?: string | null
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_followup_enrollments_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "custom_followup_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_followup_events: {
        Row: {
          account_id: string
          created_at: string
          enrollment_id: string | null
          event_type: string
          flow_id: string | null
          id: string
          meta: Json | null
          phone: string | null
          step_id: string | null
          step_position: number | null
          variant_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          enrollment_id?: string | null
          event_type: string
          flow_id?: string | null
          id?: string
          meta?: Json | null
          phone?: string | null
          step_id?: string | null
          step_position?: number | null
          variant_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          enrollment_id?: string | null
          event_type?: string
          flow_id?: string | null
          id?: string
          meta?: Json | null
          phone?: string | null
          step_id?: string | null
          step_position?: number | null
          variant_id?: string | null
        }
        Relationships: []
      }
      custom_followup_flows: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          enabled: boolean
          exclude_handoff: boolean
          filters: Json
          id: string
          max_per_hour: number
          name: string
          stop_on_reply: boolean
          throttle_seconds: number
          trigger_config: Json
          trigger_type: string
          updated_at: string
          user_id: string
          window_config: Json
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          exclude_handoff?: boolean
          filters?: Json
          id?: string
          max_per_hour?: number
          name: string
          stop_on_reply?: boolean
          throttle_seconds?: number
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          user_id: string
          window_config?: Json
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          exclude_handoff?: boolean
          filters?: Json
          id?: string
          max_per_hour?: number
          name?: string
          stop_on_reply?: boolean
          throttle_seconds?: number
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          user_id?: string
          window_config?: Json
        }
        Relationships: []
      }
      custom_followup_holidays: {
        Row: {
          account_id: string
          created_at: string
          date: string
          id: string
          name: string
          recurring: boolean
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          date: string
          id?: string
          name: string
          recurring?: boolean
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          date?: string
          id?: string
          name?: string
          recurring?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      custom_followup_media_library: {
        Row: {
          account_id: string
          created_at: string
          filename: string | null
          id: string
          mime: string | null
          name: string
          size_bytes: number | null
          storage_path: string | null
          tags: string[] | null
          type: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          filename?: string | null
          id?: string
          mime?: string | null
          name: string
          size_bytes?: number | null
          storage_path?: string | null
          tags?: string[] | null
          type: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          filename?: string | null
          id?: string
          mime?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string | null
          tags?: string[] | null
          type?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_followup_queue: {
        Row: {
          account_id: string
          attempts: number
          created_at: string
          enrollment_id: string
          flow_id: string
          id: string
          instance_id: string | null
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          phone: string
          scheduled_at: string
          sent_at: string | null
          status: string
          step_id: string
          step_position: number
        }
        Insert: {
          account_id: string
          attempts?: number
          created_at?: string
          enrollment_id: string
          flow_id: string
          id?: string
          instance_id?: string | null
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          phone: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          step_id: string
          step_position: number
        }
        Update: {
          account_id?: string
          attempts?: number
          created_at?: string
          enrollment_id?: string
          flow_id?: string
          id?: string
          instance_id?: string | null
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          phone?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          step_id?: string
          step_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_followup_queue_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "custom_followup_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_followup_queue_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "custom_followup_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_followup_queue_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "custom_followup_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_followup_steps: {
        Row: {
          account_id: string
          caption: string | null
          conditions: Json
          content: string | null
          created_at: string
          delay_unit: string
          delay_value: number
          flow_id: string
          id: string
          media_filename: string | null
          media_mime: string | null
          media_url: string | null
          position: number
          type: string
          updated_at: string
          variants: Json
        }
        Insert: {
          account_id: string
          caption?: string | null
          conditions?: Json
          content?: string | null
          created_at?: string
          delay_unit?: string
          delay_value?: number
          flow_id: string
          id?: string
          media_filename?: string | null
          media_mime?: string | null
          media_url?: string | null
          position: number
          type?: string
          updated_at?: string
          variants?: Json
        }
        Update: {
          account_id?: string
          caption?: string | null
          conditions?: Json
          content?: string | null
          created_at?: string
          delay_unit?: string
          delay_value?: number
          flow_id?: string
          id?: string
          media_filename?: string | null
          media_mime?: string | null
          media_url?: string | null
          position?: number
          type?: string
          updated_at?: string
          variants?: Json
        }
        Relationships: [
          {
            foreignKeyName: "custom_followup_steps_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "custom_followup_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_followup_webhooks: {
        Row: {
          account_id: string
          created_at: string
          enabled: boolean
          events: string[]
          flow_id: string | null
          headers: Json | null
          id: string
          last_error: string | null
          last_fired_at: string | null
          last_status: number | null
          name: string
          secret: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          enabled?: boolean
          events?: string[]
          flow_id?: string | null
          headers?: Json | null
          id?: string
          last_error?: string | null
          last_fired_at?: string | null
          last_status?: number | null
          name?: string
          secret?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          enabled?: boolean
          events?: string[]
          flow_id?: string | null
          headers?: Json | null
          id?: string
          last_error?: string | null
          last_fired_at?: string | null
          last_status?: number | null
          name?: string
          secret?: string | null
          updated_at?: string
          url?: string
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
      followup_config: {
        Row: {
          account_id: string | null
          bargaining_tools: string | null
          created_at: string | null
          enabled: boolean
          evening_window_end: string
          evening_window_start: string
          exclude_handoff: boolean
          id: string
          inactivity_hours: number
          inactivity_unit: string
          instance_id: string | null
          max_days: number
          morning_window_end: string
          morning_window_start: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          bargaining_tools?: string | null
          created_at?: string | null
          enabled?: boolean
          evening_window_end?: string
          evening_window_start?: string
          exclude_handoff?: boolean
          id?: string
          inactivity_hours?: number
          inactivity_unit?: string
          instance_id?: string | null
          max_days?: number
          morning_window_end?: string
          morning_window_start?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          bargaining_tools?: string | null
          created_at?: string | null
          enabled?: boolean
          evening_window_end?: string
          evening_window_start?: string
          exclude_handoff?: boolean
          id?: string
          inactivity_hours?: number
          inactivity_unit?: string
          instance_id?: string | null
          max_days?: number
          morning_window_end?: string
          morning_window_start?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      followup_messages: {
        Row: {
          account_id: string | null
          content: string
          created_at: string
          hook_used: string | null
          id: string
          phone: string
          scheduled_at: string
          sent_at: string | null
          status: string
          step: number
          tracking_id: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          content: string
          created_at?: string
          hook_used?: string | null
          id?: string
          phone: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          step: number
          tracking_id: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          content?: string
          created_at?: string
          hook_used?: string | null
          id?: string
          phone?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          step?: number
          tracking_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_messages_tracking_id_fkey"
            columns: ["tracking_id"]
            isOneToOne: false
            referencedRelation: "followup_tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_tracking: {
        Row: {
          account_id: string | null
          cancellation_reason: string | null
          context_summary: string | null
          created_at: string | null
          current_step: number
          engagement_data: Json | null
          id: string
          last_sent_at: string | null
          next_scheduled_at: string | null
          phone: string
          sequence_generated_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          cancellation_reason?: string | null
          context_summary?: string | null
          created_at?: string | null
          current_step?: number
          engagement_data?: Json | null
          id?: string
          last_sent_at?: string | null
          next_scheduled_at?: string | null
          phone: string
          sequence_generated_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          cancellation_reason?: string | null
          context_summary?: string | null
          created_at?: string | null
          current_step?: number
          engagement_data?: Json | null
          id?: string
          last_sent_at?: string | null
          next_scheduled_at?: string | null
          phone?: string
          sequence_generated_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      help_article_images: {
        Row: {
          article_id: string
          caption: string | null
          created_at: string
          id: string
          position: number
          storage_path: string
        }
        Insert: {
          article_id: string
          caption?: string | null
          created_at?: string
          id?: string
          position?: number
          storage_path: string
        }
        Update: {
          article_id?: string
          caption?: string | null
          created_at?: string
          id?: string
          position?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_article_images_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "help_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      help_articles: {
        Row: {
          category_id: string
          content: string
          created_at: string
          id: string
          position: number
          published: boolean
          slug: string
          summary: string | null
          title: string
          updated_at: string
          video_provider: string | null
          video_url: string | null
        }
        Insert: {
          category_id: string
          content?: string
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
          video_provider?: string | null
          video_url?: string | null
        }
        Update: {
          category_id?: string
          content?: string
          created_at?: string
          id?: string
          position?: number
          published?: boolean
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
          video_provider?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "help_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      help_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      igreen_account_products: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          enabled: boolean
          followup_after_video_message: string
          followup_after_video_seconds: number
          id: string
          key: string
          name: string
          position: number
          updated_at: string
          video_url: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          followup_after_video_message?: string
          followup_after_video_seconds?: number
          id?: string
          key: string
          name: string
          position?: number
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          followup_after_video_message?: string
          followup_after_video_seconds?: number
          id?: string
          key?: string
          name?: string
          position?: number
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "igreen_account_products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      igreen_default_ai_config: {
        Row: {
          agent_name: string
          business_description: string | null
          business_niche: string | null
          created_at: string
          custom_prompt: string
          id: string
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agent_name?: string
          business_description?: string | null
          business_niche?: string | null
          created_at?: string
          custom_prompt: string
          id?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agent_name?: string
          business_description?: string | null
          business_niche?: string | null
          created_at?: string
          custom_prompt?: string
          id?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      igreen_distributor_discounts: {
        Row: {
          created_at: string
          credit_analysis: string | null
          discount_max_percent: number
          discount_min_percent: number
          distributor: string
          distributor_aliases: string[]
          enabled: boolean
          id: string
          injection_days: string | null
          min_bill_brl: number | null
          modalidade: string | null
          notes: string | null
          state: string
          state_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_analysis?: string | null
          discount_max_percent?: number
          discount_min_percent?: number
          distributor: string
          distributor_aliases?: string[]
          enabled?: boolean
          id?: string
          injection_days?: string | null
          min_bill_brl?: number | null
          modalidade?: string | null
          notes?: string | null
          state: string
          state_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_analysis?: string | null
          discount_max_percent?: number
          discount_min_percent?: number
          distributor?: string
          distributor_aliases?: string[]
          enabled?: boolean
          id?: string
          injection_days?: string | null
          min_bill_brl?: number | null
          modalidade?: string | null
          notes?: string | null
          state?: string
          state_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      igreen_lead_data: {
        Row: {
          account_id: string
          cpf_documento_masked: string | null
          cpf_titular_fatura_masked: string | null
          created_at: string
          distribuidora: string | null
          documento_url: string | null
          estado: string | null
          fatura_url: string | null
          id: string
          nome_cliente: string | null
          nome_documento: string | null
          nome_titular_fatura: string | null
          nomes_conferem: boolean | null
          phone: string
          tipo_conta: string | null
          titular_confirmado: boolean | null
          updated_at: string
          valor_fatura_cents: number | null
        }
        Insert: {
          account_id: string
          cpf_documento_masked?: string | null
          cpf_titular_fatura_masked?: string | null
          created_at?: string
          distribuidora?: string | null
          documento_url?: string | null
          estado?: string | null
          fatura_url?: string | null
          id?: string
          nome_cliente?: string | null
          nome_documento?: string | null
          nome_titular_fatura?: string | null
          nomes_conferem?: boolean | null
          phone: string
          tipo_conta?: string | null
          titular_confirmado?: boolean | null
          updated_at?: string
          valor_fatura_cents?: number | null
        }
        Update: {
          account_id?: string
          cpf_documento_masked?: string | null
          cpf_titular_fatura_masked?: string | null
          created_at?: string
          distribuidora?: string | null
          documento_url?: string | null
          estado?: string | null
          fatura_url?: string | null
          id?: string
          nome_cliente?: string | null
          nome_documento?: string | null
          nome_titular_fatura?: string | null
          nomes_conferem?: boolean | null
          phone?: string
          tipo_conta?: string | null
          titular_confirmado?: boolean | null
          updated_at?: string
          valor_fatura_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "igreen_lead_data_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      igreen_product_video_followups: {
        Row: {
          account_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          id: string
          message: string
          phone: string
          product_id: string | null
          scheduled_at: string
          sent_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          message: string
          phone: string
          product_id?: string | null
          scheduled_at: string
          sent_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          message?: string
          phone?: string
          product_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "igreen_product_video_followups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "igreen_account_products"
            referencedColumns: ["id"]
          },
        ]
      }
      igreen_products: {
        Row: {
          created_at: string
          description: string | null
          enabled: boolean
          key: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          enabled?: boolean
          key?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      igreen_scenario_days: {
        Row: {
          created_at: string
          day_number: number
          enabled: boolean
          id: string
          scenario_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_number: number
          enabled?: boolean
          id?: string
          scenario_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_number?: number
          enabled?: boolean
          id?: string
          scenario_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "igreen_scenario_days_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "igreen_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      igreen_scenario_enrollments: {
        Row: {
          account_id: string
          contact_id: string | null
          contact_phone: string
          created_at: string
          current_day: number
          current_item_position: number
          current_period: string
          final_tag_applied_at: string | null
          id: string
          last_sent_at: string | null
          next_run_at: string | null
          scenario_id: string
          scenario_key: string
          started_at: string
          status: string
          stop_reason: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          contact_id?: string | null
          contact_phone: string
          created_at?: string
          current_day?: number
          current_item_position?: number
          current_period?: string
          final_tag_applied_at?: string | null
          id?: string
          last_sent_at?: string | null
          next_run_at?: string | null
          scenario_id: string
          scenario_key: string
          started_at?: string
          status?: string
          stop_reason?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          contact_id?: string | null
          contact_phone?: string
          created_at?: string
          current_day?: number
          current_item_position?: number
          current_period?: string
          final_tag_applied_at?: string | null
          id?: string
          last_sent_at?: string | null
          next_run_at?: string | null
          scenario_id?: string
          scenario_key?: string
          started_at?: string
          status?: string
          stop_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "igreen_scenario_enrollments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "igreen_scenario_enrollments_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "igreen_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      igreen_scenario_events: {
        Row: {
          day_number: number
          enrollment_id: string
          error: string | null
          id: string
          message_id: string | null
          period: string
          sent_at: string
          status: string
        }
        Insert: {
          day_number: number
          enrollment_id: string
          error?: string | null
          id?: string
          message_id?: string | null
          period: string
          sent_at?: string
          status?: string
        }
        Update: {
          day_number?: number
          enrollment_id?: string
          error?: string | null
          id?: string
          message_id?: string | null
          period?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "igreen_scenario_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "igreen_scenario_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      igreen_scenario_items: {
        Row: {
          caption: string | null
          content: string | null
          created_at: string
          delay_unit: string
          delay_value: number
          id: string
          media_filename: string | null
          media_mime: string | null
          media_url: string | null
          message_id: string
          position: number
          type: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          content?: string | null
          created_at?: string
          delay_unit?: string
          delay_value?: number
          id?: string
          media_filename?: string | null
          media_mime?: string | null
          media_url?: string | null
          message_id: string
          position?: number
          type: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          content?: string | null
          created_at?: string
          delay_unit?: string
          delay_value?: number
          id?: string
          media_filename?: string | null
          media_mime?: string | null
          media_url?: string | null
          message_id?: string
          position?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "igreen_scenario_items_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "igreen_scenario_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      igreen_scenario_messages: {
        Row: {
          created_at: string
          day_id: string
          id: string
          label: string | null
          period: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_id: string
          id?: string
          label?: string | null
          period: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_id?: string
          id?: string
          label?: string | null
          period?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "igreen_scenario_messages_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "igreen_scenario_days"
            referencedColumns: ["id"]
          },
        ]
      }
      igreen_scenarios: {
        Row: {
          account_id: string
          created_at: string
          description: string | null
          enabled: boolean
          final_tag: string | null
          final_tag_delay_hours: number
          id: string
          name: string
          product_key: string
          scenario_key: string | null
          trigger_tag: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          final_tag?: string | null
          final_tag_delay_hours?: number
          id?: string
          name: string
          product_key?: string
          scenario_key?: string | null
          trigger_tag?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          description?: string | null
          enabled?: boolean
          final_tag?: string | null
          final_tag_delay_hours?: number
          id?: string
          name?: string
          product_key?: string
          scenario_key?: string | null
          trigger_tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "igreen_scenarios_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "igreen_scenarios_account_product_fkey"
            columns: ["account_id", "product_key"]
            isOneToOne: false
            referencedRelation: "igreen_account_products"
            referencedColumns: ["account_id", "key"]
          },
        ]
      }
      knowledge_base_documents: {
        Row: {
          account_id: string | null
          content_text: string | null
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          igreen_product_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          content_text?: string | null
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          igreen_product_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          content_text?: string | null
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          igreen_product_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_documents_igreen_product_id_fkey"
            columns: ["igreen_product_id"]
            isOneToOne: false
            referencedRelation: "igreen_account_products"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_contacts: {
        Row: {
          account_id: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
          file_path: string | null
          id: string
          step_key: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          id?: string
          step_key: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          file_path?: string | null
          id?: string
          step_key?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          billing_period: string
          checkout_url: string | null
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          is_recommended: boolean
          limits: Json
          name: string
          position: number
          price_cents: number
          slug: string
          tier: string
          updated_at: string
        }
        Insert: {
          billing_period: string
          checkout_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          limits?: Json
          name: string
          position?: number
          price_cents?: number
          slug: string
          tier: string
          updated_at?: string
        }
        Update: {
          billing_period?: string
          checkout_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_recommended?: boolean
          limits?: Json
          name?: string
          position?: number
          price_cents?: number
          slug?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          account_id: string | null
          created_at: string | null
          evolution_api_key: string | null
          evolution_api_url: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          evolution_api_key?: string | null
          evolution_api_url?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
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
          account_id: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
          feature_keyword_triggers: boolean
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
          feature_keyword_triggers?: boolean
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
          feature_keyword_triggers?: boolean
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
      roulette_assignments: {
        Row: {
          accepted_at: string | null
          account_id: string
          assigned_at: string
          attempts: number
          contact_name: string | null
          created_at: string
          expires_at: string
          id: string
          owner_user_id: string
          phone: string
          skipped_user_ids: string[]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          account_id: string
          assigned_at?: string
          attempts?: number
          contact_name?: string | null
          created_at?: string
          expires_at: string
          id?: string
          owner_user_id: string
          phone: string
          skipped_user_ids?: string[]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          account_id?: string
          assigned_at?: string
          attempts?: number
          contact_name?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          owner_user_id?: string
          phone?: string
          skipped_user_ids?: string[]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      roulette_config: {
        Row: {
          accept_timeout_minutes: number
          account_id: string
          created_at: string
          enabled: boolean
          id: string
          last_assigned_at: string | null
          last_assigned_user_id: string | null
          online_threshold_seconds: number
          participant_user_ids: string[]
          require_acceptance: boolean
          require_online: boolean
          updated_at: string
        }
        Insert: {
          accept_timeout_minutes?: number
          account_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_assigned_at?: string | null
          last_assigned_user_id?: string | null
          online_threshold_seconds?: number
          participant_user_ids?: string[]
          require_acceptance?: boolean
          require_online?: boolean
          updated_at?: string
        }
        Update: {
          accept_timeout_minutes?: number
          account_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_assigned_at?: string | null
          last_assigned_user_id?: string | null
          online_threshold_seconds?: number
          participant_user_ids?: string[]
          require_acceptance?: boolean
          require_online?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          account_id: string | null
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
          plan_id: string | null
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
          account_id?: string | null
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
          plan_id?: string | null
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
          account_id?: string | null
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
          plan_id?: string | null
          plan_type?: string | null
          product_name?: string | null
          raw_data?: Json | null
          refunded_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      support_appointment_types: {
        Row: {
          created_at: string
          days_of_week: number[]
          description: string | null
          duration_minutes: number
          end_time: string
          id: string
          is_active: boolean
          max_appointments_per_slot: number
          name: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[]
          description?: string | null
          duration_minutes?: number
          end_time?: string
          id?: string
          is_active?: boolean
          max_appointments_per_slot?: number
          name: string
          start_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[]
          description?: string | null
          duration_minutes?: number
          end_time?: string
          id?: string
          is_active?: boolean
          max_appointments_per_slot?: number
          name?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          appointment_type_id: string | null
          contact_name: string | null
          created_at: string
          duration_minutes: number
          id: string
          notes: string | null
          phone: string
          reminder_sent: boolean
          reminder_sent_at: string | null
          status: string
          updated_at: string
          user_ref_id: string | null
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          appointment_type_id?: string | null
          contact_name?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          phone: string
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          status?: string
          updated_at?: string
          user_ref_id?: string | null
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          appointment_type_id?: string | null
          contact_name?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          phone?: string
          reminder_sent?: boolean
          reminder_sent_at?: string | null
          status?: string
          updated_at?: string
          user_ref_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_appointments_appointment_type_id_fkey"
            columns: ["appointment_type_id"]
            isOneToOne: false
            referencedRelation: "support_appointment_types"
            referencedColumns: ["id"]
          },
        ]
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
          account_id: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
          response_delay_seconds: number
          updated_at: string | null
          voice_enabled: boolean
          voice_id: string | null
          voice_similarity_boost: number | null
          voice_speed: number | null
          voice_stability: number | null
          voice_style: number | null
          welcome_delay_minutes: number
          welcome_message_delay_seconds: number
          welcome_messages: Json
          welcome_sequence_enabled: boolean
        }
        Insert: {
          active?: boolean | null
          agent_name?: string | null
          created_at?: string | null
          custom_prompt?: string | null
          id?: string
          response_delay_seconds?: number
          updated_at?: string | null
          voice_enabled?: boolean
          voice_id?: string | null
          voice_similarity_boost?: number | null
          voice_speed?: number | null
          voice_stability?: number | null
          voice_style?: number | null
          welcome_delay_minutes?: number
          welcome_message_delay_seconds?: number
          welcome_messages?: Json
          welcome_sequence_enabled?: boolean
        }
        Update: {
          active?: boolean | null
          agent_name?: string | null
          created_at?: string | null
          custom_prompt?: string | null
          id?: string
          response_delay_seconds?: number
          updated_at?: string | null
          voice_enabled?: boolean
          voice_id?: string | null
          voice_similarity_boost?: number | null
          voice_speed?: number | null
          voice_stability?: number | null
          voice_style?: number | null
          welcome_delay_minutes?: number
          welcome_message_delay_seconds?: number
          welcome_messages?: Json
          welcome_sequence_enabled?: boolean
        }
        Relationships: []
      }
      system_api_health: {
        Row: {
          api_name: string
          consecutive_failures: number
          created_at: string
          id: string
          last_alert_sent_at: string | null
          last_error_at: string | null
          last_error_message: string | null
          last_ok_at: string | null
          recovery_alert_sent: boolean
          status: string
          updated_at: string
        }
        Insert: {
          api_name: string
          consecutive_failures?: number
          created_at?: string
          id?: string
          last_alert_sent_at?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_ok_at?: string | null
          recovery_alert_sent?: boolean
          status?: string
          updated_at?: string
        }
        Update: {
          api_name?: string
          consecutive_failures?: number
          created_at?: string
          id?: string
          last_alert_sent_at?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          last_ok_at?: string | null
          recovery_alert_sent?: boolean
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_followup_config: {
        Row: {
          bargaining_tools: string | null
          created_at: string
          enabled: boolean
          evening_window_end: string
          evening_window_start: string
          exclude_handoff: boolean
          id: string
          inactivity_hours: number
          max_days: number
          morning_window_end: string
          morning_window_start: string
          updated_at: string
        }
        Insert: {
          bargaining_tools?: string | null
          created_at?: string
          enabled?: boolean
          evening_window_end?: string
          evening_window_start?: string
          exclude_handoff?: boolean
          id?: string
          inactivity_hours?: number
          max_days?: number
          morning_window_end?: string
          morning_window_start?: string
          updated_at?: string
        }
        Update: {
          bargaining_tools?: string | null
          created_at?: string
          enabled?: boolean
          evening_window_end?: string
          evening_window_start?: string
          exclude_handoff?: boolean
          id?: string
          inactivity_hours?: number
          max_days?: number
          morning_window_end?: string
          morning_window_start?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_followup_messages: {
        Row: {
          content: string
          created_at: string
          hook_used: string | null
          id: string
          phone: string
          scheduled_at: string
          sent_at: string | null
          status: string
          step: number
          tracking_id: string
        }
        Insert: {
          content: string
          created_at?: string
          hook_used?: string | null
          id?: string
          phone: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          step: number
          tracking_id: string
        }
        Update: {
          content?: string
          created_at?: string
          hook_used?: string | null
          id?: string
          phone?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          step?: number
          tracking_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_followup_messages_tracking_id_fkey"
            columns: ["tracking_id"]
            isOneToOne: false
            referencedRelation: "system_followup_tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      system_followup_tracking: {
        Row: {
          cancellation_reason: string | null
          context_summary: string | null
          created_at: string
          current_step: number
          engagement_data: Json | null
          id: string
          last_sent_at: string | null
          next_scheduled_at: string | null
          phone: string
          sequence_generated_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cancellation_reason?: string | null
          context_summary?: string | null
          created_at?: string
          current_step?: number
          engagement_data?: Json | null
          id?: string
          last_sent_at?: string | null
          next_scheduled_at?: string | null
          phone: string
          sequence_generated_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cancellation_reason?: string | null
          context_summary?: string | null
          created_at?: string
          current_step?: number
          engagement_data?: Json | null
          id?: string
          last_sent_at?: string | null
          next_scheduled_at?: string | null
          phone?: string
          sequence_generated_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_pending_responses: {
        Row: {
          created_at: string | null
          id: string
          phone: string
          processed: boolean | null
          scheduled_at: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          phone: string
          processed?: boolean | null
          scheduled_at: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          phone?: string
          processed?: boolean | null
          scheduled_at?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_welcome_queue: {
        Row: {
          created_at: string
          error_message: string | null
          full_name: string | null
          id: string
          phone: string
          processed: boolean
          processed_at: string | null
          scheduled_at: string
          skipped_reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          full_name?: string | null
          id?: string
          phone: string
          processed?: boolean
          processed_at?: string | null
          scheduled_at: string
          skipped_reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          full_name?: string | null
          id?: string
          phone?: string
          processed?: boolean
          processed_at?: string | null
          scheduled_at?: string
          skipped_reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      system_whatsapp_conversations: {
        Row: {
          ai_active: boolean | null
          ai_processing_until: string | null
          contact_name: string | null
          created_at: string | null
          finalized_at: string | null
          finalized_by: string | null
          id: string
          last_message_at: string | null
          messages: Json | null
          phone: string
          total_messages: number | null
          updated_at: string | null
        }
        Insert: {
          ai_active?: boolean | null
          ai_processing_until?: string | null
          contact_name?: string | null
          created_at?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          last_message_at?: string | null
          messages?: Json | null
          phone: string
          total_messages?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_active?: boolean | null
          ai_processing_until?: string | null
          contact_name?: string | null
          created_at?: string | null
          finalized_at?: string | null
          finalized_by?: string | null
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
      team_invite_markers: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      trial_notification_config: {
        Row: {
          created_at: string
          discount_coupon_code: string
          discount_percent: number
          enabled: boolean
          evening_window_end: string
          evening_window_start: string
          id: string
          morning_window_end: string
          morning_window_start: string
          step_1_template: string
          step_2_template: string
          step_3_template: string
          step_4_template: string
          step_5_template: string
          step_6_template: string
          step_7_template: string
          step_8_template: string
          step_9_template: string
          step_offsets: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_coupon_code?: string
          discount_percent?: number
          enabled?: boolean
          evening_window_end?: string
          evening_window_start?: string
          id?: string
          morning_window_end?: string
          morning_window_start?: string
          step_1_template?: string
          step_2_template?: string
          step_3_template?: string
          step_4_template?: string
          step_5_template?: string
          step_6_template?: string
          step_7_template?: string
          step_8_template?: string
          step_9_template?: string
          step_offsets?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_coupon_code?: string
          discount_percent?: number
          enabled?: boolean
          evening_window_end?: string
          evening_window_start?: string
          id?: string
          morning_window_end?: string
          morning_window_start?: string
          step_1_template?: string
          step_2_template?: string
          step_3_template?: string
          step_4_template?: string
          step_5_template?: string
          step_6_template?: string
          step_7_template?: string
          step_8_template?: string
          step_9_template?: string
          step_offsets?: Json
          updated_at?: string
        }
        Relationships: []
      }
      trial_notification_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          phase: string
          phone: string
          scheduled_at: string
          sent_at: string | null
          status: string
          step: number
          tracking_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          phase: string
          phone: string
          scheduled_at: string
          sent_at?: string | null
          status?: string
          step: number
          tracking_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          phase?: string
          phone?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          step?: number
          tracking_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_notification_messages_tracking_id_fkey"
            columns: ["tracking_id"]
            isOneToOne: false
            referencedRelation: "trial_notification_tracking"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_notification_tracking: {
        Row: {
          account_id: string
          business_context: string | null
          created_at: string
          current_step: number
          engagement_data: Json
          id: string
          last_sent_at: string | null
          next_scheduled_at: string | null
          owner_user_id: string
          phone: string
          status: string
          trial_ends_at: string
          updated_at: string
        }
        Insert: {
          account_id: string
          business_context?: string | null
          created_at?: string
          current_step?: number
          engagement_data?: Json
          id?: string
          last_sent_at?: string | null
          next_scheduled_at?: string | null
          owner_user_id: string
          phone: string
          status?: string
          trial_ends_at: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          business_context?: string | null
          created_at?: string
          current_step?: number
          engagement_data?: Json
          id?: string
          last_sent_at?: string | null
          next_scheduled_at?: string | null
          owner_user_id?: string
          phone?: string
          status?: string
          trial_ends_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_goals: {
        Row: {
          account_id: string
          appointments_goal: number
          created_at: string
          id: string
          leads_goal: number
          period_type: string
          sales_goal: number
          sales_value_cents_goal: number
          services_goal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          appointments_goal?: number
          created_at?: string
          id?: string
          leads_goal?: number
          period_type?: string
          sales_goal?: number
          sales_value_cents_goal?: number
          services_goal?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          appointments_goal?: number
          created_at?: string
          id?: string
          leads_goal?: number
          period_type?: string
          sales_goal?: number
          sales_value_cents_goal?: number
          services_goal?: number
          updated_at?: string
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
          account_id: string | null
          active: boolean | null
          agent_name: string | null
          business_address: string | null
          business_days: number[] | null
          business_description: string | null
          business_hours_end: string | null
          business_hours_start: string | null
          business_latitude: number | null
          business_location_name: string | null
          business_longitude: number | null
          business_niche: string | null
          created_at: string | null
          custom_prompt: string | null
          delay_between_messages: number | null
          handoff_message: string | null
          id: string
          initial_message_1: string | null
          initial_message_2: string | null
          initial_message_3: string | null
          instance_id: string | null
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
          account_id?: string | null
          active?: boolean | null
          agent_name?: string | null
          business_address?: string | null
          business_days?: number[] | null
          business_description?: string | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          business_latitude?: number | null
          business_location_name?: string | null
          business_longitude?: number | null
          business_niche?: string | null
          created_at?: string | null
          custom_prompt?: string | null
          delay_between_messages?: number | null
          handoff_message?: string | null
          id?: string
          initial_message_1?: string | null
          initial_message_2?: string | null
          initial_message_3?: string | null
          instance_id?: string | null
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
          account_id?: string | null
          active?: boolean | null
          agent_name?: string | null
          business_address?: string | null
          business_days?: number[] | null
          business_description?: string | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          business_latitude?: number | null
          business_location_name?: string | null
          business_longitude?: number | null
          business_niche?: string | null
          created_at?: string | null
          custom_prompt?: string | null
          delay_between_messages?: number | null
          handoff_message?: string | null
          id?: string
          initial_message_1?: string | null
          initial_message_2?: string | null
          initial_message_3?: string | null
          instance_id?: string | null
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
      whatsapp_ai_config_history: {
        Row: {
          agent_name: string | null
          business_description: string | null
          business_niche: string | null
          change_source: string | null
          changed_at: string
          changed_by: string | null
          config_id: string
          custom_prompt: string | null
          id: string
          user_id: string
        }
        Insert: {
          agent_name?: string | null
          business_description?: string | null
          business_niche?: string | null
          change_source?: string | null
          changed_at?: string
          changed_by?: string | null
          config_id: string
          custom_prompt?: string | null
          id?: string
          user_id: string
        }
        Update: {
          agent_name?: string | null
          business_description?: string | null
          business_niche?: string | null
          change_source?: string | null
          changed_at?: string
          changed_by?: string | null
          config_id?: string
          custom_prompt?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_ai_sessions: {
        Row: {
          account_id: string | null
          created_at: string | null
          handed_off_at: string | null
          id: string
          instance_id: string | null
          last_human_message_at: string | null
          messages: Json | null
          messages_without_human: number | null
          phone: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          handed_off_at?: string | null
          id?: string
          instance_id?: string | null
          last_human_message_at?: string | null
          messages?: Json | null
          messages_without_human?: number | null
          phone: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          handed_off_at?: string | null
          id?: string
          instance_id?: string | null
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
          account_id: string | null
          ai_active: boolean | null
          ai_processing_until: string | null
          assigned_to: string | null
          closed_at: string | null
          closed_by: string | null
          contact_name: string | null
          created_at: string | null
          id: string
          instance_id: string | null
          last_message_at: string | null
          messages: Json | null
          outcome: string | null
          outcome_reason: string | null
          outcome_value_cents: number | null
          phone: string
          profile_picture_updated_at: string | null
          profile_picture_url: string | null
          total_messages: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          ai_active?: boolean | null
          ai_processing_until?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          instance_id?: string | null
          last_message_at?: string | null
          messages?: Json | null
          outcome?: string | null
          outcome_reason?: string | null
          outcome_value_cents?: number | null
          phone: string
          profile_picture_updated_at?: string | null
          profile_picture_url?: string | null
          total_messages?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          ai_active?: boolean | null
          ai_processing_until?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          instance_id?: string | null
          last_message_at?: string | null
          messages?: Json | null
          outcome?: string | null
          outcome_reason?: string | null
          outcome_value_cents?: number | null
          phone?: string
          profile_picture_updated_at?: string | null
          profile_picture_url?: string | null
          total_messages?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_instances: {
        Row: {
          account_id: string | null
          ai_enabled: boolean
          created_at: string | null
          department_slug: string | null
          display_name: string | null
          followup_enabled: boolean
          id: string
          initial_sync_completed_at: string | null
          instance_name: string
          is_primary: boolean
          last_sync_at: string | null
          pairing_code: string | null
          phone_number: string | null
          profile_name: string | null
          qr_code_base64: string | null
          status: string | null
          transfer_message: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          ai_enabled?: boolean
          created_at?: string | null
          department_slug?: string | null
          display_name?: string | null
          followup_enabled?: boolean
          id?: string
          initial_sync_completed_at?: string | null
          instance_name: string
          is_primary?: boolean
          last_sync_at?: string | null
          pairing_code?: string | null
          phone_number?: string | null
          profile_name?: string | null
          qr_code_base64?: string | null
          status?: string | null
          transfer_message?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          ai_enabled?: boolean
          created_at?: string | null
          department_slug?: string | null
          display_name?: string | null
          followup_enabled?: boolean
          id?: string
          initial_sync_completed_at?: string | null
          instance_name?: string
          is_primary?: boolean
          last_sync_at?: string | null
          pairing_code?: string | null
          phone_number?: string | null
          profile_name?: string | null
          qr_code_base64?: string | null
          status?: string | null
          transfer_message?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_pending_responses: {
        Row: {
          account_id: string | null
          created_at: string | null
          id: string
          instance_id: string | null
          phone: string
          processed: boolean | null
          scheduled_at: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          id?: string
          instance_id?: string | null
          phone: string
          processed?: boolean | null
          scheduled_at: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          id?: string
          instance_id?: string | null
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
      accept_roulette_assignment: {
        Args: { _phone: string; _user_id: string }
        Returns: string
      }
      account_plan_tier: { Args: { _account_id: string }; Returns: string }
      apply_tag_automation_for_contact: {
        Args: { _account_id: string; _contact_id: string; _new_tags: string[] }
        Returns: undefined
      }
      auto_advance_admin_deal_to_trial: {
        Args: { _user_id: string }
        Returns: undefined
      }
      cancel_followup_sequence: {
        Args: { p_phone: string; p_reason: string; p_user_id: string }
        Returns: number
      }
      cancel_trial_notification: {
        Args: { p_account_id: string; p_reason: string }
        Returns: number
      }
      current_account_id: { Args: never; Returns: string }
      custom_followup_stop_for_phone: {
        Args: { _account_id: string; _phone: string; _reason: string }
        Returns: number
      }
      finalize_conversation:
        | {
            Args: {
              _conversation_id: string
              _outcome: string
              _reason?: string
              _value_cents?: number
            }
            Returns: string
          }
        | {
            Args: {
              _conversation_id: string
              _outcome: string
              _reason?: string
              _stage_id?: string
              _value_cents?: number
            }
            Returns: string
          }
      get_account_role: {
        Args: { _account_id: string }
        Returns: Database["public"]["Enums"]["account_role"]
      }
      has_account_permission: {
        Args: { _account_id: string; _permission: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      igreen_stop_for_phone: {
        Args: { p_account_id: string; p_phone: string; p_reason: string }
        Returns: number
      }
      is_account_member: { Args: { _account_id: string }; Returns: boolean }
      is_team_invite_email: { Args: { _email: string }; Returns: boolean }
      must_filter_by_assignment: {
        Args: { _account_id: string }
        Returns: boolean
      }
      pause_trial_notification_by_phone: {
        Args: { p_phone: string }
        Returns: number
      }
      recalc_admin_deal_stage: {
        Args: { _user_id: string }
        Returns: undefined
      }
      reopen_conversation: {
        Args: { _conversation_id: string }
        Returns: string
      }
      roulette_pick_next:
        | { Args: { _account_id: string }; Returns: string }
        | {
            Args: {
              _account_id: string
              _exclude_user_ids?: string[]
              _only_online?: boolean
            }
            Returns: string
          }
      system_cancel_followup_sequence: {
        Args: { p_phone: string; p_reason: string }
        Returns: number
      }
      tag_contact_reserved: {
        Args: {
          _account_id: string
          _add: boolean
          _phone: string
          _tag: string
        }
        Returns: number
      }
    }
    Enums: {
      account_member_status: "active" | "invited" | "suspended" | "removed"
      account_role: "owner" | "manager" | "seller" | "agent"
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
      account_member_status: ["active", "invited", "suspended", "removed"],
      account_role: ["owner", "manager", "seller", "agent"],
      app_role: ["super_admin", "admin", "user"],
    },
  },
} as const
