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
      bureau_responses: {
        Row: {
          analysis_result: Json | null
          bureau: string
          client_id: string
          created_at: string | null
          follow_up_action: string | null
          id: string
          items_deleted: number | null
          items_disputed: number | null
          items_updated: number | null
          items_verified: number | null
          response_date: string
          response_type: string | null
          source_file_name: string | null
          source_file_url: string | null
          violation_count: number | null
          violations_detected: Json | null
        }
        Insert: {
          analysis_result?: Json | null
          bureau: string
          client_id: string
          created_at?: string | null
          follow_up_action?: string | null
          id?: string
          items_deleted?: number | null
          items_disputed?: number | null
          items_updated?: number | null
          items_verified?: number | null
          response_date: string
          response_type?: string | null
          source_file_name?: string | null
          source_file_url?: string | null
          violation_count?: number | null
          violations_detected?: Json | null
        }
        Update: {
          analysis_result?: Json | null
          bureau?: string
          client_id?: string
          created_at?: string | null
          follow_up_action?: string | null
          id?: string
          items_deleted?: number | null
          items_disputed?: number | null
          items_updated?: number | null
          items_verified?: number | null
          response_date?: string
          response_type?: string | null
          source_file_name?: string | null
          source_file_url?: string | null
          violation_count?: number | null
          violations_detected?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "bureau_responses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      client_summaries: {
        Row: {
          client_id: string
          content: string
          created_at: string | null
          generated_by: string | null
          id: string
          metadata: Json | null
          summary_type: string
          title: string
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string | null
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          summary_type?: string
          title: string
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string | null
          generated_by?: string | null
          id?: string
          metadata?: Json | null
          summary_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_summaries_client_id_fkey"
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
          alternate_addresses: string[]
          campaign_label: string | null
          city: string | null
          created_at: string
          credit_scores: Json
          current_address: string | null
          date_of_birth: string | null
          dispute_count: number | null
          email: string | null
          equifax_score: number | null
          experian_score: number | null
          ftc_identity_theft_report_number: string | null
          id: string
          intake_auto_extracted_at: string | null
          intake_date: string | null
          last_report_date: string | null
          legal_full_name: string | null
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
          alternate_addresses?: string[]
          campaign_label?: string | null
          city?: string | null
          created_at?: string
          credit_scores?: Json
          current_address?: string | null
          date_of_birth?: string | null
          dispute_count?: number | null
          email?: string | null
          equifax_score?: number | null
          experian_score?: number | null
          ftc_identity_theft_report_number?: string | null
          id?: string
          intake_auto_extracted_at?: string | null
          intake_date?: string | null
          last_report_date?: string | null
          legal_full_name?: string | null
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
          alternate_addresses?: string[]
          campaign_label?: string | null
          city?: string | null
          created_at?: string
          credit_scores?: Json
          current_address?: string | null
          date_of_birth?: string | null
          dispute_count?: number | null
          email?: string | null
          equifax_score?: number | null
          experian_score?: number | null
          ftc_identity_theft_report_number?: string | null
          id?: string
          intake_auto_extracted_at?: string | null
          intake_date?: string | null
          last_report_date?: string | null
          legal_full_name?: string | null
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
      credit_report_analyses: {
        Row: {
          analyzed_at: string
          baseline_summary: string | null
          client_id: string
          created_at: string
          credit_report_id: string
          id: string
          letter_suggestions: Json
          updated_at: string
          violations: Json
        }
        Insert: {
          analyzed_at?: string
          baseline_summary?: string | null
          client_id: string
          created_at?: string
          credit_report_id: string
          id?: string
          letter_suggestions?: Json
          updated_at?: string
          violations?: Json
        }
        Update: {
          analyzed_at?: string
          baseline_summary?: string | null
          client_id?: string
          created_at?: string
          credit_report_id?: string
          id?: string
          letter_suggestions?: Json
          updated_at?: string
          violations?: Json
        }
        Relationships: [
          {
            foreignKeyName: "credit_report_analyses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_report_analyses_credit_report_id_fkey"
            columns: ["credit_report_id"]
            isOneToOne: true
            referencedRelation: "credit_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_reports: {
        Row: {
          account_count: number | null
          analysis_result: Json | null
          bureau: string | null
          client_id: string
          created_at: string | null
          diff_summary: string | null
          id: string
          import_scope: string
          inquiry_count: number | null
          negative_count: number | null
          parse_summary: string | null
          parsed_data: Json | null
          previous_report_id: string | null
          raw_text: string | null
          report_date: string
          score_at_report: number | null
          source_file_name: string | null
          source_file_url: string | null
          source_type: string
        }
        Insert: {
          account_count?: number | null
          analysis_result?: Json | null
          bureau?: string | null
          client_id: string
          created_at?: string | null
          diff_summary?: string | null
          id?: string
          import_scope?: string
          inquiry_count?: number | null
          negative_count?: number | null
          parse_summary?: string | null
          parsed_data?: Json | null
          previous_report_id?: string | null
          raw_text?: string | null
          report_date: string
          score_at_report?: number | null
          source_file_name?: string | null
          source_file_url?: string | null
          source_type?: string
        }
        Update: {
          account_count?: number | null
          analysis_result?: Json | null
          bureau?: string | null
          client_id?: string
          created_at?: string | null
          diff_summary?: string | null
          id?: string
          import_scope?: string
          inquiry_count?: number | null
          negative_count?: number | null
          parse_summary?: string | null
          parsed_data?: Json | null
          previous_report_id?: string | null
          raw_text?: string | null
          report_date?: string
          score_at_report?: number | null
          source_file_name?: string | null
          source_file_url?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_reports_previous_report_id_fkey"
            columns: ["previous_report_id"]
            isOneToOne: false
            referencedRelation: "credit_reports"
            referencedColumns: ["id"]
          },
        ]
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
      diagnostic_signals: {
        Row: {
          client_id: string
          created_at: string
          detected_at: string
          dismissed_at: string | null
          evidence: Json
          id: string
          severity: string
          signal_type: string
          subject_ids: Json
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          detected_at?: string
          dismissed_at?: string | null
          evidence?: Json
          id?: string
          severity?: string
          signal_type: string
          subject_ids?: Json
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          detected_at?: string
          dismissed_at?: string | null
          evidence?: Json
          id?: string
          severity?: string
          signal_type?: string
          subject_ids?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_signals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_letters: {
        Row: {
          body_docx_path: string | null
          body_md: string
          client_id: string
          created_at: string
          created_by: string | null
          evidence_ids: Json
          id: string
          letter_type: string
          recipient_name: string
          recipient_type: string
          round_id: string | null
          status: Database["public"]["Enums"]["dispute_letter_status"]
          statutes: Json
          strength_checklist: Json
          timeline_event_id: string | null
          tradeline_ids: Json
          updated_at: string
        }
        Insert: {
          body_docx_path?: string | null
          body_md: string
          client_id: string
          created_at?: string
          created_by?: string | null
          evidence_ids?: Json
          id?: string
          letter_type: string
          recipient_name: string
          recipient_type: string
          round_id?: string | null
          status?: Database["public"]["Enums"]["dispute_letter_status"]
          statutes?: Json
          strength_checklist?: Json
          timeline_event_id?: string | null
          tradeline_ids?: Json
          updated_at?: string
        }
        Update: {
          body_docx_path?: string | null
          body_md?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          evidence_ids?: Json
          id?: string
          letter_type?: string
          recipient_name?: string
          recipient_type?: string
          round_id?: string | null
          status?: Database["public"]["Enums"]["dispute_letter_status"]
          statutes?: Json
          strength_checklist?: Json
          timeline_event_id?: string | null
          tradeline_ids?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_letters_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_letters_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "dispute_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_letters_timeline_event_id_fkey"
            columns: ["timeline_event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_rounds: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          round_number: number
          status: Database["public"]["Enums"]["dispute_round_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          round_number: number
          status?: Database["public"]["Enums"]["dispute_round_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          round_number?: number
          status?: Database["public"]["Enums"]["dispute_round_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_rounds_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      furnishers: {
        Row: {
          account_last4: string | null
          account_type: string | null
          client_id: string
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          account_last4?: string | null
          account_type?: string | null
          client_id: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          account_last4?: string | null
          account_type?: string | null
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "furnishers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
      payment_plans: {
        Row: {
          client_id: string
          created_at: string
          frequency: string | null
          id: string
          installment_amount: number | null
          notes: string | null
          num_installments: number | null
          plan_type: string
          start_date: string
          status: Database["public"]["Enums"]["payment_plan_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          frequency?: string | null
          id?: string
          installment_amount?: number | null
          notes?: string | null
          num_installments?: number | null
          plan_type: string
          start_date: string
          status?: Database["public"]["Enums"]["payment_plan_status"]
          total_amount: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          frequency?: string | null
          id?: string
          installment_amount?: number | null
          notes?: string | null
          num_installments?: number | null
          plan_type?: string
          start_date?: string
          status?: Database["public"]["Enums"]["payment_plan_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_due: number
          amount_paid: number | null
          client_id: string
          created_at: string
          due_date: string
          gcal_event_id: string | null
          id: string
          method: string | null
          notes: string | null
          paid_date: string | null
          plan_id: string
          reminder_sent: boolean
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number | null
          client_id: string
          created_at?: string
          due_date: string
          gcal_event_id?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          paid_date?: string | null
          plan_id: string
          reminder_sent?: boolean
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number | null
          client_id?: string
          created_at?: string
          due_date?: string
          gcal_event_id?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          paid_date?: string | null
          plan_id?: string
          reminder_sent?: boolean
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "payment_plans"
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
      score_history: {
        Row: {
          bureau: string
          client_id: string
          created_at: string | null
          id: string
          score: number
          score_date: string
          source: string | null
        }
        Insert: {
          bureau: string
          client_id: string
          created_at?: string | null
          id?: string
          score: number
          score_date?: string
          source?: string | null
        }
        Update: {
          bureau?: string
          client_id?: string
          created_at?: string | null
          id?: string
          score?: number
          score_date?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "score_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      timeline_event_attachments: {
        Row: {
          created_at: string
          drive_path: string
          event_id: string
          file_name: string
          file_url: string | null
          id: string
          mime_type: string
          size_bytes: number | null
        }
        Insert: {
          created_at?: string
          drive_path: string
          event_id: string
          file_name: string
          file_url?: string | null
          id?: string
          mime_type: string
          size_bytes?: number | null
        }
        Update: {
          created_at?: string
          drive_path?: string
          event_id?: string
          file_name?: string
          file_url?: string | null
          id?: string
          mime_type?: string
          size_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_event_attachments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "timeline_events"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          category: Database["public"]["Enums"]["event_category"]
          client_id: string
          correlation_id: string | null
          created_at: string
          date_is_unknown: boolean
          details: string | null
          event_date: string | null
          event_kind: string
          furnisher_id: string | null
          id: string
          is_draft: boolean
          raw_line: string
          related_accounts: Json | null
          round_id: string | null
          source: Database["public"]["Enums"]["event_source"] | null
          summary: string
          title: string
          tradeline_id: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["event_category"]
          client_id: string
          correlation_id?: string | null
          created_at?: string
          date_is_unknown?: boolean
          details?: string | null
          event_date?: string | null
          event_kind?: string
          furnisher_id?: string | null
          id?: string
          is_draft?: boolean
          raw_line?: string
          related_accounts?: Json | null
          round_id?: string | null
          source?: Database["public"]["Enums"]["event_source"] | null
          summary: string
          title: string
          tradeline_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["event_category"]
          client_id?: string
          correlation_id?: string | null
          created_at?: string
          date_is_unknown?: boolean
          details?: string | null
          event_date?: string | null
          event_kind?: string
          furnisher_id?: string | null
          id?: string
          is_draft?: boolean
          raw_line?: string
          related_accounts?: Json | null
          round_id?: string | null
          source?: Database["public"]["Enums"]["event_source"] | null
          summary?: string
          title?: string
          tradeline_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_furnisher_id_fkey"
            columns: ["furnisher_id"]
            isOneToOne: false
            referencedRelation: "furnishers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "dispute_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_events_tradeline_id_fkey"
            columns: ["tradeline_id"]
            isOneToOne: false
            referencedRelation: "tradelines"
            referencedColumns: ["id"]
          },
        ]
      }
      tradeline_bureau_states: {
        Row: {
          absent_in_latest: boolean
          account_status: string | null
          balance: number | null
          bureau: Database["public"]["Enums"]["tradeline_bureau"]
          created_at: string
          credit_report_id: string | null
          date_reported: string | null
          dispute_flags: Json
          high_balance: number | null
          id: string
          last_seen_date: string | null
          monthly_payment: number | null
          notes: string | null
          operator_disputed: boolean
          operator_disputed_reason: string | null
          parse_confidence: number | null
          past_due: number | null
          pay_status: string | null
          present: boolean
          remarks: Json
          status_on_bureau: string | null
          tradeline_id: string
          two_year_payment_grid: Json
          updated_at: string
        }
        Insert: {
          absent_in_latest?: boolean
          account_status?: string | null
          balance?: number | null
          bureau: Database["public"]["Enums"]["tradeline_bureau"]
          created_at?: string
          credit_report_id?: string | null
          date_reported?: string | null
          dispute_flags?: Json
          high_balance?: number | null
          id?: string
          last_seen_date?: string | null
          monthly_payment?: number | null
          notes?: string | null
          operator_disputed?: boolean
          operator_disputed_reason?: string | null
          parse_confidence?: number | null
          past_due?: number | null
          pay_status?: string | null
          present?: boolean
          remarks?: Json
          status_on_bureau?: string | null
          tradeline_id: string
          two_year_payment_grid?: Json
          updated_at?: string
        }
        Update: {
          absent_in_latest?: boolean
          account_status?: string | null
          balance?: number | null
          bureau?: Database["public"]["Enums"]["tradeline_bureau"]
          created_at?: string
          credit_report_id?: string | null
          date_reported?: string | null
          dispute_flags?: Json
          high_balance?: number | null
          id?: string
          last_seen_date?: string | null
          monthly_payment?: number | null
          notes?: string | null
          operator_disputed?: boolean
          operator_disputed_reason?: string | null
          parse_confidence?: number | null
          past_due?: number | null
          pay_status?: string | null
          present?: boolean
          remarks?: Json
          status_on_bureau?: string | null
          tradeline_id?: string
          two_year_payment_grid?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tradeline_bureau_states_tradeline_id_fkey"
            columns: ["tradeline_id"]
            isOneToOne: false
            referencedRelation: "tradelines"
            referencedColumns: ["id"]
          },
        ]
      }
      tradelines: {
        Row: {
          account_last4: string | null
          account_mask: string | null
          account_status: string | null
          account_type: string | null
          balance: number | null
          bureau: string | null
          client_id: string
          created_at: string
          credit_limit: number | null
          date_opened: string | null
          date_reported: string | null
          display_name: string
          dispute_flags: Json | null
          furnisher_id: string | null
          furnisher_normalized: string | null
          furnisher_raw: string | null
          high_balance: number | null
          id: string
          identity_key: string | null
          last_seen_date: string | null
          loan_type: string | null
          notes: string | null
          opened_date: string | null
          parse_confidence: number | null
          past_due: number | null
          pay_status: string | null
          payment_amount: number | null
          remarks: Json | null
          report_date: string | null
          status: Database["public"]["Enums"]["tradeline_status"]
          tradeline_id: string | null
          two_year_payment_grid: Json | null
          updated_at: string
        }
        Insert: {
          account_last4?: string | null
          account_mask?: string | null
          account_status?: string | null
          account_type?: string | null
          balance?: number | null
          bureau?: string | null
          client_id: string
          created_at?: string
          credit_limit?: number | null
          date_opened?: string | null
          date_reported?: string | null
          display_name: string
          dispute_flags?: Json | null
          furnisher_id?: string | null
          furnisher_normalized?: string | null
          furnisher_raw?: string | null
          high_balance?: number | null
          id?: string
          identity_key?: string | null
          last_seen_date?: string | null
          loan_type?: string | null
          notes?: string | null
          opened_date?: string | null
          parse_confidence?: number | null
          past_due?: number | null
          pay_status?: string | null
          payment_amount?: number | null
          remarks?: Json | null
          report_date?: string | null
          status?: Database["public"]["Enums"]["tradeline_status"]
          tradeline_id?: string | null
          two_year_payment_grid?: Json | null
          updated_at?: string
        }
        Update: {
          account_last4?: string | null
          account_mask?: string | null
          account_status?: string | null
          account_type?: string | null
          balance?: number | null
          bureau?: string | null
          client_id?: string
          created_at?: string
          credit_limit?: number | null
          date_opened?: string | null
          date_reported?: string | null
          display_name?: string
          dispute_flags?: Json | null
          furnisher_id?: string | null
          furnisher_normalized?: string | null
          furnisher_raw?: string | null
          high_balance?: number | null
          id?: string
          identity_key?: string | null
          last_seen_date?: string | null
          loan_type?: string | null
          notes?: string | null
          opened_date?: string | null
          parse_confidence?: number | null
          past_due?: number | null
          pay_status?: string | null
          payment_amount?: number | null
          remarks?: Json | null
          report_date?: string | null
          status?: Database["public"]["Enums"]["tradeline_status"]
          tradeline_id?: string | null
          two_year_payment_grid?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tradelines_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tradelines_furnisher_id_fkey"
            columns: ["furnisher_id"]
            isOneToOne: false
            referencedRelation: "furnishers"
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
      weekly_update_renderings: {
        Row: {
          client_id: string
          custom_status_summary: string | null
          generated_at: string
          generated_by_user_id: string | null
          id: string
          include_dates_in_body: boolean
          letters_action_table_snapshot: Json
          output_storage_path: string
          round_id: string | null
        }
        Insert: {
          client_id: string
          custom_status_summary?: string | null
          generated_at?: string
          generated_by_user_id?: string | null
          id?: string
          include_dates_in_body?: boolean
          letters_action_table_snapshot?: Json
          output_storage_path: string
          round_id?: string | null
        }
        Update: {
          client_id?: string
          custom_status_summary?: string | null
          generated_at?: string
          generated_by_user_id?: string | null
          id?: string
          include_dates_in_body?: boolean
          letters_action_table_snapshot?: Json
          output_storage_path?: string
          round_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_update_renderings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_update_renderings_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "dispute_rounds"
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
      create_client_and_matter:
        | {
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
        | {
            Args: {
              _alternate_addresses?: string[]
              _client_notes?: string
              _current_address?: string
              _dob?: string
              _email?: string
              _intake_raw_text: string
              _intake_source: string
              _legal_name: string
              _matter_type: Database["public"]["Enums"]["matter_type"]
              _phone?: string
              _ssn_last4?: string
            }
            Returns: {
              client_id: string
              matter_id: string
            }[]
          }
      debug_create_client_and_matter:
        | {
            Args: {
              _client_notes?: string
              _intake_raw_text: string
              _intake_source: string
              _legal_name: string
              _matter_type: Database["public"]["Enums"]["matter_type"]
            }
            Returns: Json
          }
        | {
            Args: {
              _alternate_addresses?: string[]
              _client_notes?: string
              _current_address?: string
              _dob?: string
              _email?: string
              _intake_raw_text: string
              _intake_source: string
              _legal_name: string
              _matter_type: Database["public"]["Enums"]["matter_type"]
              _phone?: string
              _ssn_last4?: string
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
      client_status: "Active" | "Inactive" | "Pending" | "active"
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
      dispute_letter_status: "draft" | "final" | "mailed"
      dispute_round_status:
        | "planning"
        | "mailed"
        | "awaiting_response"
        | "response_received"
        | "closed"
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
      payment_plan_status: "active" | "completed" | "delinquent" | "canceled"
      payment_status: "scheduled" | "paid" | "partial" | "overdue" | "waived"
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
      tradeline_bureau: "equifax" | "experian" | "transunion"
      tradeline_status:
        | "active"
        | "disputed"
        | "deleted"
        | "verified"
        | "unknown"
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
      client_status: ["Active", "Inactive", "Pending", "active"],
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
      dispute_letter_status: ["draft", "final", "mailed"],
      dispute_round_status: [
        "planning",
        "mailed",
        "awaiting_response",
        "response_received",
        "closed",
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
      payment_plan_status: ["active", "completed", "delinquent", "canceled"],
      payment_status: ["scheduled", "paid", "partial", "overdue", "waived"],
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
      tradeline_bureau: ["equifax", "experian", "transunion"],
      tradeline_status: [
        "active",
        "disputed",
        "deleted",
        "verified",
        "unknown",
      ],
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
