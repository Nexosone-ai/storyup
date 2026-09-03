import type {
  WebsiteContent,
  PublishStatus,
} from "./domain";

// Hand-maintained to match supabase/migrations/0001_init.sql.
// (Regenerate with `supabase gen types` once the CLI is wired up.)

type Timestamps = {
  created_at: string;
  updated_at: string;
};

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          email: string | null;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string | null;
          email?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      businesses: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          category: string;
          description: string | null;
          founder_story: string | null;
          target_customer: string | null;
          strengths: string | null;
          tone: string | null;
          slug: string;
        } & Timestamps;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          category: string;
          description?: string | null;
          founder_story?: string | null;
          target_customer?: string | null;
          strengths?: string | null;
          tone?: string | null;
          slug: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["businesses"]["Insert"]>;
        Relationships: [];
      };
      brand_profiles: {
        Row: {
          id: string;
          business_id: string;
          brand_name: string | null;
          headline: string | null;
          slogan: string | null;
          short_description: string | null;
          brand_story: string | null;
          mission: string | null;
          target_customer: string | null;
          key_strengths: string[];
          brand_keywords: string[];
          tone: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          business_id: string;
          brand_name?: string | null;
          headline?: string | null;
          slogan?: string | null;
          short_description?: string | null;
          brand_story?: string | null;
          mission?: string | null;
          target_customer?: string | null;
          key_strengths?: string[];
          brand_keywords?: string[];
          tone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["brand_profiles"]["Insert"]
        >;
        Relationships: [];
      };
      websites: {
        Row: {
          id: string;
          business_id: string;
          slug: string;
          content: WebsiteContent;
          status: PublishStatus;
          published_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          business_id: string;
          slug: string;
          content: WebsiteContent;
          status?: PublishStatus;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["websites"]["Insert"]>;
        Relationships: [];
      };
      blog_posts: {
        Row: {
          id: string;
          business_id: string;
          title: string;
          slug: string;
          summary: string | null;
          content: string | null;
          keywords: string[];
          seo_title: string | null;
          seo_description: string | null;
          social_caption: string | null;
          cover_image_url: string | null;
          category: string | null;
          status: PublishStatus;
          published_at: string | null;
        } & Timestamps;
        Insert: {
          id?: string;
          business_id: string;
          title: string;
          slug: string;
          summary?: string | null;
          content?: string | null;
          keywords?: string[];
          seo_title?: string | null;
          seo_description?: string | null;
          social_caption?: string | null;
          cover_image_url?: string | null;
          category?: string | null;
          status?: PublishStatus;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["blog_posts"]["Insert"]>;
        Relationships: [];
      };
      blog_comments: {
        Row: {
          id: string;
          post_id: string;
          business_id: string;
          user_id: string | null;
          author_name: string;
          password_hash: string | null;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          business_id: string;
          user_id?: string | null;
          author_name: string;
          password_hash?: string | null;
          content: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["blog_comments"]["Insert"]
        >;
        Relationships: [];
      };
      marketing_contents: {
        Row: {
          id: string;
          business_id: string;
          blog_post_id: string | null;
          platform: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          blog_post_id?: string | null;
          platform: string;
          content: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["marketing_contents"]["Insert"]
        >;
        Relationships: [];
      };
      story_connect_posts: {
        Row: {
          id: string;
          user_id: string;
          author_name: string;
          content: string;
          image_urls: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          author_name?: string;
          content: string;
          image_urls?: string[];
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["story_connect_posts"]["Insert"]
        >;
        Relationships: [];
      };
      story_connect_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["story_connect_likes"]["Insert"]
        >;
        Relationships: [];
      };
      real_talk_posts: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["real_talk_posts"]["Insert"]
        >;
        Relationships: [];
      };
      community_comments: {
        Row: {
          id: string;
          post_type: "story" | "realtalk";
          post_id: string;
          user_id: string;
          author_name: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_type: "story" | "realtalk";
          post_id: string;
          user_id: string;
          author_name?: string;
          content: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["community_comments"]["Insert"]
        >;
        Relationships: [];
      };
      site_events: {
        Row: {
          id: string;
          business_id: string;
          event: "page_view" | "share";
          path: string;
          channel: string | null;
          referrer: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          event: "page_view" | "share";
          path?: string;
          channel?: string | null;
          referrer?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["site_events"]["Insert"]>;
        Relationships: [];
      };
      real_talk_likes: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["real_talk_likes"]["Insert"]
        >;
        Relationships: [];
      };
      blog_connections: {
        Row: {
          id: string;
          business_id: string;
          channel: string;
          account_label: string | null;
          connected: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          channel: string;
          account_label?: string | null;
          connected?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["blog_connections"]["Insert"]
        >;
        Relationships: [];
      };
      publish_schedules: {
        Row: {
          id: string;
          business_id: string;
          blog_post_id: string | null;
          channel: string;
          scheduled_at: string;
          status: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          blog_post_id?: string | null;
          channel: string;
          scheduled_at: string;
          status?: string;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["publish_schedules"]["Insert"]
        >;
        Relationships: [];
      };
      point_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          reason: string;
          type: string | null;
          ref_type: string | null;
          ref_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          reason: string;
          type?: string | null;
          ref_type?: string | null;
          ref_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["point_transactions"]["Insert"]
        >;
        Relationships: [];
      };
      point_packages: {
        Row: {
          id: string;
          name: string;
          price_krw: number;
          credits: number;
          bonus_credits: number;
          active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          price_krw: number;
          credits: number;
          bonus_credits?: number;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["point_packages"]["Insert"]
        >;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          order_id: string;
          package_id: string | null;
          provider: string;
          payment_method: string | null;
          payment_key: string | null;
          transaction_id: string | null;
          currency: string;
          amount: number;
          credits: number;
          bonus_credits: number;
          status: string;
          requested_at: string;
          approved_at: string | null;
          cancelled_at: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          order_id: string;
          package_id?: string | null;
          provider?: string;
          payment_method?: string | null;
          payment_key?: string | null;
          transaction_id?: string | null;
          currency?: string;
          amount: number;
          credits: number;
          bonus_credits?: number;
          status?: string;
          requested_at?: string;
          approved_at?: string | null;
          cancelled_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      service_prices: {
        Row: {
          service: string;
          label: string;
          price: number;
          active: boolean;
          updated_at: string;
        };
        Insert: {
          service: string;
          label: string;
          price?: number;
          active?: boolean;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["service_prices"]["Insert"]
        >;
        Relationships: [];
      };
      withdrawal_requests: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          account_info: string;
          status: string;
          decided_by: string | null;
          decided_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          account_info: string;
          status?: string;
          decided_by?: string | null;
          decided_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["withdrawal_requests"]["Insert"]
        >;
        Relationships: [];
      };
      supporter_profiles: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          display_name: string;
          bio: string | null;
          skills: string[];
          portfolio_url: string | null;
          contact: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: string;
          display_name: string;
          bio?: string | null;
          skills?: string[];
          portfolio_url?: string | null;
          contact?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["supporter_profiles"]["Insert"]
        >;
        Relationships: [];
      };
      collaboration_projects: {
        Row: {
          id: string;
          business_id: string;
          supporter_user_id: string;
          business_name: string;
          supporter_name: string;
          title: string;
          description: string | null;
          budget_points: number | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          supporter_user_id: string;
          business_name?: string;
          supporter_name?: string;
          title: string;
          description?: string | null;
          budget_points?: number | null;
          status?: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["collaboration_projects"]["Insert"]
        >;
        Relationships: [];
      };
      premium_templates: {
        Row: {
          id: string;
          creator_user_id: string;
          creator_name: string;
          title: string;
          description: string | null;
          template_key: string;
          preview_image: string | null;
          price_points: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_user_id: string;
          creator_name?: string;
          title: string;
          description?: string | null;
          template_key?: string;
          preview_image?: string | null;
          price_points: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["premium_templates"]["Insert"]
        >;
        Relationships: [];
      };
      template_purchases: {
        Row: {
          id: string;
          template_id: string;
          buyer_user_id: string;
          creator_user_id: string;
          price_points: number;
          creator_earning: number;
          platform_fee: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          buyer_user_id: string;
          creator_user_id: string;
          price_points: number;
          creator_earning: number;
          platform_fee: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["template_purchases"]["Insert"]
        >;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          user_id: string;
          plan: string;
          status: string;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          plan?: string;
          status?: string;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["subscriptions"]["Insert"]
        >;
        Relationships: [];
      };
      usage_events: {
        Row: {
          id: string;
          user_id: string;
          kind: string;
          charged: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          kind: string;
          charged?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["usage_events"]["Insert"]>;
        Relationships: [];
      };
      plan_grants: {
        Row: {
          user_id: string;
          period: string;
          plan: string;
          amount: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          period: string;
          plan: string;
          amount: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["plan_grants"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      grant_plan_points: {
        Args: {
          p_user: string;
          p_plan: string;
          p_period: string;
          p_amount: number;
        };
        Returns: boolean;
      };
      spend_points: {
        Args: {
          p_user: string;
          p_amount: number;
          p_reason: string;
          p_type?: string;
          p_ref_type?: string | null;
          p_ref_id?: string | null;
        };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
  };
}

// Convenience row aliases used across the app.
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
export type PointPackageRow =
  Database["public"]["Tables"]["point_packages"]["Row"];
export type ServicePriceRow =
  Database["public"]["Tables"]["service_prices"]["Row"];
export type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];
export type BrandProfileRow =
  Database["public"]["Tables"]["brand_profiles"]["Row"];
export type WebsiteRow = Database["public"]["Tables"]["websites"]["Row"];
export type BlogPostRow = Database["public"]["Tables"]["blog_posts"]["Row"];
export type BlogCommentRow =
  Database["public"]["Tables"]["blog_comments"]["Row"];
export type MarketingContentRow =
  Database["public"]["Tables"]["marketing_contents"]["Row"];
