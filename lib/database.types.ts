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
      banned_words: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          word: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          word: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "banned_words_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banned_words_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banned_words_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banned_words_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          brand: string | null
          created_at: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          last4: string | null
          stripe_customer_id: string | null
          stripe_pm_id: string | null
          user_id: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_customer_id?: string | null
          stripe_pm_id?: string | null
          user_id: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_customer_id?: string | null
          stripe_pm_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_requests: {
        Row: {
          created_at: string
          decline_reason: string | null
          event_id: string | null
          id: string
          links: string[]
          message: string | null
          phone: string
          requester_id: string
          status: Database["public"]["Enums"]["claim_status"]
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decline_reason?: string | null
          event_id?: string | null
          id?: string
          links?: string[]
          message?: string | null
          phone: string
          requester_id: string
          status?: Database["public"]["Enums"]["claim_status"]
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decline_reason?: string | null
          event_id?: string | null
          id?: string
          links?: string[]
          message?: string | null
          phone?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["claim_status"]
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_requests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_requests_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          anonymized: boolean
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_owner_reply: boolean
          parent_comment_id: string | null
          review_id: string
          updated_at: string
        }
        Insert: {
          anonymized?: boolean
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_owner_reply?: boolean
          parent_comment_id?: string | null
          review_id: string
          updated_at?: string
        }
        Update: {
          anonymized?: boolean
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_owner_reply?: boolean
          parent_comment_id?: string | null
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "public_comment_authors"
            referencedColumns: ["comment_id"]
          },
          {
            foreignKeyName: "comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "review_author_public"
            referencedColumns: ["review_id"]
          },
          {
            foreignKeyName: "comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      content_hidden: {
        Row: {
          content_id: string
          content_type: Database["public"]["Enums"]["flag_content_type"]
          created_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: Database["public"]["Enums"]["flag_content_type"]
          created_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: Database["public"]["Enums"]["flag_content_type"]
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_hidden_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_hidden_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_hidden_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_hidden_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_reviews: {
        Row: {
          created_at: string
          event_title: string | null
          id: string
          overall: number | null
          review_body: string | null
          review_title: string | null
          reviewer_name: string
          reviewer_role: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          event_title?: string | null
          id?: string
          overall?: number | null
          review_body?: string | null
          review_title?: string | null
          reviewer_name: string
          reviewer_role?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          event_title?: string | null
          id?: string
          overall?: number | null
          review_body?: string | null
          review_title?: string | null
          reviewer_name?: string
          reviewer_role?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      event_age_groups: {
        Row: {
          age: Database["public"]["Enums"]["age_bracket"]
          created_at: string
          event_id: string
          field_size: Database["public"]["Enums"]["field_size"]
          id: string
          price: number
          team_gender: Database["public"]["Enums"]["team_gender"]
        }
        Insert: {
          age: Database["public"]["Enums"]["age_bracket"]
          created_at?: string
          event_id: string
          field_size: Database["public"]["Enums"]["field_size"]
          id?: string
          price: number
          team_gender: Database["public"]["Enums"]["team_gender"]
        }
        Update: {
          age?: Database["public"]["Enums"]["age_bracket"]
          created_at?: string
          event_id?: string
          field_size?: Database["public"]["Enums"]["field_size"]
          id?: string
          price?: number
          team_gender?: Database["public"]["Enums"]["team_gender"]
        }
        Relationships: [
          {
            foreignKeyName: "event_age_groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_competition_levels: {
        Row: {
          event_id: string
          level: Database["public"]["Enums"]["competition_level"]
        }
        Insert: {
          event_id: string
          level: Database["public"]["Enums"]["competition_level"]
        }
        Update: {
          event_id?: string
          level?: Database["public"]["Enums"]["competition_level"]
        }
        Relationships: [
          {
            foreignKeyName: "event_competition_levels_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_features: {
        Row: {
          event_id: string
          feature: Database["public"]["Enums"]["event_feature"]
        }
        Insert: {
          event_id: string
          feature: Database["public"]["Enums"]["event_feature"]
        }
        Update: {
          event_id?: string
          feature?: Database["public"]["Enums"]["event_feature"]
        }
        Relationships: [
          {
            foreignKeyName: "event_features_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_images: {
        Row: {
          created_at: string
          event_id: string
          id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_images_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_milestones: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          is_auto: boolean
          milestone_date: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          is_auto?: boolean
          milestone_date?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          is_auto?: boolean
          milestone_date?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_milestones_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_surfaces: {
        Row: {
          event_id: string
          surface: Database["public"]["Enums"]["surface"]
        }
        Insert: {
          event_id: string
          surface: Database["public"]["Enums"]["surface"]
        }
        Update: {
          event_id?: string
          surface?: Database["public"]["Enums"]["surface"]
        }
        Relationships: [
          {
            foreignKeyName: "event_surfaces_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          attendee_rating: number | null
          avg_competition: number | null
          avg_cost_value: number | null
          avg_diversity: number | null
          avg_facilities: number | null
          avg_fields: number | null
          avg_management: number | null
          cancel_reason: string | null
          claimed: boolean
          coach_rating: number | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          general_rating: number | null
          host_club: string | null
          id: string
          is_general_ad: boolean
          is_premium: boolean
          lifecycle: Database["public"]["Enums"]["event_lifecycle"]
          location_city: string | null
          location_formatted: string | null
          location_lat: number | null
          location_lng: number | null
          location_place_id: string | null
          location_state_abbr: string | null
          location_state_full: string | null
          location_zip: string | null
          logo_url: string | null
          num_teams_this_year: number | null
          owner_id: string | null
          premium_at: string | null
          region: Database["public"]["Enums"]["event_region"] | null
          registration_deadline: string | null
          registration_url: string | null
          review_count: number
          season_id: string | null
          start_date: string | null
          teams_attended_prev_year: number | null
          teams_prev_year_url: string | null
          teams_this_year_url: string | null
          title: string
          tournament_id: string
          updated_at: string
          video_url: string | null
          website_url: string | null
          would_return_pct: number | null
        }
        Insert: {
          attendee_rating?: number | null
          avg_competition?: number | null
          avg_cost_value?: number | null
          avg_diversity?: number | null
          avg_facilities?: number | null
          avg_fields?: number | null
          avg_management?: number | null
          cancel_reason?: string | null
          claimed?: boolean
          coach_rating?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          general_rating?: number | null
          host_club?: string | null
          id?: string
          is_general_ad?: boolean
          is_premium?: boolean
          lifecycle?: Database["public"]["Enums"]["event_lifecycle"]
          location_city?: string | null
          location_formatted?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_place_id?: string | null
          location_state_abbr?: string | null
          location_state_full?: string | null
          location_zip?: string | null
          logo_url?: string | null
          num_teams_this_year?: number | null
          owner_id?: string | null
          premium_at?: string | null
          region?: Database["public"]["Enums"]["event_region"] | null
          registration_deadline?: string | null
          registration_url?: string | null
          review_count?: number
          season_id?: string | null
          start_date?: string | null
          teams_attended_prev_year?: number | null
          teams_prev_year_url?: string | null
          teams_this_year_url?: string | null
          title: string
          tournament_id: string
          updated_at?: string
          video_url?: string | null
          website_url?: string | null
          would_return_pct?: number | null
        }
        Update: {
          attendee_rating?: number | null
          avg_competition?: number | null
          avg_cost_value?: number | null
          avg_diversity?: number | null
          avg_facilities?: number | null
          avg_fields?: number | null
          avg_management?: number | null
          cancel_reason?: string | null
          claimed?: boolean
          coach_rating?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          general_rating?: number | null
          host_club?: string | null
          id?: string
          is_general_ad?: boolean
          is_premium?: boolean
          lifecycle?: Database["public"]["Enums"]["event_lifecycle"]
          location_city?: string | null
          location_formatted?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_place_id?: string | null
          location_state_abbr?: string | null
          location_state_full?: string | null
          location_zip?: string | null
          logo_url?: string | null
          num_teams_this_year?: number | null
          owner_id?: string | null
          premium_at?: string | null
          region?: Database["public"]["Enums"]["event_region"] | null
          registration_deadline?: string | null
          registration_url?: string | null
          review_count?: number
          season_id?: string | null
          start_date?: string | null
          teams_attended_prev_year?: number | null
          teams_prev_year_url?: string | null
          teams_this_year_url?: string | null
          title?: string
          tournament_id?: string
          updated_at?: string
          video_url?: string | null
          website_url?: string | null
          would_return_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_audiences: {
        Row: {
          faq_id: string
          id: string
          role_title: Database["public"]["Enums"]["role_title"] | null
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          faq_id: string
          id?: string
          role_title?: Database["public"]["Enums"]["role_title"] | null
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          faq_id?: string
          id?: string
          role_title?: Database["public"]["Enums"]["role_title"] | null
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: [
          {
            foreignKeyName: "faq_audiences_faq_id_fkey"
            columns: ["faq_id"]
            isOneToOne: false
            referencedRelation: "faqs"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_visible: boolean
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_visible?: boolean
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_visible?: boolean
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faqs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faqs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faqs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faqs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      flagged_content: {
        Row: {
          additional_info: string | null
          content_id: string
          content_type: Database["public"]["Enums"]["flag_content_type"]
          created_at: string
          flagged_by: string | null
          id: string
          reason: Database["public"]["Enums"]["flag_reason"]
        }
        Insert: {
          additional_info?: string | null
          content_id: string
          content_type: Database["public"]["Enums"]["flag_content_type"]
          created_at?: string
          flagged_by?: string | null
          id?: string
          reason: Database["public"]["Enums"]["flag_reason"]
        }
        Update: {
          additional_info?: string | null
          content_id?: string
          content_type?: Database["public"]["Enums"]["flag_content_type"]
          created_at?: string
          flagged_by?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["flag_reason"]
        }
        Relationships: [
          {
            foreignKeyName: "flagged_content_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flagged_content_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flagged_content_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flagged_content_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          payload: Json | null
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_counters: {
        Row: {
          key: string
          value: number
        }
        Insert: {
          key: string
          value?: number
        }
        Update: {
          key?: string
          value?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          blocked: boolean
          business_email: string | null
          business_phone: string | null
          business_website: string | null
          created_at: string
          distance_pref: Database["public"]["Enums"]["distance_pref"] | null
          dob: string | null
          email_comment_replies: boolean
          email_event_reviews: boolean
          email_favorited_events: boolean
          email_review_likes: boolean
          email_review_replies: boolean
          first_name: string | null
          id: string
          inapp_comment_replies: boolean
          inapp_event_reviews: boolean
          inapp_favorited_events: boolean
          inapp_review_likes: boolean
          inapp_review_replies: boolean
          last_name: string | null
          location_city: string | null
          location_formatted: string | null
          location_lat: number | null
          location_lng: number | null
          location_place_id: string | null
          location_state_abbr: string | null
          location_state_full: string | null
          location_zip: string | null
          onboarding_completed: boolean
          org_description: string | null
          org_logo_url: string | null
          organization_title: string | null
          preferences_completed: boolean
          profile_photo_url: string | null
          role_title: Database["public"]["Enums"]["role_title"]
          updated_at: string
          user_gender: Database["public"]["Enums"]["user_gender"] | null
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          blocked?: boolean
          business_email?: string | null
          business_phone?: string | null
          business_website?: string | null
          created_at?: string
          distance_pref?: Database["public"]["Enums"]["distance_pref"] | null
          dob?: string | null
          email_comment_replies?: boolean
          email_event_reviews?: boolean
          email_favorited_events?: boolean
          email_review_likes?: boolean
          email_review_replies?: boolean
          first_name?: string | null
          id: string
          inapp_comment_replies?: boolean
          inapp_event_reviews?: boolean
          inapp_favorited_events?: boolean
          inapp_review_likes?: boolean
          inapp_review_replies?: boolean
          last_name?: string | null
          location_city?: string | null
          location_formatted?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_place_id?: string | null
          location_state_abbr?: string | null
          location_state_full?: string | null
          location_zip?: string | null
          onboarding_completed?: boolean
          org_description?: string | null
          org_logo_url?: string | null
          organization_title?: string | null
          preferences_completed?: boolean
          profile_photo_url?: string | null
          role_title: Database["public"]["Enums"]["role_title"]
          updated_at?: string
          user_gender?: Database["public"]["Enums"]["user_gender"] | null
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          blocked?: boolean
          business_email?: string | null
          business_phone?: string | null
          business_website?: string | null
          created_at?: string
          distance_pref?: Database["public"]["Enums"]["distance_pref"] | null
          dob?: string | null
          email_comment_replies?: boolean
          email_event_reviews?: boolean
          email_favorited_events?: boolean
          email_review_likes?: boolean
          email_review_replies?: boolean
          first_name?: string | null
          id?: string
          inapp_comment_replies?: boolean
          inapp_event_reviews?: boolean
          inapp_favorited_events?: boolean
          inapp_review_likes?: boolean
          inapp_review_replies?: boolean
          last_name?: string | null
          location_city?: string | null
          location_formatted?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_place_id?: string | null
          location_state_abbr?: string | null
          location_state_full?: string | null
          location_zip?: string | null
          onboarding_completed?: boolean
          org_description?: string | null
          org_logo_url?: string | null
          organization_title?: string | null
          preferences_completed?: boolean
          profile_photo_url?: string | null
          role_title?: Database["public"]["Enums"]["role_title"]
          updated_at?: string
          user_gender?: Database["public"]["Enums"]["user_gender"] | null
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          applied_at: string | null
          created_at: string
          email: string
          event_id: string
          id: string
          pretty_code: string
          status: Database["public"]["Enums"]["promo_status"]
          submitted_csv_id: string
          updated_at: string
          url_token: string | null
          user_id: string | null
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          email: string
          event_id: string
          id?: string
          pretty_code: string
          status?: Database["public"]["Enums"]["promo_status"]
          submitted_csv_id: string
          updated_at?: string
          url_token?: string | null
          user_id?: string | null
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          email?: string
          event_id?: string
          id?: string
          pretty_code?: string
          status?: Database["public"]["Enums"]["promo_status"]
          submitted_csv_id?: string
          updated_at?: string
          url_token?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_codes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_codes_submitted_csv_id_fkey"
            columns: ["submitted_csv_id"]
            isOneToOne: false
            referencedRelation: "submitted_csvs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_funnel_events: {
        Row: {
          id: string
          occurred_at: string
          promo_id: string
          step: string
        }
        Insert: {
          id?: string
          occurred_at?: string
          promo_id: string
          step: string
        }
        Update: {
          id?: string
          occurred_at?: string
          promo_id?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_funnel_events_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_windows: {
        Row: {
          bucket: string
          hits: number
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
      }
      recently_viewed: {
        Row: {
          event_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          event_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          event_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recently_viewed_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recently_viewed_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recently_viewed_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recently_viewed_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recently_viewed_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      review_helpful: {
        Row: {
          created_at: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_helpful_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "review_author_public"
            referencedColumns: ["review_id"]
          },
          {
            foreignKeyName: "review_helpful_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_helpful_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_helpful_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_helpful_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_helpful_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          anonymized: boolean
          author_id: string | null
          created_at: string
          detached: boolean
          event_id: string | null
          guru_review: boolean
          helpful_count: number
          id: string
          overall: number | null
          promo_id: string | null
          published_at: string | null
          rating_competition: number | null
          rating_cost_value: number | null
          rating_diversity: number | null
          rating_facilities: number | null
          rating_fields: number | null
          rating_management: number | null
          review_body: string | null
          review_title: string | null
          reviewer_role: Database["public"]["Enums"]["role_title"] | null
          reviewer_user_type: Database["public"]["Enums"]["user_type"] | null
          snapshot_event_end: string | null
          snapshot_event_location: string | null
          snapshot_event_logo: string | null
          snapshot_event_start: string | null
          snapshot_event_title: string | null
          snapshot_tournament_title: string | null
          status: Database["public"]["Enums"]["review_status"]
          updated_at: string
          would_return: boolean | null
        }
        Insert: {
          anonymized?: boolean
          author_id?: string | null
          created_at?: string
          detached?: boolean
          event_id?: string | null
          guru_review?: boolean
          helpful_count?: number
          id?: string
          overall?: number | null
          promo_id?: string | null
          published_at?: string | null
          rating_competition?: number | null
          rating_cost_value?: number | null
          rating_diversity?: number | null
          rating_facilities?: number | null
          rating_fields?: number | null
          rating_management?: number | null
          review_body?: string | null
          review_title?: string | null
          reviewer_role?: Database["public"]["Enums"]["role_title"] | null
          reviewer_user_type?: Database["public"]["Enums"]["user_type"] | null
          snapshot_event_end?: string | null
          snapshot_event_location?: string | null
          snapshot_event_logo?: string | null
          snapshot_event_start?: string | null
          snapshot_event_title?: string | null
          snapshot_tournament_title?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
          would_return?: boolean | null
        }
        Update: {
          anonymized?: boolean
          author_id?: string | null
          created_at?: string
          detached?: boolean
          event_id?: string | null
          guru_review?: boolean
          helpful_count?: number
          id?: string
          overall?: number | null
          promo_id?: string | null
          published_at?: string | null
          rating_competition?: number | null
          rating_cost_value?: number | null
          rating_diversity?: number | null
          rating_facilities?: number | null
          rating_fields?: number | null
          rating_management?: number | null
          review_body?: string | null
          review_title?: string | null
          reviewer_role?: Database["public"]["Enums"]["role_title"] | null
          reviewer_user_type?: Database["public"]["Enums"]["user_type"] | null
          snapshot_event_end?: string | null
          snapshot_event_location?: string | null
          snapshot_event_logo?: string | null
          snapshot_event_start?: string | null
          snapshot_event_title?: string | null
          snapshot_tournament_title?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          updated_at?: string
          would_return?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_promo_fk"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      search_queries: {
        Row: {
          created_at: string
          id: string
          term: string
        }
        Insert: {
          created_at?: string
          id?: string
          term: string
        }
        Update: {
          created_at?: string
          id?: string
          term?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          created_at: string
          id: string
          label: string
          start_year: number
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          start_year: number
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          start_year?: number
        }
        Relationships: []
      }
      sponsors: {
        Row: {
          created_at: string
          event_id: string
          id: string
          link: string
          logo_url: string
          name: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          link: string
          logo_url: string
          name: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          link?: string
          logo_url?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      submitted_csvs: {
        Row: {
          created_at: string
          ed_id: string
          event_id: string
          file_path: string | null
          id: string
          raw_emails: Json
          rejection_reason: string | null
          status: Database["public"]["Enums"]["csv_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          ed_id: string
          event_id: string
          file_path?: string | null
          id?: string
          raw_emails?: Json
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["csv_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          ed_id?: string
          event_id?: string
          file_path?: string | null
          id?: string
          raw_emails?: Json
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["csv_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submitted_csvs_ed_id_fkey"
            columns: ["ed_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submitted_csvs_ed_id_fkey"
            columns: ["ed_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submitted_csvs_ed_id_fkey"
            columns: ["ed_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submitted_csvs_ed_id_fkey"
            columns: ["ed_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submitted_csvs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          attendee_rating: number | null
          avg_competition: number | null
          avg_cost_value: number | null
          avg_diversity: number | null
          avg_facilities: number | null
          avg_fields: number | null
          avg_management: number | null
          claimed: boolean
          coach_rating: number | null
          created_at: string
          created_by: string | null
          general_rating: number | null
          id: string
          owner_id: string | null
          recurring: boolean
          review_count: number
          title: string
          updated_at: string
        }
        Insert: {
          attendee_rating?: number | null
          avg_competition?: number | null
          avg_cost_value?: number | null
          avg_diversity?: number | null
          avg_facilities?: number | null
          avg_fields?: number | null
          avg_management?: number | null
          claimed?: boolean
          coach_rating?: number | null
          created_at?: string
          created_by?: string | null
          general_rating?: number | null
          id?: string
          owner_id?: string | null
          recurring?: boolean
          review_count?: number
          title: string
          updated_at?: string
        }
        Update: {
          attendee_rating?: number | null
          avg_competition?: number | null
          avg_cost_value?: number | null
          avg_diversity?: number | null
          avg_facilities?: number | null
          avg_fields?: number | null
          avg_management?: number | null
          claimed?: boolean
          coach_rating?: number | null
          created_at?: string
          created_by?: string | null
          general_rating?: number | null
          id?: string
          owner_id?: string | null
          recurring?: boolean
          review_count?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number | null
          created_at: string
          event_id: string | null
          id: string
          kind: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          event_id?: string | null
          id?: string
          kind?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          event_id?: string | null
          id?: string
          kind?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      us_states: {
        Row: {
          code: string
          name: string
        }
        Insert: {
          code: string
          name: string
        }
        Update: {
          code?: string
          name?: string
        }
        Relationships: []
      }
      user_teams: {
        Row: {
          age: Database["public"]["Enums"]["age_bracket"] | null
          competition_level:
            | Database["public"]["Enums"]["competition_level"]
            | null
          created_at: string
          id: string
          profile_id: string
          slot: number
          team_gender: Database["public"]["Enums"]["team_gender"] | null
          updated_at: string
        }
        Insert: {
          age?: Database["public"]["Enums"]["age_bracket"] | null
          competition_level?:
            | Database["public"]["Enums"]["competition_level"]
            | null
          created_at?: string
          id?: string
          profile_id: string
          slot: number
          team_gender?: Database["public"]["Enums"]["team_gender"] | null
          updated_at?: string
        }
        Update: {
          age?: Database["public"]["Enums"]["age_bracket"] | null
          competition_level?:
            | Database["public"]["Enums"]["competition_level"]
            | null
          created_at?: string
          id?: string
          profile_id?: string
          slot?: number
          team_gender?: Database["public"]["Enums"]["team_gender"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_teams_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_teams_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_teams_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_teams_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_attendees: {
        Row: {
          first_name: string | null
          id: string | null
          last_initial: string | null
          location_city: string | null
          location_formatted: string | null
          location_state_abbr: string | null
          organization_title: string | null
          profile_photo_url: string | null
          role_title: Database["public"]["Enums"]["role_title"] | null
        }
        Insert: {
          first_name?: string | null
          id?: string | null
          last_initial?: never
          location_city?: string | null
          location_formatted?: string | null
          location_state_abbr?: string | null
          organization_title?: string | null
          profile_photo_url?: string | null
          role_title?: Database["public"]["Enums"]["role_title"] | null
        }
        Update: {
          first_name?: string | null
          id?: string | null
          last_initial?: never
          location_city?: string | null
          location_formatted?: string | null
          location_state_abbr?: string | null
          organization_title?: string | null
          profile_photo_url?: string | null
          role_title?: Database["public"]["Enums"]["role_title"] | null
        }
        Relationships: []
      }
      public_comment_authors: {
        Row: {
          author_id: string | null
          comment_id: string | null
          first_name: string | null
          is_owner_reply: boolean | null
          last_initial: string | null
          org_logo_url: string | null
          organization_title: string | null
          profile_photo_url: string | null
          user_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_directors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_event_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      public_directors: {
        Row: {
          business_email: string | null
          business_phone: string | null
          business_website: string | null
          first_name: string | null
          id: string | null
          last_name: string | null
          org_description: string | null
          org_logo_url: string | null
          organization_title: string | null
          profile_photo_url: string | null
        }
        Insert: {
          business_email?: string | null
          business_phone?: string | null
          business_website?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          org_description?: string | null
          org_logo_url?: string | null
          organization_title?: string | null
          profile_photo_url?: string | null
        }
        Update: {
          business_email?: string | null
          business_phone?: string | null
          business_website?: string | null
          first_name?: string | null
          id?: string | null
          last_name?: string | null
          org_description?: string | null
          org_logo_url?: string | null
          organization_title?: string | null
          profile_photo_url?: string | null
        }
        Relationships: []
      }
      public_event_owners: {
        Row: {
          first_name: string | null
          id: string | null
          org_description: string | null
          org_logo_url: string | null
          organization_title: string | null
          profile_photo_url: string | null
        }
        Insert: {
          first_name?: string | null
          id?: string | null
          org_description?: string | null
          org_logo_url?: string | null
          organization_title?: string | null
          profile_photo_url?: string | null
        }
        Update: {
          first_name?: string | null
          id?: string | null
          org_description?: string | null
          org_logo_url?: string | null
          organization_title?: string | null
          profile_photo_url?: string | null
        }
        Relationships: []
      }
      review_author_public: {
        Row: {
          first_name: string | null
          guru_review: boolean | null
          last_initial: string | null
          organization_title: string | null
          profile_photo_url: string | null
          review_id: string | null
          reviewer_role: Database["public"]["Enums"]["role_title"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_delete_user: { Args: { target_user: string }; Returns: undefined }
      admin_search_users_by_email: { Args: { term: string }; Returns: string[] }
      admin_set_blocked: {
        Args: { is_blocked: boolean; target_user: string }
        Returns: undefined
      }
      admin_set_general_ad: {
        Args: { target_event: string; val: boolean }
        Returns: undefined
      }
      admin_set_premium: {
        Args: { target_event: string; val: boolean }
        Returns: undefined
      }
      anonymize_account: { Args: { target_user: string }; Returns: undefined }
      apply_promo_to_review: {
        Args: { p_promo: string; p_review: string }
        Returns: undefined
      }
      approve_claim_request: {
        Args: { target_claim: string }
        Returns: undefined
      }
      claim_promo: {
        Args: { p_token: string }
        Returns: {
          event_id: string
          promo_id: string
        }[]
      }
      decline_claim_request: {
        Args: { reason: string; target_claim: string }
        Returns: undefined
      }
      delete_ed_account: { Args: { target_user: string }; Returns: undefined }
      delete_event: { Args: { target_event: string }; Returns: undefined }
      delete_tournament: {
        Args: { target_tournament: string }
        Returns: undefined
      }
      event_display_status: {
        Args: { e: Database["public"]["Tables"]["events"]["Row"] }
        Returns: string
      }
      get_platform_stats: {
        Args: never
        Returns: {
          events: number
          reviews: number
          tournaments: number
        }[]
      }
      get_popular_searches: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          hits: number
          term: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_event_host: { Args: never; Returns: boolean }
      promo_email_eligibility: {
        Args: { p_emails: string[] }
        Returns: {
          email: string
          status: string
        }[]
      }
      promo_landing_info: {
        Args: { p_token: string }
        Returns: {
          email: string
          event_id: string
        }[]
      }
      rate_limit_prune: { Args: never; Returns: undefined }
      rate_limit_touch: {
        Args: { p_bucket: string; p_limit: number }
        Returns: undefined
      }
      recalc_event_ratings: {
        Args: { target_event: string }
        Returns: undefined
      }
      recalc_tournament_ratings: {
        Args: { target_tournament: string }
        Returns: undefined
      }
      review_overall: {
        Args: { r: Database["public"]["Tables"]["reviews"]["Row"] }
        Returns: number
      }
      save_event_graph: { Args: { p_event: Json }; Returns: string }
      scrub_profile_identity: {
        Args: { target_user: string }
        Returns: undefined
      }
      soft_delete_attendee: {
        Args: { target_user: string }
        Returns: undefined
      }
    }
    Enums: {
      age_bracket:
        | "U4"
        | "U5"
        | "U6"
        | "U7"
        | "U8"
        | "U9"
        | "U10"
        | "U11"
        | "U12"
        | "U13"
        | "U14"
        | "U15"
        | "U16"
        | "U17"
        | "U18"
        | "U19"
        | "U20"
      claim_status: "pending" | "approved" | "declined"
      competition_level: "highest" | "upper" | "middle" | "lower" | "lowest"
      csv_status: "pending" | "approved" | "rejected"
      distance_pref: "no_limit" | "miles_150" | "miles_300" | "miles_450"
      event_feature:
        | "stay_to_play"
        | "restrooms"
        | "concessions"
        | "accessible"
        | "free_wifi"
        | "pet_friendly"
        | "free_parking"
        | "synthetic_turf"
      event_lifecycle: "draft" | "active" | "canceled"
      event_region: "I" | "II" | "III" | "IV"
      field_size: "5v5" | "6v6" | "7v7" | "8v8" | "9v9" | "10v10" | "11v11"
      flag_content_type: "review" | "comment"
      flag_reason: "profanity" | "illicit" | "solicitation" | "other"
      promo_status: "staged" | "sent" | "active" | "applied" | "void"
      review_status: "draft" | "published"
      role_title:
        | "event_director"
        | "event_admin"
        | "club_director"
        | "coach"
        | "parent_spectator"
        | "team_manager"
      surface: "turf" | "grass"
      team_gender: "boys" | "girls" | "both"
      user_gender: "female" | "male"
      user_type: "admin" | "event_director" | "attendee"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      age_bracket: [
        "U4",
        "U5",
        "U6",
        "U7",
        "U8",
        "U9",
        "U10",
        "U11",
        "U12",
        "U13",
        "U14",
        "U15",
        "U16",
        "U17",
        "U18",
        "U19",
        "U20",
      ],
      claim_status: ["pending", "approved", "declined"],
      competition_level: ["highest", "upper", "middle", "lower", "lowest"],
      csv_status: ["pending", "approved", "rejected"],
      distance_pref: ["no_limit", "miles_150", "miles_300", "miles_450"],
      event_feature: [
        "stay_to_play",
        "restrooms",
        "concessions",
        "accessible",
        "free_wifi",
        "pet_friendly",
        "free_parking",
        "synthetic_turf",
      ],
      event_lifecycle: ["draft", "active", "canceled"],
      event_region: ["I", "II", "III", "IV"],
      field_size: ["5v5", "6v6", "7v7", "8v8", "9v9", "10v10", "11v11"],
      flag_content_type: ["review", "comment"],
      flag_reason: ["profanity", "illicit", "solicitation", "other"],
      promo_status: ["staged", "sent", "active", "applied", "void"],
      review_status: ["draft", "published"],
      role_title: [
        "event_director",
        "event_admin",
        "club_director",
        "coach",
        "parent_spectator",
        "team_manager",
      ],
      surface: ["turf", "grass"],
      team_gender: ["boys", "girls", "both"],
      user_gender: ["female", "male"],
      user_type: ["admin", "event_director", "attendee"],
    },
  },
} as const

