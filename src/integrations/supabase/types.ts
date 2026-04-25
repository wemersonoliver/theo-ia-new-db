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
          created_at: string
          id: string
          name: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_crm_deals: {
        Row: {
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
          account_id: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
      knowledge_base_documents: {
        Row: {
          account_id: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
          account_id: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
          account_id: string | null
          ai_active: boolean | null
          assigned_to: string | null
          contact_name: string | null
          created_at: string | null
          id: string
          last_message_at: string | null
          messages: Json | null
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
          assigned_to?: string | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          messages?: Json | null
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
          assigned_to?: string | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          messages?: Json | null
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
          account_id?: string | null
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
          account_id?: string | null
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
          account_id: string | null
          created_at: string | null
          id: string
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
      auto_advance_admin_deal_to_trial: {
        Args: { _user_id: string }
        Returns: undefined
      }
      current_account_id: { Args: never; Returns: string }
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
      is_account_member: { Args: { _account_id: string }; Returns: boolean }
      is_team_invite_email: { Args: { _email: string }; Returns: boolean }
      must_filter_by_assignment: {
        Args: { _account_id: string }
        Returns: boolean
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
