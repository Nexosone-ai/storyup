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
          /** 추천 코드 (0016 마이그레이션 이전 DB에서는 없을 수 있음) */
          referral_code: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string | null;
          email?: string | null;
          is_admin?: boolean;
          referral_code?: string | null;
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
          /** 업종 대분류 id (0021 마이그레이션). null = 미설정 */
          industry: string | null;
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
          industry?: string | null;
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
          /** 공개 페이지 누적 조회수 (0015 마이그레이션 이전 DB에서는 없을 수 있음) */
          view_count: number;
          status: PublishStatus;
          published_at: string | null;
          /** 예약 발행 시각 (0024 마이그레이션 이전 DB에서는 없을 수 있음). draft + 미래값 = 예약 대기 */
          scheduled_at: string | null;
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
          view_count?: number;
          status?: PublishStatus;
          published_at?: string | null;
          scheduled_at?: string | null;
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
      blog_likes: {
        Row: {
          id: string;
          post_id: string;
          business_id: string;
          visitor_key: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          business_id: string;
          visitor_key: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["blog_likes"]["Insert"]>;
        Relationships: [];
      };
      site_inquiries: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          contact: string;
          kakao: string | null;
          message: string;
          // 0027: 블로그 이벤트 연락문의면 출처 글 id, 랜딩페이지 문의면 null
          blog_post_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          contact: string;
          kakao?: string | null;
          message: string;
          blog_post_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["site_inquiries"]["Insert"]
        >;
        Relationships: [];
      };
      blog_events: {
        Row: {
          id: string;
          post_id: string;
          business_id: string;
          coupon_enabled: boolean;
          coupon_benefit: string | null;
          coupon_issued_on: string | null;
          coupon_limit: number | null;
          coupon_valid_from: string | null;
          coupon_valid_until: string | null;
          contact_enabled: boolean;
          contact_title: string | null;
          contact_desc: string | null;
          comment_enabled: boolean;
          address_enabled: boolean;
          map_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          business_id: string;
          coupon_enabled?: boolean;
          coupon_benefit?: string | null;
          coupon_issued_on?: string | null;
          coupon_limit?: number | null;
          coupon_valid_from?: string | null;
          coupon_valid_until?: string | null;
          contact_enabled?: boolean;
          contact_title?: string | null;
          contact_desc?: string | null;
          comment_enabled?: boolean;
          address_enabled?: boolean;
          map_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["blog_events"]["Insert"]
        >;
        Relationships: [];
      };
      coupon_claims: {
        Row: {
          id: string;
          event_id: string;
          business_id: string;
          name: string;
          phone: string;
          code: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          business_id: string;
          name: string;
          phone: string;
          code: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["coupon_claims"]["Insert"]
        >;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          business_id: string | null;
          type: "blog_comment" | "blog_like" | "site_inquiry" | "coupon_claim";
          post_id: string | null;
          post_title: string | null;
          site_slug: string | null;
          post_slug: string | null;
          actor_name: string | null;
          preview: string | null;
          dedup_key: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          business_id?: string | null;
          type: "blog_comment" | "blog_like" | "site_inquiry" | "coupon_claim";
          post_id?: string | null;
          post_title?: string | null;
          site_slug?: string | null;
          post_slug?: string | null;
          actor_name?: string | null;
          preview?: string | null;
          dedup_key?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["notifications"]["Insert"]
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
      products: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          price: number;
          image_url: string | null;
          /** 상세(긴) 소개 이미지 (0026). null = 없음 */
          detail_image_url: string | null;
          active: boolean;
          sort_order: number;
          /** 결제 시 자동 지급할 구독 플랜 id (0025). null = 지급 없음 */
          grants_plan: string | null;
          /** 지급 기간(일) (0025) */
          grant_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          price: number;
          image_url?: string | null;
          detail_image_url?: string | null;
          active?: boolean;
          sort_order?: number;
          grants_plan?: string | null;
          grant_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      product_orders: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          amount: number;
          currency: string;
          buyer_name: string | null;
          buyer_phone: string | null;
          buyer_email: string | null;
          provider: string;
          payment_method: string | null;
          payment_key: string | null;
          transaction_id: string | null;
          status: string;
          ref_marketer_id: string | null;
          requested_at: string;
          approved_at: string | null;
          cancelled_at: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          amount: number;
          currency?: string;
          buyer_name?: string | null;
          buyer_phone?: string | null;
          buyer_email?: string | null;
          provider?: string;
          payment_method?: string | null;
          payment_key?: string | null;
          transaction_id?: string | null;
          status?: string;
          ref_marketer_id?: string | null;
          requested_at?: string;
          approved_at?: string | null;
          cancelled_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["product_orders"]["Insert"]
        >;
        Relationships: [];
      };
      marketers: {
        Row: {
          user_id: string;
          status: string;
          payout_type: string;
          rank: string;
          bank_name: string | null;
          bank_account: string | null;
          account_holder: string | null;
          tax_id: string | null;
          memo: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          status?: string;
          payout_type?: string;
          rank?: string;
          bank_name?: string | null;
          bank_account?: string | null;
          account_holder?: string | null;
          tax_id?: string | null;
          memo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["marketers"]["Insert"]>;
        Relationships: [];
      };
      marketer_rewards: {
        Row: {
          id: string;
          item_type: string;
          item_key: string;
          rank: string;
          reward_amount: number;
          active: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          item_type: string;
          item_key: string;
          rank: string;
          reward_amount?: number;
          active?: boolean;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["marketer_rewards"]["Insert"]
        >;
        Relationships: [];
      };
      marketer_commissions: {
        Row: {
          id: string;
          marketer_id: string;
          source_type: string;
          payment_id: string | null;
          product_order_id: string | null;
          client_user_id: string | null;
          item_key: string;
          item_label: string | null;
          rank_at_sale: string;
          gross_sale: number;
          amount: number;
          status: string;
          settlement_id: string | null;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          marketer_id: string;
          source_type: string;
          payment_id?: string | null;
          product_order_id?: string | null;
          client_user_id?: string | null;
          item_key: string;
          item_label?: string | null;
          rank_at_sale: string;
          gross_sale?: number;
          amount?: number;
          status?: string;
          settlement_id?: string | null;
          occurred_at?: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["marketer_commissions"]["Insert"]
        >;
        Relationships: [];
      };
      marketer_settlements: {
        Row: {
          id: string;
          marketer_id: string;
          period: string;
          payout_type: string;
          gross: number;
          tax: number;
          net: number;
          commission_count: number;
          status: string;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          marketer_id: string;
          period: string;
          payout_type: string;
          gross?: number;
          tax?: number;
          net?: number;
          commission_count?: number;
          status?: string;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["marketer_settlements"]["Insert"]
        >;
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
          /** PortOne 빌링키 (0017 이전 DB에서는 없을 수 있음) */
          billing_key: string | null;
          cancel_at_period_end: boolean;
          billing_failures: number;
          trial: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          plan?: string;
          status?: string;
          current_period_end?: string | null;
          billing_key?: string | null;
          cancel_at_period_end?: boolean;
          billing_failures?: number;
          trial?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["subscriptions"]["Insert"]
        >;
        Relationships: [];
      };
      bank_transfer_requests: {
        Row: {
          id: string;
          user_id: string;
          plan: string;
          amount: number;
          depositor_name: string;
          status: string;
          admin_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan: string;
          amount: number;
          depositor_name: string;
          status?: string;
          admin_note?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["bank_transfer_requests"]["Insert"]
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
      reward_events: {
        Row: {
          id: string;
          user_id: string;
          reward_key: string;
          rule: string;
          up: number;
          xp: number;
          meta: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          reward_key: string;
          rule: string;
          up?: number;
          xp?: number;
          meta?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reward_events"]["Insert"]>;
        Relationships: [];
      };
      user_xp: {
        Row: {
          user_id: string;
          xp: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          xp?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_xp"]["Insert"]>;
        Relationships: [];
      };
      activity_events: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          ref_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          ref_id?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["activity_events"]["Insert"]
        >;
        Relationships: [];
      };
      user_streaks: {
        Row: {
          user_id: string;
          current: number;
          longest: number;
          last_date: string | null;
          started: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          current?: number;
          longest?: number;
          last_date?: string | null;
          started?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_streaks"]["Insert"]>;
        Relationships: [];
      };
      user_achievements: {
        Row: {
          user_id: string;
          code: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          code: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["user_achievements"]["Insert"]
        >;
        Relationships: [];
      };
      referrals: {
        Row: {
          referred_user_id: string;
          referrer_user_id: string;
          code: string;
          paid_rewarded: boolean;
          created_at: string;
        };
        Insert: {
          referred_user_id: string;
          referrer_user_id: string;
          code: string;
          paid_rewarded?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["referrals"]["Insert"]>;
        Relationships: [];
      };
      reward_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["reward_settings"]["Insert"]
        >;
        Relationships: [];
      };
      search_stats: {
        Row: {
          user_id: string;
          impressions: number;
          clicks: number;
          checked_at: string;
        };
        Insert: {
          user_id: string;
          impressions?: number;
          clicks?: number;
          checked_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["search_stats"]["Insert"]>;
        Relationships: [];
      };
      story_score_history: {
        Row: {
          user_id: string;
          date: string;
          score: number;
          breakdown: Json | null;
        };
        Insert: {
          user_id: string;
          date: string;
          score: number;
          breakdown?: Json | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["story_score_history"]["Insert"]
        >;
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
      increment_blog_view: {
        Args: {
          p_business: string;
          p_slug: string;
        };
        Returns: undefined;
      };
      grant_reward: {
        Args: {
          p_user: string;
          p_key: string;
          p_rule: string;
          p_up: number;
          p_xp: number;
          p_reason: string;
        };
        Returns: boolean;
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
export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type ProductOrderRow =
  Database["public"]["Tables"]["product_orders"]["Row"];
export type MarketerRow = Database["public"]["Tables"]["marketers"]["Row"];
export type MarketerRewardRow =
  Database["public"]["Tables"]["marketer_rewards"]["Row"];
export type MarketerCommissionRow =
  Database["public"]["Tables"]["marketer_commissions"]["Row"];
export type MarketerSettlementRow =
  Database["public"]["Tables"]["marketer_settlements"]["Row"];
export type BusinessRow = Database["public"]["Tables"]["businesses"]["Row"];
export type BrandProfileRow =
  Database["public"]["Tables"]["brand_profiles"]["Row"];
export type WebsiteRow = Database["public"]["Tables"]["websites"]["Row"];
export type BlogPostRow = Database["public"]["Tables"]["blog_posts"]["Row"];
export type BlogCommentRow =
  Database["public"]["Tables"]["blog_comments"]["Row"];
export type BlogLikeRow = Database["public"]["Tables"]["blog_likes"]["Row"];
export type SiteInquiryRow =
  Database["public"]["Tables"]["site_inquiries"]["Row"];
export type BlogEventRow = Database["public"]["Tables"]["blog_events"]["Row"];
export type CouponClaimRow =
  Database["public"]["Tables"]["coupon_claims"]["Row"];
export type NotificationRow =
  Database["public"]["Tables"]["notifications"]["Row"];
export type MarketingContentRow =
  Database["public"]["Tables"]["marketing_contents"]["Row"];
