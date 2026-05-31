export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id: string | null
          created_at: string
          detail: Json | null
          id: number
          target_id: string | null
          target_type: string | null
          tenant_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: never
          target_id?: string | null
          target_type?: string | null
          tenant_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          actor_id?: string | null
          created_at?: string
          detail?: Json | null
          id?: never
          target_id?: string | null
          target_type?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      competition: {
        Row: {
          created_at: string
          external_id: string
          id: number
          name: string
          provider: string
          sport_id: number
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: never
          name: string
          provider: string
          sport_id: number
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: never
          name?: string
          provider?: string
          sport_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "competition_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sport"
            referencedColumns: ["id"]
          },
        ]
      }
      fixture: {
        Row: {
          after_extra_time: boolean
          away_team_id: number | null
          created_at: string
          external_id: string
          home_team_id: number | null
          id: number
          kickoff_at: string
          matchday: number | null
          penalty_away: number | null
          penalty_home: number | null
          provider: string
          regular_away: number | null
          regular_home: number | null
          season_id: number
          stage_id: number | null
          status: Database["public"]["Enums"]["fixture_status"]
          updated_at: string
          winner_team_id: number | null
        }
        Insert: {
          after_extra_time?: boolean
          away_team_id?: number | null
          created_at?: string
          external_id: string
          home_team_id?: number | null
          id?: never
          kickoff_at: string
          matchday?: number | null
          penalty_away?: number | null
          penalty_home?: number | null
          provider: string
          regular_away?: number | null
          regular_home?: number | null
          season_id: number
          stage_id?: number | null
          status?: Database["public"]["Enums"]["fixture_status"]
          updated_at?: string
          winner_team_id?: number | null
        }
        Update: {
          after_extra_time?: boolean
          away_team_id?: number | null
          created_at?: string
          external_id?: string
          home_team_id?: number | null
          id?: never
          kickoff_at?: string
          matchday?: number | null
          penalty_away?: number | null
          penalty_home?: number | null
          provider?: string
          regular_away?: number | null
          regular_home?: number | null
          season_id?: number
          stage_id?: number | null
          status?: Database["public"]["Enums"]["fixture_status"]
          updated_at?: string
          winner_team_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fixture_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixture_winner_team_id_fkey"
            columns: ["winner_team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction: {
        Row: {
          advancing_team_id: number | null
          away_goals: number
          created_at: string
          fixture_id: number
          home_goals: number
          id: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          advancing_team_id?: number | null
          away_goals: number
          created_at?: string
          fixture_id: number
          home_goals: number
          id?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          advancing_team_id?: number | null
          away_goals?: number
          created_at?: string
          fixture_id?: number
          home_goals?: number
          id?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_advancing_team_id_fkey"
            columns: ["advancing_team_id"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixture"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_score: {
        Row: {
          category: Database["public"]["Enums"]["score_category"]
          computed_at: string
          fixture_id: number
          points: number
          prediction_id: string
          rule_set_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["score_category"]
          computed_at?: string
          fixture_id: number
          points: number
          prediction_id: string
          rule_set_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["score_category"]
          computed_at?: string
          fixture_id?: number
          points?: number
          prediction_id?: string
          rule_set_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_score_fixture_id_fkey"
            columns: ["fixture_id"]
            isOneToOne: false
            referencedRelation: "fixture"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_score_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: true
            referencedRelation: "prediction"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_score_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "scoring_rule_set"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_score_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          created_at: string
          display_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scoring_rule_set: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          tenant_id: string
          version: number
        }
        Insert: {
          config: Json
          created_at?: string
          id?: string
          is_active?: boolean
          tenant_id: string
          version: number
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rule_set_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      season: {
        Row: {
          competition_id: number
          created_at: string
          ends_on: string | null
          external_id: string
          id: number
          label: string
          provider: string
          starts_on: string | null
        }
        Insert: {
          competition_id: number
          created_at?: string
          ends_on?: string | null
          external_id: string
          id?: never
          label: string
          provider: string
          starts_on?: string | null
        }
        Update: {
          competition_id?: number
          created_at?: string
          ends_on?: string | null
          external_id?: string
          id?: never
          label?: string
          provider?: string
          starts_on?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "season_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competition"
            referencedColumns: ["id"]
          },
        ]
      }
      sport: {
        Row: {
          id: number
          key: string
          name: string
        }
        Insert: {
          id?: never
          key: string
          name: string
        }
        Update: {
          id?: never
          key?: string
          name?: string
        }
        Relationships: []
      }
      stage: {
        Row: {
          id: number
          kind: Database["public"]["Enums"]["stage_kind"]
          name: string
          ordinal: number
          season_id: number
        }
        Insert: {
          id?: never
          kind: Database["public"]["Enums"]["stage_kind"]
          name: string
          ordinal: number
          season_id: number
        }
        Update: {
          id?: never
          kind?: Database["public"]["Enums"]["stage_kind"]
          name?: string
          ordinal?: number
          season_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "stage_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["id"]
          },
        ]
      }
      team: {
        Row: {
          country_code: string | null
          created_at: string
          crest_url: string | null
          external_id: string
          id: number
          name: string
          provider: string
          short_name: string | null
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          crest_url?: string | null
          external_id: string
          id?: never
          name: string
          provider: string
          short_name?: string | null
        }
        Update: {
          country_code?: string | null
          created_at?: string
          crest_url?: string | null
          external_id?: string
          id?: never
          name?: string
          provider?: string
          short_name?: string | null
        }
        Relationships: []
      }
      tenant: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      tenant_invite: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          role: Database["public"]["Enums"]["member_role"]
          tenant_id: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          role?: Database["public"]["Enums"]["member_role"]
          tenant_id: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          role?: Database["public"]["Enums"]["member_role"]
          tenant_id?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invite_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_member: {
        Row: {
          joined_at: string
          role: Database["public"]["Enums"]["member_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_member_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_season: {
        Row: {
          season_id: number
          tenant_id: string
        }
        Insert: {
          season_id: number
          tenant_id: string
        }
        Update: {
          season_id?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_season_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_season_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leaderboard: {
        Row: {
          display_name: string | null
          exact_count: number | null
          hit_count: number | null
          last_prediction_at: string | null
          rank: number | null
          tenant_id: string | null
          total_points: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prediction_score_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_group: {
        Args: { p_name: string; p_slug: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
        }
        SetofOptions: {
          from: "*"
          to: "tenant"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recompute_tenant: { Args: { p_tenant: string }; Returns: undefined }
      redeem_invite: {
        Args: { p_code: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
        }
        SetofOptions: {
          from: "*"
          to: "tenant"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      score_fixture: { Args: { p_fixture: number }; Returns: undefined }
      score_prediction: {
        Args: {
          f_away: number
          f_home: number
          f_winner: number
          p_advancing: number
          p_away: number
          p_config: Json
          p_home: number
          p_stage: Database["public"]["Enums"]["stage_kind"]
        }
        Returns: Database["public"]["CompositeTypes"]["score_outcome"]
        SetofOptions: {
          from: "*"
          to: "score_outcome"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      audit_action:
        | "tenant_create"
        | "member_add"
        | "member_remove"
        | "role_change"
        | "ruleset_change"
        | "result_override"
        | "invite_create"
        | "invite_redeem"
      fixture_status:
        | "scheduled"
        | "live"
        | "finished"
        | "postponed"
        | "abandoned"
        | "cancelled"
      member_role: "admin" | "member"
      score_category: "exact" | "goal_diff" | "tendency" | "miss"
      stage_kind:
        | "group"
        | "last_32"
        | "last_16"
        | "quarter_final"
        | "semi_final"
        | "third_place"
        | "final"
        | "matchday"
        | "other"
    }
    CompositeTypes: {
      score_outcome: {
        points: number | null
        category: Database["public"]["Enums"]["score_category"] | null
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      audit_action: [
        "tenant_create",
        "member_add",
        "member_remove",
        "role_change",
        "ruleset_change",
        "result_override",
        "invite_create",
        "invite_redeem",
      ],
      fixture_status: [
        "scheduled",
        "live",
        "finished",
        "postponed",
        "abandoned",
        "cancelled",
      ],
      member_role: ["admin", "member"],
      score_category: ["exact", "goal_diff", "tendency", "miss"],
      stage_kind: [
        "group",
        "last_32",
        "last_16",
        "quarter_final",
        "semi_final",
        "third_place",
        "final",
        "matchday",
        "other",
      ],
    },
  },
} as const

