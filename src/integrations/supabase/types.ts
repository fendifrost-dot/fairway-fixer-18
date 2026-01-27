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
      actions: {
        Row: {
          action_date: string
          action_type: string
          attachment_url: string | null
          created_at: string
          created_by: string | null
          date_confidence: Database["public"]["Enums"]["date_confidence"]
          delivered_date: string | null
          entity_case_id: string | null
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          id: string
          matter_id: string
          summary: string | null
        }
        Insert: {
          action_date?: string
          action_type: string
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          date_confidence?: Database["public"]["Enums"]["date_confidence"]
          delivered_date?: string | null
          entity_case_id?: string | null
          evidence_type?: Database["public"]["Enums"]["evidence_type"]
          id?: string
          matter_id: string
          summary?: string | null
        }
        Update: {
          action_date?: string
          action_type?: string
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          date_confidence?: Database["public"]["Enums"]["date_confidence"]
          delivered_date?: string | null
          entity_case_id?: string | null
          evidence_type?: Database["public"]["Enums"]["evidence_type"]
          id?: string
          matter_id?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actions_entity_case_id_fkey"
            columns: ["entity_case_id"]
            isOneToOne: false
            referencedRelation: "entity_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          legal_name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          preferred_name: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          legal_name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          preferred_name?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          legal_name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          preferred_name?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Relationships: []
      }
      deadlines: {
        Row: {
          created_at: string
          deadline_type: Database["public"]["Enums"]["deadline_type"]
          due_date: string
          entity_case_id: string
          id: string
          matter_id: string
          source_action_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["deadline_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deadline_type: Database["public"]["Enums"]["deadline_type"]
          due_date: string
          entity_case_id: string
          id?: string
          matter_id: string
          source_action_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["deadline_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deadline_type?: Database["public"]["Enums"]["deadline_type"]
          due_date?: string
          entity_case_id?: string
          id?: string
          matter_id?: string
          source_action_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["deadline_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadlines_entity_case_id_fkey"
            columns: ["entity_case_id"]
            isOneToOne: false
            referencedRelation: "entity_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deadlines_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_cases: {
        Row: {
          created_at: string
          entity_name: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: string
          last_action_at: string | null
          matter_id: string
          notes: string | null
          state: Database["public"]["Enums"]["matter_state"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_name: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: string
          last_action_at?: string | null
          matter_id: string
          notes?: string | null
          state?: Database["public"]["Enums"]["matter_state"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_name?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: string
          last_action_at?: string | null
          matter_id?: string
          notes?: string | null
          state?: Database["public"]["Enums"]["matter_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_cases_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      matters: {
        Row: {
          client_id: string
          closed_at: string | null
          created_at: string
          escalation_strategy: string | null
          id: string
          intake_created_at: string | null
          intake_raw_text: string | null
          intake_source: string | null
          jurisdiction: string | null
          matter_type: Database["public"]["Enums"]["matter_type"]
          opened_at: string
          overall_reliability_rating: number | null
          primary_state: Database["public"]["Enums"]["matter_state"]
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          closed_at?: string | null
          created_at?: string
          escalation_strategy?: string | null
          id?: string
          intake_created_at?: string | null
          intake_raw_text?: string | null
          intake_source?: string | null
          jurisdiction?: string | null
          matter_type?: Database["public"]["Enums"]["matter_type"]
          opened_at?: string
          overall_reliability_rating?: number | null
          primary_state?: Database["public"]["Enums"]["matter_state"]
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          closed_at?: string | null
          created_at?: string
          escalation_strategy?: string | null
          id?: string
          intake_created_at?: string | null
          intake_raw_text?: string | null
          intake_source?: string | null
          jurisdiction?: string | null
          matter_type?: Database["public"]["Enums"]["matter_type"]
          opened_at?: string
          overall_reliability_rating?: number | null
          primary_state?: Database["public"]["Enums"]["matter_state"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matters_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      overlays: {
        Row: {
          activated_at: string
          created_at: string
          deactivated_at: string | null
          id: string
          is_active: boolean
          matter_id: string
          overlay_type: Database["public"]["Enums"]["overlay_type"]
        }
        Insert: {
          activated_at?: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          matter_id: string
          overlay_type: Database["public"]["Enums"]["overlay_type"]
        }
        Update: {
          activated_at?: string
          created_at?: string
          deactivated_at?: string | null
          id?: string
          is_active?: boolean
          matter_id?: string
          overlay_type?: Database["public"]["Enums"]["overlay_type"]
        }
        Relationships: [
          {
            foreignKeyName: "overlays_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      responses: {
        Row: {
          attachment_url: string | null
          created_at: string
          created_by: string | null
          entity_case_id: string
          id: string
          matter_id: string
          received_date: string
          response_type: Database["public"]["Enums"]["response_type"]
          summary: string | null
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          entity_case_id: string
          id?: string
          matter_id: string
          received_date?: string
          response_type: Database["public"]["Enums"]["response_type"]
          summary?: string | null
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          created_by?: string | null
          entity_case_id?: string
          id?: string
          matter_id?: string
          received_date?: string
          response_type?: Database["public"]["Enums"]["response_type"]
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "responses_entity_case_id_fkey"
            columns: ["entity_case_id"]
            isOneToOne: false
            referencedRelation: "entity_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responses_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_views: {
        Row: {
          created_at: string
          filters: Json
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          auto_generated: boolean
          completed_at: string | null
          completion_notes: string | null
          created_at: string
          due_date: string | null
          entity_case_id: string | null
          id: string
          matter_id: string
          priority: Database["public"]["Enums"]["task_priority"]
          related_account_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_type: string
          updated_at: string
        }
        Insert: {
          auto_generated?: boolean
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          due_date?: string | null
          entity_case_id?: string | null
          id?: string
          matter_id: string
          priority?: Database["public"]["Enums"]["task_priority"]
          related_account_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type: string
          updated_at?: string
        }
        Update: {
          auto_generated?: boolean
          completed_at?: string | null
          completion_notes?: string | null
          created_at?: string
          due_date?: string | null
          entity_case_id?: string | null
          id?: string
          matter_id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          related_account_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_entity_case_id_fkey"
            columns: ["entity_case_id"]
            isOneToOne: false
            referencedRelation: "entity_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
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
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      violations: {
        Row: {
          created_at: string
          entity_case_id: string
          evidence_attached: boolean
          id: string
          matter_id: string
          notes: string | null
          severity: number
          statutory_section: string
          trigger: Database["public"]["Enums"]["violation_trigger"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_case_id: string
          evidence_attached?: boolean
          id?: string
          matter_id: string
          notes?: string | null
          severity: number
          statutory_section: string
          trigger: Database["public"]["Enums"]["violation_trigger"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_case_id?: string
          evidence_attached?: boolean
          id?: string
          matter_id?: string
          notes?: string | null
          severity?: number
          statutory_section?: string
          trigger?: Database["public"]["Enums"]["violation_trigger"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "violations_entity_case_id_fkey"
            columns: ["entity_case_id"]
            isOneToOne: false
            referencedRelation: "entity_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violations_matter_id_fkey"
            columns: ["matter_id"]
            isOneToOne: false
            referencedRelation: "matters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_entity_case: {
        Args: { _entity_case_id: string }
        Returns: boolean
      }
      can_access_matter: { Args: { _matter_id: string }; Returns: boolean }
      create_client_and_matter: {
        Args: {
          _client_notes?: string
          _intake_raw_text: string
          _intake_source: string
          _legal_name: string
          _matter_type: Database["public"]["Enums"]["matter_type"]
        }
        Returns: {
          client_id: string
          matter_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_owner_of_client: { Args: { _client_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "staff"
      client_status: "Active" | "Inactive" | "Pending"
      date_confidence: "Exact" | "Inferred" | "Unknown"
      deadline_status: "Open" | "DueSoon" | "Overdue" | "Closed"
      deadline_type:
        | "611_30day"
        | "611_notice"
        | "605B_4biz"
        | "Reinsertion_5biz"
        | "CFPB_15"
        | "CFPB_60"
        | "FollowUp"
      entity_type: "CRA" | "Furnisher" | "DataBroker" | "Agency"
      evidence_type:
        | "Report"
        | "Portal"
        | "Mail"
        | "ClientStatement"
        | "Unknown"
      matter_state:
        | "Intake"
        | "DisputePreparation"
        | "DisputeActive"
        | "PartialCompliance"
        | "ViolationConfirmed"
        | "ReinsertionDetected"
        | "RegulatoryReview"
        | "Blocked"
        | "FurnisherLiabilityTrack"
        | "EscalationEligible"
        | "LitigationReady"
        | "Resolved"
      matter_type: "Credit" | "Consulting" | "Both"
      overlay_type:
        | "IdentityTheftDocumented"
        | "MixedFileConfirmed"
        | "UpstreamContainmentActive"
      response_type:
        | "NoResponse"
        | "Boilerplate"
        | "Verified"
        | "Deleted"
        | "PartialDeleted"
        | "Reinserted"
        | "MOVProvided"
        | "AuthBlocked"
        | "Other"
      task_priority: "P0" | "P1" | "P2" | "P3"
      task_status: "Pending" | "InProgress" | "Done" | "Blocked"
      violation_trigger:
        | "Missed611Deadline"
        | "Reinsertion611a5B"
        | "Failure605B"
        | "NoMOV"
        | "Boilerplate"
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
      app_role: ["admin", "staff"],
      client_status: ["Active", "Inactive", "Pending"],
      date_confidence: ["Exact", "Inferred", "Unknown"],
      deadline_status: ["Open", "DueSoon", "Overdue", "Closed"],
      deadline_type: [
        "611_30day",
        "611_notice",
        "605B_4biz",
        "Reinsertion_5biz",
        "CFPB_15",
        "CFPB_60",
        "FollowUp",
      ],
      entity_type: ["CRA", "Furnisher", "DataBroker", "Agency"],
      evidence_type: ["Report", "Portal", "Mail", "ClientStatement", "Unknown"],
      matter_state: [
        "Intake",
        "DisputePreparation",
        "DisputeActive",
        "PartialCompliance",
        "ViolationConfirmed",
        "ReinsertionDetected",
        "RegulatoryReview",
        "Blocked",
        "FurnisherLiabilityTrack",
        "EscalationEligible",
        "LitigationReady",
        "Resolved",
      ],
      matter_type: ["Credit", "Consulting", "Both"],
      overlay_type: [
        "IdentityTheftDocumented",
        "MixedFileConfirmed",
        "UpstreamContainmentActive",
      ],
      response_type: [
        "NoResponse",
        "Boilerplate",
        "Verified",
        "Deleted",
        "PartialDeleted",
        "Reinserted",
        "MOVProvided",
        "AuthBlocked",
        "Other",
      ],
      task_priority: ["P0", "P1", "P2", "P3"],
      task_status: ["Pending", "InProgress", "Done", "Blocked"],
      violation_trigger: [
        "Missed611Deadline",
        "Reinsertion611a5B",
        "Failure605B",
        "NoMOV",
        "Boilerplate",
      ],
    },
  },
} as const
