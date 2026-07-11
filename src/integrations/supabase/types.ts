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
      chef_notifications: {
        Row: {
          chef_id: string
          created_at: string
          driver_id: string
          event_id: string | null
          id: string
          is_read: boolean | null
          message: string
          notification_type: string
          title: string
          vehicle_id: string
        }
        Insert: {
          chef_id: string
          created_at?: string
          driver_id: string
          event_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          notification_type: string
          title: string
          vehicle_id: string
        }
        Update: {
          chef_id?: string
          created_at?: string
          driver_id?: string
          event_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          notification_type?: string
          title?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chef_notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "driver_events"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_events: {
        Row: {
          created_at: string
          description: string | null
          driver_id: string
          duration_seconds: number | null
          event_type: string
          id: string
          lat: number | null
          lng: number | null
          notified: boolean | null
          recorded_at: string
          severity: string
          speed_after: number | null
          speed_before: number | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          driver_id?: string
          duration_seconds?: number | null
          event_type: string
          id?: string
          lat?: number | null
          lng?: number | null
          notified?: boolean | null
          recorded_at?: string
          severity?: string
          speed_after?: number | null
          speed_before?: number | null
          vehicle_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          driver_id?: string
          duration_seconds?: number | null
          event_type?: string
          id?: string
          lat?: number | null
          lng?: number | null
          notified?: boolean | null
          recorded_at?: string
          severity?: string
          speed_after?: number | null
          speed_before?: number | null
          vehicle_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_trips: {
        Row: {
          created_at: string
          distance_km: number
          driven_distance_km: number | null
          driven_time_seconds: number | null
          end_name: string
          gps_points: Json | null
          id: string
          route: Json
          route_type: string
          start_name: string
          timeline: Json
          total_weight_kg: number
          travel_time_seconds: number
          trip_source: string
          user_id: string
          vehicle_id: string
          vehicle_label: string
          waypoint_names: Json
        }
        Insert: {
          created_at?: string
          distance_km: number
          driven_distance_km?: number | null
          driven_time_seconds?: number | null
          end_name: string
          gps_points?: Json | null
          id?: string
          route?: Json
          route_type?: string
          start_name: string
          timeline?: Json
          total_weight_kg?: number
          travel_time_seconds: number
          trip_source?: string
          user_id?: string
          vehicle_id?: string
          vehicle_label?: string
          waypoint_names?: Json
        }
        Update: {
          created_at?: string
          distance_km?: number
          driven_distance_km?: number | null
          driven_time_seconds?: number | null
          end_name?: string
          gps_points?: Json | null
          id?: string
          route?: Json
          route_type?: string
          start_name?: string
          timeline?: Json
          total_weight_kg?: number
          travel_time_seconds?: number
          trip_source?: string
          user_id?: string
          vehicle_id?: string
          vehicle_label?: string
          waypoint_names?: Json
        }
        Relationships: []
      }
      search_history: {
        Row: {
          address: string
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          search_count: number
          user_id: string
        }
        Insert: {
          address?: string
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          search_count?: number
          user_id?: string
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          search_count?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_positions: {
        Row: {
          accuracy_m: number | null
          created_at: string
          driver_id: string
          heading: number | null
          id: string
          lat: number
          lng: number
          recorded_at: string
          speed_kmh: number | null
          vehicle_id: string
        }
        Insert: {
          accuracy_m?: number | null
          created_at?: string
          driver_id?: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          speed_kmh?: number | null
          vehicle_id: string
        }
        Update: {
          accuracy_m?: number | null
          created_at?: string
          driver_id?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          speed_kmh?: number | null
          vehicle_id?: string
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
      app_role: "chef" | "chauffeur"
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
      app_role: ["chef", "chauffeur"],
    },
  },
} as const
