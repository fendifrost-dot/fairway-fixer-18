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
      baseline_analyses: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          original_text: string
          source_type: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          original_text: string
          source_type: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          original_text?: string
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "baseline_analyses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      baseline_targets: {
        Row: {
          baseline_id: string
          bureau: Database["public"]["Enums"]["baseline_bureau"]
          created_at: string
          fingerprint: string
          id: string
          item_type: string
          label: string
          raw_fields: Json
          status: Database["public"]["Enums"]["baseline_target_status"]
          updated_at: string
        }
        Insert: {
          baseline_id: string
          bureau: Database["public"]["Enums"]["baseline_bureau"]
          created_at?: string
          fingerprint: string
          id?: string
          item_type: string
          label: string
          raw_fields?: Json
          status?: Database["public"]["Enums"]["baseline_target_status"]
          updated_at?: string
        }
        Update: {
          baseline_id?: string
          bureau?: Database["public"]["Enums"]["baseline_bureau"]
          created_at?: string
          fingerprint?: string
          id?: string
          item_type?: string
          label?: string
          raw_fields?: Json
          status?: Database["public"]["Enums"]["baseline_target_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "baseline_targets_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "baseline_analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      case_actions: {
        Row: {
          case_id: string
          category: Database["public"]["Enums"]["action_category"]
          created_at: string
          details: string | null
          due_date: string | null
          event_date: string
          id: string
          priority: Database["public"]["Enums"]["action_priority"] | null
          related_account: string | null
          related_account_masked: string | null
          related_entity: string | null
          status: Database["public"]["Enums"]["action_status"]
          title: string
          updated_at: string
        }
        Insert: {
          case_id: string
          category: Database["public"]["Enums"]["action_category"]
          created_at?: string
          details?: string | null
          due_date?: string | null
          event_date?: string
          id?: string
          priority?: Database["public"]["Enums"]["action_priority"] | null
          related_account?: string | null
          related_account_masked?: string | null
          related_entity?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          title: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          category?: Database["public"]["Enums"]["action_category"]
          created_at?: string
          details?: string | null
          due_date?: string | null
          event_date?: string
          id?: string
          priority?: Database["public"]["Enums"]["action_priority"] | null
          related_account?: string | null
          related_account_masked?: string | null
          related_entity?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_accounts: {
        Row: {
          account_number: string | null
          account_type: string | null
          balance: number | null
          bureau: string | null
          client_id: string
          created_at: string | null
          credit_limit: number | null
          creditor_name: string
          date_opened: string | null
          dispute_date: string | null
          dispute_reason: string | null
          dispute_result: string | null
          dispute_status: string | null
          id: string
          is_negative: boolean | null
          notes: string | null
          payment_status: string | null
          reported_date: string | null
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          balance?: number | null
          bureau?: string | null
          client_id: string
          created_at?: string | null
          credit_limit?: number | null
          creditor_name: string
          date_opened?: string | null
          dispute_date?: string | null
          dispute_reason?: string | null
          dispute_result?: string | null
          dispute_status?: string | null
          id?: string
          is_negative?: boolean | null
          notes?: string | null
          payment_status?: string | null
          reported_date?: string | null
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          balance?: number | null
          bureau?: string | null
          client_id?: string
          created_at?: string | null
          credit_limit?: number | null
          creditor_name?: string
          date_opened?: string | null
          dispute_date?: string | null
          dispute_reason?: string | null
          dispute_result?: string | null
          dispute_status?: string | null
          id?: string
          is_negative?: boolean | null
          notes?: string | null
          payment_status?: string | null
          reported_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_accounts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active_disputes: number | null
          address_line1: string | null
          address_line2: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          dispute_count: number | null
          email: string | null
          equifax_score: number | null
          experian_score: number | null
          id: string
          intake_date: string | null
          last_report_date: string | null
          legal_name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          preferred_name: string | null
          scores_updated_at: string | null
          ssn_last4: string | null
          state: string | null
          status: Database["public"]["Enums"]["client_status"]
          transunion_score: number | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          active_disputes?: number | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          dispute_count?: number | null
          email?: string | null
          equifax_score?: number | null
          experian_score?: number | null
          id?: string
          intake_date?: string | null
          last_report_date?: string | null
          legal_name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          preferred_name?: string | null
          scores_updated_at?: string | null
          ssn_last4?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          transunion_score?: number | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          active_disputes?: number | null
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          dispute_count?: number | null
          email?: string | null
          equifax_score?: number | null
          experian_score?: number | null
          id?: string
          intake_date?: string | null
          last_report_date?: string | null
          legal_name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          preferred_name?: string | null
          scores_updated_at?: string | null
          ssn_last4?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          transunion_score?: number | null
          updated_at?: string
          zip_code?: string | null
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
      deletion_audit_log: {
        Row: {
          deleted_at: string
          deleted_by_user_id: string
          deleted_client_id: string
          deletion_mode: string
          event_count: number
          export_created: boolean
          id: string
          matter_count: number
          reason: string | null
        }
        Insert: {
          deleted_at?: string
          deleted_by_user_id: string
          deleted_client_id: string
          deletion_mode?: string
          event_count?: number
          export_created?: boolean
          id?: string
          matter_count?: number
          reason?: string | null
        }
        Update: {
          deleted_at?: string
          deleted_by_user_id?: string
          deleted_client_id?: string
          deletion_mode?: string
          event_count?: number
          export_created?: boolean
          id?: string
          matter_count?: number
          reason?: string | null
        }
        Relationships: []
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
          owner_id: string
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
          owner_id?: string
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
          owner_id?: string
          primary_state?: Database["public"]["Enums"]["matter_state"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      operator_tasks: {
        Row: {
          client_id: string
          created_at: string
          due_date: string | null
          due_time: string | null
          id: string
          linked_event_ids: string[]
          notes: string | null
          priority: Database["public"]["Enums"]["simple_priority"]
          recurrence_rule: string | null
          status: Database["public"]["Enums"]["simple_status"]
          title: string
        }
        Insert: {
          client_id: string
          created_at?: string
          due_date?: string | null
          due_time?: string | null
          id?: string
          linked_event_ids?: string[]
          notes?: string | null
          priority?: Database["public"]["Enums"]["simple_priority"]
          recurrence_rule?: string | null
          status?: Database["public"]["Enums"]["simple_status"]
          title: string
        }
        Update: {
          client_id?: string
          created_at?: string
          due_date?: string | null
          due_time?: string | null
          id?: string
          linked_event_ids?: string[]
          notes?: string | null
          priority?: Database["public"]["Enums"]["simple_priority"]
          recurrence_rule?: string | null
          status?: Database["public"]["Enums"]["simple_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_tasks_client_id_fkey"
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
      source_corrections: {
        Row: {
          corrected_at: string
          corrected_by: string
          event_id: string
          from_source: string
          id: string
          notes: string | null
          to_source: string
        }
        Insert: {
          corrected_at?: string
          corrected_by: string
          event_id: string
          from_source: string
          id?: string
          notes?: string | null
          to_source: string
        }
        Update: {
          corrected_at?: string
          corrected_by?: string
          event_id?: string
          from_source?: string
          id?: string
          notes?: string | null
          to_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_corrections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
        ]
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
      timeline_events: {
        Row: {
          category: Database["public"]["Enums"]["event_category"]
          client_id: string
          created_at: string
          date_is_unknown: boolean
          details: string | null
          event_date: string | null
          event_kind: string
          id: string
          is_draft: boolean
          raw_line: string
          related_accounts: Json | null
          source: Database["public"]["Enums"]["event_source"] | null
          summary: string
          title: string
        }
        Insert: {
          category: Database["public"]["Enums"]["event_category"]
          client_id: string
          created_at?: string
          date_is_unknown?: boolean
          details?: string | null
          event_date?: string | null
          event_kind?: string
          id?: string
          is_draft?: boolean
          raw_line?: string
          related_accounts?: Json | null
          source?: Database["public"]["Enums"]["event_source"] | null
          summary: string
          title: string
        }
        Update: {
          category?: Database["public"]["Enums"]["event_category"]
          client_id?: string
          created_at?: string
          date_is_unknown?: boolean
          details?: string | null
          event_date?: string | null
          event_kind?: string
          id?: string
          is_draft?: boolean
          raw_line?: string
          related_accounts?: Json | null
          source?: Database["public"]["Enums"]["event_source"] | null
          summary?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      __snapshot_matters_rls: { Args: never; Returns: Json }
      can_access_case: { Args: { _case_id: string }; Returns: boolean }
      can_access_client: { Args: { _client_id: string }; Returns: boolean }
      can_access_entity_case: {
        Args: { _entity_case_id: string }
        Returns: boolean
      }
      can_access_matter: { Args: { _matter_id: string }; Returns: boolean }
      client_exists: { Args: { _id: string }; Returns: boolean }
      commit_baseline: {
        Args: {
          _client_id: string
          _original_text: string
          _source_type: string
          _targets: Json
        }
        Returns: Json
      }
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
      debug_create_client_and_matter: {
        Args: {
          _client_notes?: string
          _intake_raw_text: string
          _intake_source: string
          _legal_name: string
          _matter_type: Database["public"]["Enums"]["matter_type"]
        }
        Returns: Json
      }
      delete_client_cascade: {
        Args: {
          _client_id: string
          _elevated_confirm?: boolean
          _export_created?: boolean
          _reason?: string
        }
        Returns: Json
      }
      diagnose_matters_insert: { Args: { p_client_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_owner_of_client: { Args: { _client_id: string }; Returns: boolean }
      probe_matters_insert: { Args: { p_client_id: string }; Returns: Json }
      probe_matters_ownerid_variants: {
        Args: { p_client_id: string }
        Returns: Json
      }
      prove_request_claims: { Args: never; Returns: Json }
      test_matters_insert_rls: {
        Args: never
        Returns: {
          auth_role_value: string
          auth_uid_value: string
          step: string
        }[]
      }
      whoami: {
        Args: never
        Returns: {
          db_user: string
          jwt: Json
          role: string
          uid: string
        }[]
      }
    }
    Enums: {
      action_category: "Completed" | "Response" | "ToDo"
      action_priority: "Low" | "Medium" | "High"
      action_status: "Done" | "Open"
      app_role: "admin" | "staff"
      baseline_bureau: "Experian" | "TransUnion" | "Equifax"
      baseline_target_status: "pending" | "still_present" | "not_found"
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
      event_category: "Action" | "Response" | "Outcome" | "Note"
      event_source:
        | "Experian"
        | "TransUnion"
        | "Equifax"
        | "LexisNexis"
        | "CoreLogic"
        | "Innovis"
        | "Sagestream"
        | "ChexSystems"
        | "EWS"
        | "NCTUE"
        | "CFPB"
        | "BBB"
        | "AG"
        | "Other"
        | "FTC"
        | "Creditor"
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
      simple_priority: "Low" | "Medium" | "High"
      simple_status: "Open" | "Done"
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
      action_category: ["Completed", "Response", "ToDo"],
      action_priority: ["Low", "Medium", "High"],
      action_status: ["Done", "Open"],
      app_role: ["admin", "staff"],
      baseline_bureau: ["Experian", "TransUnion", "Equifax"],
      baseline_target_status: ["pending", "still_present", "not_found"],
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
      event_category: ["Action", "Response", "Outcome", "Note"],
      event_source: [
        "Experian",
        "TransUnion",
        "Equifax",
        "LexisNexis",
        "CoreLogic",
        "Innovis",
        "Sagestream",
        "ChexSystems",
        "EWS",
        "NCTUE",
        "CFPB",
        "BBB",
        "AG",
        "Other",
        "FTC",
        "Creditor",
      ],
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
      simple_priority: ["Low", "Medium", "High"],
      simple_status: ["Open", "Done"],
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
