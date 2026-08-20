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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string | null;
          email?: string | null;
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
          status?: PublishStatus;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["blog_posts"]["Insert"]>;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          author_name?: string;
          content: string;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Convenience row aliases used across the app.
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];
export type BrandProfileRow =
  Database["public"]["Tables"]["brand_profiles"]["Row"];
export type WebsiteRow = Database["public"]["Tables"]["websites"]["Row"];
export type BlogPostRow = Database["public"]["Tables"]["blog_posts"]["Row"];
export type MarketingContentRow =
  Database["public"]["Tables"]["marketing_contents"]["Row"];
