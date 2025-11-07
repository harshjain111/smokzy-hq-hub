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
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sales_reports: {
        Row: {
          created_at: string
          hookah_category: Database["public"]["Enums"]["hookah_category"]
          id: string
          quantity_sold: number
          report_date: string
          reported_by: string
          venue_id: string
        }
        Insert: {
          created_at?: string
          hookah_category: Database["public"]["Enums"]["hookah_category"]
          id?: string
          quantity_sold: number
          report_date?: string
          reported_by: string
          venue_id: string
        }
        Update: {
          created_at?: string
          hookah_category?: Database["public"]["Enums"]["hookah_category"]
          id?: string
          quantity_sold?: number
          report_date?: string
          reported_by?: string
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_reports_venue_id_fkey"
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
      venue_hookah_categories: {
        Row: {
          category_name: string
          created_at: string
          id: string
          updated_at: string
          venue_id: string
        }
        Insert: {
          category_name: string
          created_at?: string
          id?: string
          updated_at?: string
          venue_id: string
        }
        Update: {
          category_name?: string
          created_at?: string
          id?: string
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
      is_admin: { Args: { user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "employee"
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
      app_role: ["admin", "employee"],
      hookah_category: ["premium", "standard", "budget"],
      stock_category: ["flavour", "hookah_pots", "accessories"],
    },
  },
} as const
