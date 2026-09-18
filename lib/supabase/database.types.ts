export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
      routines: {
        Row: {
          content: Json;
          created_at: string;
          icon: string | null;
          id: string;
          name: string;
          position: number;
          recurrence_type: "daily" | "specific_date";
          specific_date: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          content?: Json;
          created_at?: string;
          icon?: string | null;
          id?: string;
          name: string;
          position: number;
          recurrence_type: "daily" | "specific_date";
          specific_date?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          content?: Json;
          created_at?: string;
          icon?: string | null;
          id?: string;
          name?: string;
          position?: number;
          recurrence_type?: "daily" | "specific_date";
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
      reorder_routines: {
        Args: { ordered_ids: string[] };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
