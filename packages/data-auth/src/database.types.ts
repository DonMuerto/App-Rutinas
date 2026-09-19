import type { JsonValue } from "@ritmo/core";

export type Database = {
  public: {
    Tables: {
      block_completions: {
        Row: {
          block_id: string;
          block_type: "activity" | "checklist";
          completed_at: string;
          completion_date: string;
          id: string;
          routine_id: string;
          scope_activity_block_id: string;
        };
        Insert: {
          block_id: string;
          block_type: "activity" | "checklist";
          completed_at?: string;
          completion_date: string;
          id?: string;
          routine_id: string;
          scope_activity_block_id: string;
        };
        Update: {
          block_id?: string;
          block_type?: "activity" | "checklist";
          completed_at?: string;
          completion_date?: string;
          id?: string;
          routine_id?: string;
          scope_activity_block_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "block_completions_routine_id_fkey";
            columns: ["routine_id"];
            isOneToOne: false;
            referencedRelation: "routines";
            referencedColumns: ["id"];
          },
        ];
      };
      routine_draft_copy_requests: {
        Row: {
          request_id: string;
          routine_id: string;
          user_id: string;
        };
        Insert: {
          request_id: string;
          routine_id: string;
          user_id: string;
        };
        Update: {
          request_id?: string;
          routine_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      routines: {
        Row: {
          content: JsonValue;
          created_at: string;
          icon: string | null;
          id: string;
          name: string;
          position: number;
          recurrence_type: "daily" | "specific_date";
          revision: number;
          specific_date: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content?: JsonValue;
          created_at?: string;
          icon?: string | null;
          id?: string;
          name: string;
          position: number;
          recurrence_type: "daily" | "specific_date";
          revision?: number;
          specific_date?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: JsonValue;
          created_at?: string;
          icon?: string | null;
          id?: string;
          name?: string;
          position?: number;
          recurrence_type?: "daily" | "specific_date";
          revision?: number;
          specific_date?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_routine: {
        Args: {
          routine_icon: string | null;
          routine_name: string;
          routine_recurrence_type: string;
          routine_specific_date: string | null;
        };
        Returns: string;
      };
      create_routine_from_draft: {
        Args: {
          document: JsonValue;
          request_id: string;
          routine_icon: string | null;
          routine_name: string;
          routine_recurrence_type: string;
          routine_specific_date: string | null;
          source_routine_id: string;
        };
        Returns: string | null;
      };
      reorder_routines: {
        Args: { ordered_ids: string[] };
        Returns: undefined;
      };
      save_routine_document: {
        Args: {
          document: JsonValue;
          expected_revision: number;
          routine_id: string;
        };
        Returns: {
          new_revision: number;
          new_updated_at: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
