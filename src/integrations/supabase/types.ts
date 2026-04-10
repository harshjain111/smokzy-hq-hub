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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          attendance_id: string | null
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          priority: string
          title: string
          type: string
          user_id: string
          venue_id: string | null
        }
        Insert: {
          attendance_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          priority?: string
          title: string
          type: string
          user_id: string
          venue_id?: string | null
        }
        Update: {
          attendance_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          priority?: string
          title?: string
          type?: string
          user_id?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_notifications_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_notifications_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          check_in_lat: number
          check_in_lng: number
          check_in_selfie_url: string
          check_in_time: string
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_selfie_url: string | null
          check_out_time: string | null
          created_at: string
          early_checkout: boolean | null
          early_checkout_reason: string | null
          id: string
          tasks_completed: boolean
          user_id: string
          venue_id: string
        }
        Insert: {
          check_in_lat: number
          check_in_lng: number
          check_in_selfie_url: string
          check_in_time?: string
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_selfie_url?: string | null
          check_out_time?: string | null
          created_at?: string
          early_checkout?: boolean | null
          early_checkout_reason?: string | null
          id?: string
          tasks_completed?: boolean
          user_id: string
          venue_id: string
        }
        Update: {
          check_in_lat?: number
          check_in_lng?: number
          check_in_selfie_url?: string
          check_in_time?: string
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_selfie_url?: string | null
          check_out_time?: string | null
          created_at?: string
          early_checkout?: boolean | null
          early_checkout_reason?: string | null
          id?: string
          tasks_completed?: boolean
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      breakage_reports: {
        Row: {
          cause: string
          created_at: string
          id: string
          item_type: string
          quantity: number
          reported_by: string
          venue_id: string
        }
        Insert: {
          cause: string
          created_at?: string
          id?: string
          item_type: string
          quantity?: number
          reported_by: string
          venue_id: string
        }
        Update: {
          cause?: string
          created_at?: string
          id?: string
          item_type?: string
          quantity?: number
          reported_by?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "breakage_reports_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      closing_photos: {
        Row: {
          created_at: string
          id: string
          photo_date: string
          photo_url: string
          uploaded_by: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_date?: string
          photo_url: string
          uploaded_by: string
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_date?: string
          photo_url?: string
          uploaded_by?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "closing_photos_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      club_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          force_close_reason: string | null
          id: string
          photo_uploaded: boolean
          photo_uploaded_at: string | null
          photo_uploaded_by: string | null
          sales_submitted: boolean
          sales_submitted_at: string | null
          sales_submitted_by: string | null
          session_date: string
          started_at: string
          status: string
          stock_submitted: boolean
          stock_submitted_at: string | null
          stock_submitted_by: string | null
          updated_at: string
          venue_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          force_close_reason?: string | null
          id?: string
          photo_uploaded?: boolean
          photo_uploaded_at?: string | null
          photo_uploaded_by?: string | null
          sales_submitted?: boolean
          sales_submitted_at?: string | null
          sales_submitted_by?: string | null
          session_date: string
          started_at?: string
          status?: string
          stock_submitted?: boolean
          stock_submitted_at?: string | null
          stock_submitted_by?: string | null
          updated_at?: string
          venue_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          force_close_reason?: string | null
          id?: string
          photo_uploaded?: boolean
          photo_uploaded_at?: string | null
          photo_uploaded_by?: string | null
          sales_submitted?: boolean
          sales_submitted_at?: string | null
          sales_submitted_by?: string | null
          session_date?: string
          started_at?: string
          status?: string
          stock_submitted?: boolean
          stock_submitted_at?: string | null
          stock_submitted_by?: string | null
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_sessions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_roster: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          date: string
          edit_count: number
          id: string
          is_removed: boolean
          last_edited_at: string | null
          last_edited_by: string | null
          note: string | null
          original_staff_id: string | null
          role: string
          shift_end: string | null
          shift_start: string | null
          source: string
          staff_id: string
          status: string
          venue_id: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          date: string
          edit_count?: number
          id?: string
          is_removed?: boolean
          last_edited_at?: string | null
          last_edited_by?: string | null
          note?: string | null
          original_staff_id?: string | null
          role?: string
          shift_end?: string | null
          shift_start?: string | null
          source?: string
          staff_id: string
          status?: string
          venue_id: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          date?: string
          edit_count?: number
          id?: string
          is_removed?: boolean
          last_edited_at?: string | null
          last_edited_by?: string | null
          note?: string | null
          original_staff_id?: string | null
          role?: string
          shift_end?: string | null
          shift_start?: string | null
          source?: string
          staff_id?: string
          status?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_roster_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      flavours: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          packet_weight_grams: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          packet_weight_grams?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          packet_weight_grams?: number
          updated_at?: string
        }
        Relationships: []
      }
      global_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      hookah_pots: {
        Row: {
          created_at: string
          id: string
          total_pots: number
          updated_at: string
          venue_id: string
          working_pots: number
        }
        Insert: {
          created_at?: string
          id?: string
          total_pots?: number
          updated_at?: string
          venue_id: string
          working_pots?: number
        }
        Update: {
          created_at?: string
          id?: string
          total_pots?: number
          updated_at?: string
          venue_id?: string
          working_pots?: number
        }
        Relationships: [
          {
            foreignKeyName: "hookah_pots_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      incharge_daily_tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          deadline: string
          id: string
          status: string
          task_date: string
          task_type: string
          venue_id: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          deadline: string
          id?: string
          status?: string
          task_date: string
          task_type: string
          venue_id: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string
          id?: string
          status?: string
          task_date?: string
          task_type?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incharge_daily_tasks_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_stock_checks: {
        Row: {
          created_at: string
          flavour_id: string
          id: string
          inspection_id: string
          match: boolean | null
          measured_stock: number
          reported_stock: number
        }
        Insert: {
          created_at?: string
          flavour_id: string
          id?: string
          inspection_id: string
          match?: boolean | null
          measured_stock?: number
          reported_stock?: number
        }
        Update: {
          created_at?: string
          flavour_id?: string
          id?: string
          inspection_id?: string
          match?: boolean | null
          measured_stock?: number
          reported_stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "inspection_stock_checks_flavour_id_fkey"
            columns: ["flavour_id"]
            isOneToOne: false
            referencedRelation: "flavours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_stock_checks_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          billing_accuracy: boolean
          closing_procedure: boolean
          created_at: string
          customer_feedback: boolean
          date: string
          equipment_condition: boolean
          hookah_quality: boolean
          id: string
          inspector_id: string
          inventory_check: boolean
          music_ambience: boolean
          opening_procedure: boolean
          photo_url: string | null
          remarks: string | null
          safety_compliance: boolean
          score: number | null
          staff_behavior: boolean
          staff_grooming: boolean
          time: string
          venue_cleanliness: boolean
          venue_id: string
          violation_noted: boolean
        }
        Insert: {
          billing_accuracy?: boolean
          closing_procedure?: boolean
          created_at?: string
          customer_feedback?: boolean
          date: string
          equipment_condition?: boolean
          hookah_quality?: boolean
          id?: string
          inspector_id: string
          inventory_check?: boolean
          music_ambience?: boolean
          opening_procedure?: boolean
          photo_url?: string | null
          remarks?: string | null
          safety_compliance?: boolean
          score?: number | null
          staff_behavior?: boolean
          staff_grooming?: boolean
          time: string
          venue_cleanliness?: boolean
          venue_id: string
          violation_noted?: boolean
        }
        Update: {
          billing_accuracy?: boolean
          closing_procedure?: boolean
          created_at?: string
          customer_feedback?: boolean
          date?: string
          equipment_condition?: boolean
          hookah_quality?: boolean
          id?: string
          inspector_id?: string
          inventory_check?: boolean
          music_ambience?: boolean
          opening_procedure?: boolean
          photo_url?: string | null
          remarks?: string | null
          safety_compliance?: boolean
          score?: number | null
          staff_behavior?: boolean
          staff_grooming?: boolean
          time?: string
          venue_cleanliness?: boolean
          venue_id?: string
          violation_noted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "inspections_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      kot_entries: {
        Row: {
          created_at: string
          declaration_note: string | null
          declaration_reason: string | null
          entry_type: string
          id: string
          photo_url: string | null
          session_id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          declaration_note?: string | null
          declaration_reason?: string | null
          entry_type: string
          id?: string
          photo_url?: string | null
          session_id: string
          user_id: string
          venue_id: string
        }
        Update: {
          created_at?: string
          declaration_note?: string | null
          declaration_reason?: string | null
          entry_type?: string
          id?: string
          photo_url?: string | null
          session_id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kot_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "club_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kot_entries_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      packet_dispatches: {
        Row: {
          created_at: string
          date: string
          dispatched_by: string
          flavour_id: string
          id: string
          quantity_sent: number
          received_by_staff_id: string | null
          venue_id: string
        }
        Insert: {
          created_at?: string
          date: string
          dispatched_by: string
          flavour_id: string
          id?: string
          quantity_sent?: number
          received_by_staff_id?: string | null
          venue_id: string
        }
        Update: {
          created_at?: string
          date?: string
          dispatched_by?: string
          flavour_id?: string
          id?: string
          quantity_sent?: number
          received_by_staff_id?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packet_dispatches_flavour_id_fkey"
            columns: ["flavour_id"]
            isOneToOne: false
            referencedRelation: "flavours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packet_dispatches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      roster_assignments: {
        Row: {
          assigned_by: string
          created_at: string
          date: string
          id: string
          remarks: string | null
          shift_end: string | null
          shift_start: string | null
          staff_id: string
          status: string
          updated_at: string
          venue_id: string
          week_start_date: string | null
        }
        Insert: {
          assigned_by: string
          created_at?: string
          date: string
          id?: string
          remarks?: string | null
          shift_end?: string | null
          shift_start?: string | null
          staff_id: string
          status?: string
          updated_at?: string
          venue_id: string
          week_start_date?: string | null
        }
        Update: {
          assigned_by?: string
          created_at?: string
          date?: string
          id?: string
          remarks?: string | null
          shift_end?: string | null
          shift_start?: string | null
          staff_id?: string
          status?: string
          updated_at?: string
          venue_id?: string
          week_start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roster_assignments_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      roster_audit_log: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          id: string
          roster_date: string
          user_id: string | null
          venue_id: string
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          roster_date: string
          user_id?: string | null
          venue_id: string
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          id?: string
          roster_date?: string
          user_id?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_audit_log_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_reports: {
        Row: {
          category_id: string
          created_at: string
          id: string
          kot_photo_url: string | null
          quantity_sold: number
          report_date: string
          reported_by: string
          venue_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          kot_photo_url?: string | null
          quantity_sold: number
          report_date?: string
          reported_by: string
          venue_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          kot_photo_url?: string | null
          quantity_sold?: number
          report_date?: string
          reported_by?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_reports_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "venue_hookah_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_reports_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance_blocks: {
        Row: {
          check_in_lat: number
          check_in_lng: number
          check_in_selfie_url: string
          check_in_time: string
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_selfie_url: string | null
          check_out_time: string | null
          created_at: string
          duty_completed: boolean | null
          id: string
          is_break: boolean
          session_id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          check_in_lat: number
          check_in_lng: number
          check_in_selfie_url: string
          check_in_time?: string
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_selfie_url?: string | null
          check_out_time?: string | null
          created_at?: string
          duty_completed?: boolean | null
          id?: string
          is_break?: boolean
          session_id: string
          user_id: string
          venue_id: string
        }
        Update: {
          check_in_lat?: number
          check_in_lng?: number
          check_in_selfie_url?: string
          check_in_time?: string
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_selfie_url?: string | null
          check_out_time?: string | null
          created_at?: string
          duty_completed?: boolean | null
          id?: string
          is_break?: boolean
          session_id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_blocks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "club_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_blocks_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_breaks: {
        Row: {
          attendance_block_id: string
          break_end_time: string | null
          break_start_time: string
          created_at: string
          duration_minutes: number | null
          id: string
          session_id: string
          user_id: string
          venue_id: string
        }
        Insert: {
          attendance_block_id: string
          break_end_time?: string | null
          break_start_time?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          session_id: string
          user_id: string
          venue_id: string
        }
        Update: {
          attendance_block_id?: string
          break_end_time?: string | null
          break_start_time?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          session_id?: string
          user_id?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_breaks_attendance_block_id_fkey"
            columns: ["attendance_block_id"]
            isOneToOne: false
            referencedRelation: "staff_attendance_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_breaks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "club_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_breaks_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_training: {
        Row: {
          certified_by: string | null
          completed: boolean
          completed_date: string | null
          created_at: string
          id: string
          score: number | null
          staff_id: string
          training_type: string
          updated_at: string
        }
        Insert: {
          certified_by?: string | null
          completed?: boolean
          completed_date?: string | null
          created_at?: string
          id?: string
          score?: number | null
          staff_id: string
          training_type: string
          updated_at?: string
        }
        Update: {
          certified_by?: string | null
          completed?: boolean
          completed_date?: string | null
          created_at?: string
          id?: string
          score?: number | null
          staff_id?: string
          training_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_violations: {
        Row: {
          action_taken: string | null
          created_at: string
          date: string
          description: string | null
          id: string
          reported_by: string
          resolved: boolean
          severity: string
          staff_id: string
          type: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          date: string
          description?: string | null
          id?: string
          reported_by: string
          resolved?: boolean
          severity?: string
          staff_id: string
          type: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          reported_by?: string
          resolved?: boolean
          severity?: string
          staff_id?: string
          type?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_violations_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      stock: {
        Row: {
          category: Database["public"]["Enums"]["stock_category"]
          created_at: string
          id: string
          item_name: string
          low_stock_threshold: number
          quantity: number
          unit: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["stock_category"]
          created_at?: string
          id?: string
          item_name: string
          low_stock_threshold?: number
          quantity?: number
          unit?: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["stock_category"]
          created_at?: string
          id?: string
          item_name?: string
          low_stock_threshold?: number
          quantity?: number
          unit?: string
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_accessories: {
        Row: {
          checked_by: string | null
          condition: string
          created_at: string
          id: string
          item_type: string
          last_checked_date: string | null
          quantity: number
          remarks: string | null
          replacement_needed: boolean
          updated_at: string
          venue_id: string
        }
        Insert: {
          checked_by?: string | null
          condition?: string
          created_at?: string
          id?: string
          item_type: string
          last_checked_date?: string | null
          quantity?: number
          remarks?: string | null
          replacement_needed?: boolean
          updated_at?: string
          venue_id: string
        }
        Update: {
          checked_by?: string | null
          condition?: string
          created_at?: string
          id?: string
          item_type?: string
          last_checked_date?: string | null
          quantity?: number
          remarks?: string | null
          replacement_needed?: boolean
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_accessories_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_hookah_categories: {
        Row: {
          category_name: string
          created_at: string
          id: string
          is_packet_trackable: boolean
          updated_at: string
          venue_id: string
        }
        Insert: {
          category_name: string
          created_at?: string
          id?: string
          is_packet_trackable?: boolean
          updated_at?: string
          venue_id: string
        }
        Update: {
          category_name?: string
          created_at?: string
          id?: string
          is_packet_trackable?: boolean
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_hookah_categories_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_settings: {
        Row: {
          core_hours_end: number
          core_hours_start: number
          created_at: string
          force_close_hour: number
          id: string
          morning_cutoff_hour: number
          updated_at: string
          venue_id: string
        }
        Insert: {
          core_hours_end?: number
          core_hours_start?: number
          created_at?: string
          force_close_hour?: number
          id?: string
          morning_cutoff_hour?: number
          updated_at?: string
          venue_id: string
        }
        Update: {
          core_hours_end?: number
          core_hours_start?: number
          created_at?: string
          force_close_hour?: number
          id?: string
          morning_cutoff_hour?: number
          updated_at?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_settings_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: true
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_stock_daily: {
        Row: {
          closing_stock: number | null
          created_at: string
          date: string
          id: string
          min_stock_threshold: number
          opening_stock: number | null
          opening_stock_source: string
          packets_received: number
          packets_used: number
          updated_at: string
          updated_by: string | null
          venue_id: string
        }
        Insert: {
          closing_stock?: number | null
          created_at?: string
          date: string
          id?: string
          min_stock_threshold?: number
          opening_stock?: number | null
          opening_stock_source?: string
          packets_received?: number
          packets_used?: number
          updated_at?: string
          updated_by?: string | null
          venue_id: string
        }
        Update: {
          closing_stock?: number | null
          created_at?: string
          date?: string
          id?: string
          min_stock_threshold?: number
          opening_stock?: number | null
          opening_stock_source?: string
          packets_received?: number
          packets_used?: number
          updated_at?: string
          updated_by?: string | null
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_stock_daily_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          created_at: string
          id: string
          location: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_admin: { Args: never; Returns: boolean }
      get_user_venue: { Args: { user_id: string }; Returns: string }
      get_user_venues: { Args: { p_user_id: string }; Returns: string[] }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_club_incharge: { Args: { p_user_id: string }; Returns: boolean }
      is_club_management: { Args: { p_user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "employee" | "club_management" | "club_incharge"
      hookah_category: "premium" | "standard" | "budget"
      stock_category: "flavour" | "hookah_pots" | "accessories"
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
      app_role: ["admin", "employee", "club_management", "club_incharge"],
      hookah_category: ["premium", "standard", "budget"],
      stock_category: ["flavour", "hookah_pots", "accessories"],
    },
  },
} as const
