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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_analysis_runs: {
        Row: {
          cost_usd: number
          created_at: string
          dossier_id: string
          id: string
          input_tokens: number
          kind: string
          lines_analyzed: number
          model: string
          output_tokens: number
          user_id: string
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          dossier_id: string
          id?: string
          input_tokens?: number
          kind?: string
          lines_analyzed: number
          model: string
          output_tokens?: number
          user_id?: string
        }
        Update: {
          cost_usd?: number
          created_at?: string
          dossier_id?: string
          id?: string
          input_tokens?: number
          kind?: string
          lines_analyzed?: number
          model?: string
          output_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_analysis_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_settings: {
        Row: {
          id: number
          monthly_cap_usd: number
          updated_at: string
        }
        Insert: {
          id?: number
          monthly_cap_usd?: number
          updated_at?: string
        }
        Update: {
          id?: number
          monthly_cap_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_suggestions: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          dossier_id: string
          id: string
          kind: string
          reason: string
          run_id: string
          state: string
          target_supplier: string | null
          transaction_ids: string[]
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          dossier_id: string
          id?: string
          kind: string
          reason: string
          run_id: string
          state?: string
          target_supplier?: string | null
          transaction_ids: string[]
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          dossier_id?: string
          id?: string
          kind?: string
          reason?: string
          run_id?: string
          state?: string
          target_supplier?: string | null
          transaction_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "ai_suggestions_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_suggestions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      cabinet_chat_messages: {
        Row: {
          content: string
          created_at: string
          dossier_id: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          dossier_id?: string | null
          id?: string
          role: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          dossier_id?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cabinet_chat_messages_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      cabinet_questions: {
        Row: {
          context: string | null
          created_at: string
          dossier_id: string
          handled: boolean
          id: string
          question: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          dossier_id: string
          handled?: boolean
          id?: string
          question: string
          user_email?: string | null
          user_id?: string
        }
        Update: {
          context?: string | null
          created_at?: string
          dossier_id?: string
          handled?: boolean
          id?: string
          question?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cabinet_questions_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      cabinet_settings: {
        Row: {
          email: string | null
          id: number
          logo_path: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          email?: string | null
          id?: number
          logo_path?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          email?: string | null
          id?: number
          logo_path?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          dossier_id: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          dossier_id: string
          id?: string
          role: string
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          dossier_id?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      dossier_members: {
        Row: {
          created_at: string
          dossier_id: string
          email: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dossier_id: string
          email: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dossier_id?: string
          email?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossier_members_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      dossiers: {
        Row: {
          collect_email: string | null
          collect_email_customers: string | null
          company_id: string
          created_at: string
          detect_prefixes: string
          id: string
          last_mcp_error: string | null
          last_sync_at: string | null
          last_sync_error: string | null
          last_sync_source: string | null
          name: string
        }
        Insert: {
          collect_email?: string | null
          collect_email_customers?: string | null
          company_id: string
          created_at?: string
          detect_prefixes?: string
          id?: string
          last_mcp_error?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_source?: string | null
          name: string
        }
        Update: {
          collect_email?: string | null
          collect_email_customers?: string | null
          company_id?: string
          created_at?: string
          detect_prefixes?: string
          id?: string
          last_mcp_error?: string | null
          last_sync_at?: string | null
          last_sync_error?: string | null
          last_sync_source?: string | null
          name?: string
        }
        Relationships: []
      }
      mcp_connection: {
        Row: {
          expires_at: string | null
          id: number
          last_error: string | null
          secret_blob: string | null
          status: string
          updated_at: string
        }
        Insert: {
          expires_at?: string | null
          id?: number
          last_error?: string | null
          secret_blob?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          expires_at?: string | null
          id?: number
          last_error?: string | null
          secret_blob?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      mcp_oauth_states: {
        Row: {
          created_at: string
          created_by: string
          secret_blob: string
          state: string
        }
        Insert: {
          created_at?: string
          created_by: string
          secret_blob: string
          state: string
        }
        Update: {
          created_at?: string
          created_by?: string
          secret_blob?: string
          state?: string
        }
        Relationships: []
      }
      regles_fournisseur: {
        Row: {
          cle: string
          compte: string
          compte_libelle: string
          dossier_id: string
          id: string
          tiers: string
          updated_at: string
        }
        Insert: {
          cle: string
          compte: string
          compte_libelle?: string
          dossier_id: string
          id?: string
          tiers: string
          updated_at?: string
        }
        Update: {
          cle?: string
          compte?: string
          compte_libelle?: string
          dossier_id?: string
          id?: string
          tiers?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regles_fournisseur_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      saisies: {
        Row: {
          cost_usd: number
          created_at: string
          date_facture: string | null
          decided_at: string | null
          decided_by: string | null
          dossier_id: string
          envoye_le: string | null
          envoye_par: string | null
          fournisseur: string
          id: string
          lecture: Json | null
          libelle_ecriture: string | null
          lignes: Json
          lu_le: string
          lu_par: string | null
          model: string | null
          numero: string | null
          pennylane_invoice_id: string | null
          state: string
          tiers: string
          total_ht: number
          total_ttc: number
          total_tva: number
          transaction_id: string
          upload_id: string
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          date_facture?: string | null
          decided_at?: string | null
          decided_by?: string | null
          dossier_id: string
          envoye_le?: string | null
          envoye_par?: string | null
          fournisseur: string
          id?: string
          lecture?: Json | null
          libelle_ecriture?: string | null
          lignes?: Json
          lu_le?: string
          lu_par?: string | null
          model?: string | null
          numero?: string | null
          pennylane_invoice_id?: string | null
          state?: string
          tiers: string
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          transaction_id: string
          upload_id: string
        }
        Update: {
          cost_usd?: number
          created_at?: string
          date_facture?: string | null
          decided_at?: string | null
          decided_by?: string | null
          dossier_id?: string
          envoye_le?: string | null
          envoye_par?: string | null
          fournisseur?: string
          id?: string
          lecture?: Json | null
          libelle_ecriture?: string | null
          lignes?: Json
          lu_le?: string
          lu_par?: string | null
          model?: string | null
          numero?: string | null
          pennylane_invoice_id?: string | null
          state?: string
          tiers?: string
          total_ht?: number
          total_ttc?: number
          total_tva?: number
          transaction_id?: string
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saisies_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saisies_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saisies_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: true
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      skip_rules: {
        Row: {
          created_at: string
          created_by: string | null
          direction: string | null
          dossier_id: string
          id: string
          kind: string
          pattern: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          direction?: string | null
          dossier_id: string
          id?: string
          kind: string
          pattern: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          direction?: string | null
          dossier_id?: string
          id?: string
          kind?: string
          pattern?: string
        }
        Relationships: [
          {
            foreignKeyName: "skip_rules_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_aliases: {
        Row: {
          detected_name: string
          display_name: string
          dossier_id: string
          id: string
        }
        Insert: {
          detected_name: string
          display_name: string
          dossier_id: string
          id?: string
        }
        Update: {
          detected_name?: string
          display_name?: string
          dossier_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_aliases_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          ai_analyzed_at: string | null
          amount: number
          comment: string | null
          counterpart_accounts: string | null
          created_at: string
          date: string
          direction: string
          dossier_id: string
          id: string
          is_open: boolean
          label: string
          pennylane_id: string
          review_state: string
          skip_rule_id: string | null
          status: Database["public"]["Enums"]["tx_status"]
          supplier: string
          supplier_detected: string
          updated_at: string
        }
        Insert: {
          ai_analyzed_at?: string | null
          amount: number
          comment?: string | null
          counterpart_accounts?: string | null
          created_at?: string
          date: string
          direction?: string
          dossier_id: string
          id?: string
          is_open?: boolean
          label: string
          pennylane_id: string
          review_state?: string
          skip_rule_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          supplier: string
          supplier_detected: string
          updated_at?: string
        }
        Update: {
          ai_analyzed_at?: string | null
          amount?: number
          comment?: string | null
          counterpart_accounts?: string | null
          created_at?: string
          date?: string
          direction?: string
          dossier_id?: string
          id?: string
          is_open?: boolean
          label?: string
          pennylane_id?: string
          review_state?: string
          skip_rule_id?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          supplier?: string
          supplier_detected?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_skip_rule_id_fkey"
            columns: ["skip_rule_id"]
            isOneToOne: false
            referencedRelation: "skip_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          created_at: string
          dossier_id: string
          file_name: string
          id: string
          storage_path: string
          transaction_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          dossier_id: string
          file_name: string
          id?: string
          storage_path: string
          transaction_id: string
          uploaded_by?: string
        }
        Update: {
          created_at?: string
          dossier_id?: string
          file_name?: string
          id?: string
          storage_path?: string
          transaction_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploads_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploads_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      is_member: { Args: { _dossier_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "cabinet" | "client"
      tx_status: "a_faire" | "depose" | "email" | "sans_facture"
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
      app_role: ["cabinet", "client"],
      tx_status: ["a_faire", "depose", "email", "sans_facture"],
    },
  },
} as const
