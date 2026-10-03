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
      bot_config: {
        Row: {
          admin_email: string | null
          admin_status: string
          created_at: string
          id: string
          resend_api_key: string | null
          sender_email: string | null
          system_prompt: string
          temperature: number
          updated_at: string
          whatsapp_country_code: string
          whatsapp_enabled: boolean
          whatsapp_number: string | null
          whatsapp_webhook_url: string | null
        }
        Insert: {
          admin_email?: string | null
          admin_status?: string
          created_at?: string
          id?: string
          resend_api_key?: string | null
          sender_email?: string | null
          system_prompt?: string
          temperature?: number
          updated_at?: string
          whatsapp_country_code?: string
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
          whatsapp_webhook_url?: string | null
        }
        Update: {
          admin_email?: string | null
          admin_status?: string
          created_at?: string
          id?: string
          resend_api_key?: string | null
          sender_email?: string | null
          system_prompt?: string
          temperature?: number
          updated_at?: string
          whatsapp_country_code?: string
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
          whatsapp_webhook_url?: string | null
        }
        Relationships: []
      }
      bot_knowledge: {
        Row: {
          bot_id: string
          created_at: string
          id: string
          raw_text: string
          source_type: string
          updated_at: string
        }
        Insert: {
          bot_id?: string
          created_at?: string
          id?: string
          raw_text: string
          source_type: string
          updated_at?: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          id?: string
          raw_text?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          access_token: string
          created_at: string
          handoff_queries: string | null
          handoff_submitted_at: string | null
          handoff_topic: string | null
          handoff_username: string | null
          id: string
          is_ai_enabled: boolean
          is_handoff_triggered: boolean
          last_message_at: string | null
          session_number: number
          status: string
          updated_at: string
          user_language: string | null
          whatsapp_routed: boolean
        }
        Insert: {
          access_token?: string
          created_at?: string
          handoff_queries?: string | null
          handoff_submitted_at?: string | null
          handoff_topic?: string | null
          handoff_username?: string | null
          id?: string
          is_ai_enabled?: boolean
          is_handoff_triggered?: boolean
          last_message_at?: string | null
          session_number?: number
          status?: string
          updated_at?: string
          user_language?: string | null
          whatsapp_routed?: boolean
        }
        Update: {
          access_token?: string
          created_at?: string
          handoff_queries?: string | null
          handoff_submitted_at?: string | null
          handoff_topic?: string | null
          handoff_username?: string | null
          id?: string
          is_ai_enabled?: boolean
          is_handoff_triggered?: boolean
          last_message_at?: string | null
          session_number?: number
          status?: string
          updated_at?: string
          user_language?: string | null
          whatsapp_routed?: boolean
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          bcc: string | null
          body: string
          cc: string | null
          created_at: string
          error: string | null
          from_email: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          sent_by: string | null
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          bcc?: string | null
          body: string
          cc?: string | null
          created_at?: string
          error?: string | null
          from_email?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          sent_by?: string | null
          status?: string
          subject: string
          to_email: string
        }
        Update: {
          bcc?: string | null
          body?: string
          cc?: string | null
          created_at?: string
          error?: string | null
          from_email?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          sent_by?: string | null
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: []
      }
      meetings: {
        Row: {
          company: string | null
          contact: string | null
          created_at: string
          date: string
          email: string | null
          id: string
          name: string
          services: string[]
          status: string
          time: string
        }
        Insert: {
          company?: string | null
          contact?: string | null
          created_at?: string
          date: string
          email?: string | null
          id?: string
          name: string
          services?: string[]
          status?: string
          time: string
        }
        Update: {
          company?: string | null
          contact?: string | null
          created_at?: string
          date?: string
          email?: string | null
          id?: string
          name?: string
          services?: string[]
          status?: string
          time?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          sender: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          sender: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          budget: string | null
          company: string | null
          contact: string | null
          created_at: string
          currency: string
          email: string | null
          id: string
          main_services: string[]
          name: string
          status: string
          sub_categories: string[]
        }
        Insert: {
          budget?: string | null
          company?: string | null
          contact?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          main_services?: string[]
          name: string
          status?: string
          sub_categories?: string[]
        }
        Update: {
          budget?: string | null
          company?: string | null
          contact?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          main_services?: string[]
          name?: string
          status?: string
          sub_categories?: string[]
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
      app_role: "admin" | "staff"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "staff"],
    },
  },
} as const
