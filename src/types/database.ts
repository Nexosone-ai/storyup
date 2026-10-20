import type {
  WebsiteContent,
  PublishStatus,
  MarketingStrategyResult,
  BlogFaqItem,
  BlogSeoAnalysisCache,
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
          /** 환영 가이드 확인 시각 (0036). null = 아직 안 봄 */
          onboarded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string | null;
          email?: string | null;
          is_admin?: boolean;
          referral_code?: string | null;
          onboarded_at?: string | null;
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
          /** 블로그 카테고리 관리 목록 (0054). 글의 category와 별개로 유지된다. */
          blog_categories: string[];
        } & Timestamps;
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          category: string;
          industry?: string | null;
          blog_categories?: string[];
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
      custom_domains: {
        Row: {
          id: string;
          business_id: string;
          domain: string;
          status: "pending" | "active" | "error";
          created_at: string;
          verified_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          domain: string;
          status?: "pending" | "active" | "error";
          created_at?: string;
          verified_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["custom_domains"]["Insert"]>;
        Relationships: [];
      };
      marketing_strategies: {
        Row: {
          id: string;
          business_id: string;
          content: MarketingStrategyResult;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          content: MarketingStrategyResult;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["marketing_strategies"]["Insert"]
        >;
        Relationships: [];
      };
      /** 회원탈퇴 대장(0046) — 보존된 결제 기록의 소비자 식별용. service_role 전용. */
      account_deletions: {
        Row: {
          id: string;
          user_id: string;
          email: string | null;
          name: string | null;
          reason: string | null;
          had_payments: boolean;
          deleted_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email?: string | null;
          name?: string | null;
          reason?: string | null;
          had_payments?: boolean;
          deleted_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["account_deletions"]["Insert"]
        >;
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          owner_user_id: string;
          member_user_id: string | null;
          invited_email: string;
          status: "pending" | "active";
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          member_user_id?: string | null;
          invited_email: string;
          status?: "pending" | "active";
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["team_members"]["Insert"]
        >;
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
          /** AEO FAQ (0043). Pro 이상에서 생성 — 공개 글에 FAQPage 구조화 데이터로 노출. */
          faq: BlogFaqItem[];
          /** 글별 SEO 진단·보강 AI 분석 캐시 (0076). 유료 플랜. */
          seo_analysis: BlogSeoAnalysisCache | null;
          seo_analyzed_at: string | null;
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
          faq?: BlogFaqItem[];
          seo_analysis?: BlogSeoAnalysisCache | null;
          seo_analyzed_at?: string | null;
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
          reservation_enabled: boolean;
          reservation_title: string | null;
          reservation_desc: string | null;
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
          reservation_enabled?: boolean;
          reservation_title?: string | null;
          reservation_desc?: string | null;
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
      reservation_requests: {
        Row: {
          id: string;
          event_id: string;
          business_id: string;
          name: string;
          phone: string;
          party_size: number | null;
          desired_date: string | null;
          desired_time: string | null;
          note: string | null;
          status: "pending" | "confirmed" | "cancelled";
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          business_id: string;
          name: string;
          phone: string;
          party_size?: number | null;
          desired_date?: string | null;
          desired_time?: string | null;
          note?: string | null;
          status?: "pending" | "confirmed" | "cancelled";
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["reservation_requests"]["Insert"]
        >;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          business_id: string | null;
          type:
            | "blog_comment"
            | "blog_like"
            | "site_inquiry"
            | "coupon_claim"
            | "sub_expiring"
            | "reservation";
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
          type:
            | "blog_comment"
            | "blog_like"
            | "site_inquiry"
            | "coupon_claim"
            | "sub_expiring"
            | "reservation";
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
          thanks_count: number;
          view_count: number;
          share_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          blog_post_id?: string | null;
          platform: string;
          content: string;
          thanks_count?: number;
          view_count?: number;
          share_count?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["marketing_contents"]["Insert"]
        >;
        Relationships: [];
      };
      card_shares: {
        Row: {
          id: string;
          card_id: string;
          channel: string;
          visitor_key: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          channel?: string;
          visitor_key?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["card_shares"]["Insert"]
        >;
        Relationships: [];
      };
      agent_conversations: {
        Row: {
          id: string;
          business_id: string;
          user_id: string | null;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id?: string | null;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["agent_conversations"]["Insert"]
        >;
        Relationships: [];
      };
      agent_messages: {
        Row: {
          id: string;
          conversation_id: string;
          business_id: string;
          role: "user" | "assistant";
          content: string;
          tool_json: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          business_id: string;
          role: "user" | "assistant";
          content?: string;
          tool_json?: Json | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["agent_messages"]["Insert"]
        >;
        Relationships: [];
      };
      agent_memories: {
        Row: {
          id: string;
          business_id: string;
          kind: string;
          content: string;
          source: string | null;
          superseded: boolean;
          embedding: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          kind?: string;
          content: string;
          source?: string | null;
          superseded?: boolean;
          embedding?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["agent_memories"]["Insert"]
        >;
        Relationships: [];
      };
      agent_proposals: {
        Row: {
          id: string;
          conversation_id: string | null;
          business_id: string;
          action: string;
          params: Json;
          status: "pending" | "approved" | "done" | "rejected" | "failed";
          result: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id?: string | null;
          business_id: string;
          action: string;
          params?: Json;
          status?: "pending" | "approved" | "done" | "rejected" | "failed";
          result?: Json | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["agent_proposals"]["Insert"]
        >;
        Relationships: [];
      };
      agent_routines: {
        Row: {
          id: string;
          business_id: string;
          kind: "blog" | "cardnews" | "facebook";
          cadence: "daily" | "weekly" | "biweekly" | "monthly";
          params: Json;
          enabled: boolean;
          autonomy: "propose" | "auto";
          max_per_day: number;
          monthly_cap: number;
          quiet_start: number | null;
          quiet_end: number | null;
          next_run_at: string;
          last_run_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          kind: "blog" | "cardnews" | "facebook";
          cadence?: "daily" | "weekly" | "biweekly" | "monthly";
          params?: Json;
          enabled?: boolean;
          autonomy?: "propose" | "auto";
          max_per_day?: number;
          monthly_cap?: number;
          quiet_start?: number | null;
          quiet_end?: number | null;
          next_run_at?: string;
          last_run_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["agent_routines"]["Insert"]
        >;
        Relationships: [];
      };
      agent_run_logs: {
        Row: {
          id: string;
          business_id: string;
          routine_id: string | null;
          action: string;
          status: string;
          detail: Json | null;
          charged: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          routine_id?: string | null;
          action: string;
          status: string;
          detail?: Json | null;
          charged?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["agent_run_logs"]["Insert"]
        >;
        Relationships: [];
      };
      partner_clients: {
        Row: {
          id: string;
          partner_user_id: string;
          client_user_id: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          partner_user_id: string;
          client_user_id: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["partner_clients"]["Insert"]
        >;
        Relationships: [];
      };
      partner_credit_ledger: {
        Row: {
          id: string;
          partner_user_id: string;
          amount: number;
          reason: string | null;
          ref_type: string | null;
          ref_business_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          partner_user_id: string;
          amount: number;
          reason?: string | null;
          ref_type?: string | null;
          ref_business_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["partner_credit_ledger"]["Insert"]
        >;
        Relationships: [];
      };
      partner_credit_prices: {
        Row: {
          action: string;
          label: string;
          credits: number;
          active: boolean;
          updated_at: string;
        };
        Insert: {
          action: string;
          label: string;
          credits?: number;
          active?: boolean;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["partner_credit_prices"]["Insert"]
        >;
        Relationships: [];
      };
      agency_services: {
        Row: {
          key: string;
          label: string;
          description: string | null;
          supply_price_krw: number;
          active: boolean;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          key: string;
          label: string;
          description?: string | null;
          supply_price_krw?: number;
          active?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["agency_services"]["Insert"]
        >;
        Relationships: [];
      };
      agency_inquiries: {
        Row: {
          id: string;
          business_id: string;
          client_user_id: string;
          partner_user_id: string | null;
          service_key: string;
          message: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          client_user_id: string;
          partner_user_id?: string | null;
          service_key: string;
          message?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["agency_inquiries"]["Insert"]
        >;
        Relationships: [];
      };
      agency_messages: {
        Row: {
          id: string;
          inquiry_id: string;
          sender_user_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          inquiry_id: string;
          sender_user_id: string;
          body: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["agency_messages"]["Insert"]
        >;
        Relationships: [];
      };
      agency_quotes: {
        Row: {
          id: string;
          inquiry_id: string | null;
          partner_user_id: string;
          service_key: string;
          supply_price_krw: number;
          client_price_krw: number;
          margin_krw: number;
          code: string;
          status: string;
          order_id: string | null;
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          inquiry_id?: string | null;
          partner_user_id: string;
          service_key: string;
          supply_price_krw: number;
          client_price_krw: number;
          margin_krw?: number;
          code: string;
          status?: string;
          order_id?: string | null;
          created_at?: string;
          expires_at?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["agency_quotes"]["Insert"]
        >;
        Relationships: [];
      };
      agency_deliverables: {
        Row: {
          id: string;
          business_id: string;
          inquiry_id: string | null;
          kind: string;
          title: string | null;
          url: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          inquiry_id?: string | null;
          kind?: string;
          title?: string | null;
          url: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["agency_deliverables"]["Insert"]
        >;
        Relationships: [];
      };
      partner_earnings: {
        Row: {
          id: string;
          partner_user_id: string;
          quote_id: string | null;
          amount_krw: number;
          status: string;
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          partner_user_id: string;
          quote_id?: string | null;
          amount_krw: number;
          status?: string;
          paid_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["partner_earnings"]["Insert"]
        >;
        Relationships: [];
      };
      video_credit_ledger: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          reason: string | null;
          ref_type: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          reason?: string | null;
          ref_type?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["video_credit_ledger"]["Insert"]
        >;
        Relationships: [];
      };
      video_jobs: {
        Row: {
          id: string;
          user_id: string;
          business_id: string;
          prompt: string;
          status: "processing" | "done" | "failed";
          request_id: string | null;
          status_url: string | null;
          response_url: string | null;
          video_url: string | null;
          error: string | null;
          /** 제출 시 선차감한 UP(0077). 실패 시 환급 대상. */
          charged: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          business_id: string;
          prompt: string;
          status?: "processing" | "done" | "failed";
          request_id?: string | null;
          status_url?: string | null;
          response_url?: string | null;
          video_url?: string | null;
          error?: string | null;
          charged?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["video_jobs"]["Insert"]>;
        Relationships: [];
      };
      account_shares: {
        Row: {
          id: string;
          owner_user_id: string;
          partner_email: string;
          partner_user_id: string | null;
          status: "pending" | "accepted" | "revoked";
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          partner_email: string;
          partner_user_id?: string | null;
          status?: "pending" | "accepted" | "revoked";
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["account_shares"]["Insert"]>;
        Relationships: [];
      };
      designer_permissions: {
        Row: {
          user_id: string;
          granted_by: string | null;
          status: "active" | "revoked";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          granted_by?: string | null;
          status?: "active" | "revoked";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["designer_permissions"]["Insert"]>;
        Relationships: [];
      };
      design_skills: {
        Row: {
          id: string;
          owner_user_id: string;
          key: string;
          title: string;
          status: "draft" | "active" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          key: string;
          title?: string;
          status?: "draft" | "active" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["design_skills"]["Insert"]>;
        Relationships: [];
      };
      skill_versions: {
        Row: {
          id: string;
          skill_id: string;
          version: string;
          manifest: Record<string, unknown>;
          tokens: Record<string, unknown>;
          page_schema: Record<string, unknown>;
          slots: unknown[];
          sample_content: Record<string, unknown>;
          checks: Record<string, unknown>;
          status: "draft" | "active" | "archived";
          created_at: string;
        };
        Insert: {
          id?: string;
          skill_id: string;
          version: string;
          manifest?: Record<string, unknown>;
          tokens?: Record<string, unknown>;
          page_schema?: Record<string, unknown>;
          slots?: unknown[];
          sample_content?: Record<string, unknown>;
          checks?: Record<string, unknown>;
          status?: "draft" | "active" | "archived";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["skill_versions"]["Insert"]>;
        Relationships: [];
      };
      design_templates: {
        Row: {
          id: string;
          owner_user_id: string;
          skill_id: string | null;
          title: string;
          status: "draft" | "active" | "suspended" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          skill_id?: string | null;
          title?: string;
          status?: "draft" | "active" | "suspended" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["design_templates"]["Insert"]>;
        Relationships: [];
      };
      template_versions: {
        Row: {
          id: string;
          template_id: string;
          version: number;
          page_schema: Record<string, unknown>;
          tokens: Record<string, unknown>;
          /** V2 전문 편집 문서(0082). null이면 page_schema(V1)에서 변환. */
          document: Record<string, unknown> | null;
          status:
            | "draft"
            | "submitted"
            | "approved"
            | "published"
            | "rejected"
            | "suspended"
            | "archived";
          created_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          version?: number;
          page_schema?: Record<string, unknown>;
          tokens?: Record<string, unknown>;
          document?: Record<string, unknown> | null;
          status?:
            | "draft"
            | "submitted"
            | "approved"
            | "published"
            | "rejected"
            | "suspended"
            | "archived";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["template_versions"]["Insert"]>;
        Relationships: [];
      };
      youtube_connections: {
        Row: {
          user_id: string;
          refresh_token: string;
          channel_id: string | null;
          channel_title: string | null;
          scope: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          refresh_token?: string;
          channel_id?: string | null;
          channel_title?: string | null;
          scope?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["youtube_connections"]["Insert"]
        >;
        Relationships: [];
      };
      social_connections: {
        Row: {
          id: string;
          user_id: string | null;
          business_id: string;
          provider: "facebook_page" | "youtube";
          external_id: string;
          display_name: string | null;
          access_token: string | null;
          refresh_token: string | null;
          token_expires_at: string | null;
          scope: string | null;
          meta: Json | null;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          business_id: string;
          provider: "facebook_page" | "youtube";
          external_id: string;
          display_name?: string | null;
          access_token?: string | null;
          refresh_token?: string | null;
          token_expires_at?: string | null;
          scope?: string | null;
          meta?: Json | null;
          enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["social_connections"]["Insert"]
        >;
        Relationships: [];
      };
      social_posts: {
        Row: {
          id: string;
          business_id: string;
          provider: string;
          status: "pending" | "posted" | "failed";
          message: string | null;
          link: string | null;
          media_url: string | null;
          external_post_id: string | null;
          scheduled_at: string | null;
          posted_at: string | null;
          error: string | null;
          source: "manual" | "autopilot";
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          provider: string;
          status?: "pending" | "posted" | "failed";
          message?: string | null;
          link?: string | null;
          media_url?: string | null;
          external_post_id?: string | null;
          scheduled_at?: string | null;
          posted_at?: string | null;
          error?: string | null;
          source?: "manual" | "autopilot";
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["social_posts"]["Insert"]
        >;
        Relationships: [];
      };
      test_accounts: {
        Row: {
          id: string;
          user_id: string;
          email: string | null;
          label: string | null;
          expires_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email?: string | null;
          label?: string | null;
          expires_at?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["test_accounts"]["Insert"]
        >;
        Relationships: [];
      };
      free_grants: {
        Row: {
          id: string;
          user_id: string;
          status: "active" | "pending" | "rejected";
          period_start: string | null;
          period_end: string | null;
          requested_at: string | null;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: "active" | "pending" | "rejected";
          period_start?: string | null;
          period_end?: string | null;
          requested_at?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["free_grants"]["Insert"]
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
          /** 지급 영상 크레딧 (0074) */
          grants_video_credits: number;
          /** 결제 시 소유권을 줄 템플릿 버전 id (0084). null = 템플릿 판매 아님 */
          grants_template_version: string | null;
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
          grants_video_credits?: number;
          grants_template_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      template_listings: {
        Row: {
          id: string;
          template_id: string;
          version_id: string;
          designer_user_id: string;
          product_id: string | null;
          title: string;
          summary: string | null;
          price_krw: number;
          commission_pct: number;
          status: "active" | "paused";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          version_id: string;
          designer_user_id: string;
          product_id?: string | null;
          title?: string;
          summary?: string | null;
          price_krw: number;
          commission_pct?: number;
          status?: "active" | "paused";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["template_listings"]["Insert"]>;
        Relationships: [];
      };
      template_sales: {
        Row: {
          id: string;
          buyer_user_id: string | null;
          buyer_email: string | null;
          listing_id: string | null;
          template_version_id: string | null;
          order_id: string;
          amount_krw: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          buyer_user_id?: string | null;
          buyer_email?: string | null;
          listing_id?: string | null;
          template_version_id?: string | null;
          order_id: string;
          amount_krw: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["template_sales"]["Insert"]>;
        Relationships: [];
      };
      designer_earnings: {
        Row: {
          id: string;
          designer_user_id: string;
          purchase_id: string | null;
          listing_id: string | null;
          gross_krw: number;
          commission_pct: number;
          net_krw: number;
          status: "pending" | "paid";
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          designer_user_id: string;
          purchase_id?: string | null;
          listing_id?: string | null;
          gross_krw: number;
          commission_pct: number;
          net_krw: number;
          status?: "pending" | "paid";
          paid_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["designer_earnings"]["Insert"]>;
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
          rank_at_sale: string | null;
          role_at_sale: string | null;
          seller_user_id: string | null;
          pool_amount: number | null;
          rate_pct: number | null;
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
          rank_at_sale?: string | null;
          role_at_sale?: string | null;
          seller_user_id?: string | null;
          pool_amount?: number | null;
          rate_pct?: number | null;
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
      network_members: {
        Row: {
          user_id: string;
          role: string;
          parent_id: string | null;
          distributor_id: string;
          status: string;
          split_distributor: number;
          split_agency: number;
          split_reseller: number;
          payout_type: string;
          bank_name: string | null;
          bank_account: string | null;
          account_holder: string | null;
          tax_id: string | null;
          memo: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          role: string;
          parent_id?: string | null;
          distributor_id: string;
          status?: string;
          split_distributor?: number;
          split_agency?: number;
          split_reseller?: number;
          payout_type?: string;
          bank_name?: string | null;
          bank_account?: string | null;
          account_holder?: string | null;
          tax_id?: string | null;
          memo?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["network_members"]["Insert"]
        >;
        Relationships: [];
      };
      distributor_rates: {
        Row: {
          id: string;
          distributor_user_id: string;
          item_type: string;
          item_key: string;
          rate_pct: number;
          active: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          distributor_user_id: string;
          item_type: string;
          item_key: string;
          rate_pct?: number;
          active?: boolean;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["distributor_rates"]["Insert"]
        >;
        Relationships: [];
      };
      ad_wallet_tx: {
        Row: {
          id: string;
          business_id: string;
          amount: number;
          reason: string | null;
          ref_type: string | null;
          ref_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          amount: number;
          reason?: string | null;
          ref_type?: string | null;
          ref_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ad_wallet_tx"]["Insert"]>;
        Relationships: [];
      };
      ad_deposit_orders: {
        Row: {
          id: string;
          business_id: string;
          order_id: string;
          amount: number;
          currency: string;
          status: string;
          payment_key: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          order_id: string;
          amount: number;
          currency?: string;
          status?: string;
          payment_key?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["ad_deposit_orders"]["Insert"]
        >;
        Relationships: [];
      };
      ad_campaigns: {
        Row: {
          id: string;
          business_id: string;
          type: string;
          name: string;
          creative: Json;
          target_url: string;
          bid_amount: number;
          total_budget: number;
          spent: number;
          status: string;
          industry: string | null;
          review_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          type?: string;
          name: string;
          creative?: Json;
          target_url: string;
          bid_amount: number;
          total_budget: number;
          spent?: number;
          status?: string;
          industry?: string | null;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ad_campaigns"]["Insert"]>;
        Relationships: [];
      };
      ad_placements: {
        Row: {
          id: string;
          campaign_id: string;
          business_id: string;
          blogger_user_id: string;
          slots: string[];
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          business_id: string;
          blogger_user_id: string;
          slots?: string[];
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ad_placements"]["Insert"]>;
        Relationships: [];
      };
      ad_clicks: {
        Row: {
          id: string;
          placement_id: string;
          campaign_id: string;
          advertiser_business_id: string;
          blogger_user_id: string;
          visitor_key: string;
          charged: boolean;
          amount: number;
          fee_amount: number;
          blogger_amount: number;
          click_day: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          placement_id: string;
          campaign_id: string;
          advertiser_business_id: string;
          blogger_user_id: string;
          visitor_key: string;
          charged?: boolean;
          amount?: number;
          fee_amount?: number;
          blogger_amount?: number;
          click_day?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ad_clicks"]["Insert"]>;
        Relationships: [];
      };
      ad_impressions: {
        Row: {
          id: string;
          placement_id: string;
          campaign_id: string;
          visitor_key: string | null;
          imp_day: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          placement_id: string;
          campaign_id: string;
          visitor_key?: string | null;
          imp_day?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ad_impressions"]["Insert"]>;
        Relationships: [];
      };
      ad_earnings: {
        Row: {
          id: string;
          blogger_user_id: string;
          business_id: string;
          campaign_id: string | null;
          placement_id: string | null;
          event_type: string;
          ref_id: string | null;
          amount: number;
          status: string;
          settlement_id: string | null;
          occurred_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          blogger_user_id: string;
          business_id: string;
          campaign_id?: string | null;
          placement_id?: string | null;
          event_type?: string;
          ref_id?: string | null;
          amount?: number;
          status?: string;
          settlement_id?: string | null;
          occurred_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ad_earnings"]["Insert"]>;
        Relationships: [];
      };
      ad_settlements: {
        Row: {
          id: string;
          blogger_user_id: string;
          period: string;
          gross: number;
          tax: number;
          net: number;
          earning_count: number;
          status: string;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          blogger_user_id: string;
          period: string;
          gross?: number;
          tax?: number;
          net?: number;
          earning_count?: number;
          status?: string;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ad_settlements"]["Insert"]>;
        Relationships: [];
      };
      ad_settings: {
        Row: {
          id: number;
          platform_fee_pct: number;
          updated_at: string;
        };
        Insert: {
          id?: number;
          platform_fee_pct?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ad_settings"]["Insert"]>;
        Relationships: [];
      };
      ad_leads: {
        Row: {
          id: string;
          campaign_id: string;
          placement_id: string | null;
          advertiser_business_id: string;
          blogger_user_id: string;
          name: string;
          phone: string;
          message: string | null;
          charged: boolean;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          placement_id?: string | null;
          advertiser_business_id: string;
          blogger_user_id: string;
          name: string;
          phone: string;
          message?: string | null;
          charged?: boolean;
          amount?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ad_leads"]["Insert"]>;
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
          base_price_krw: number | null;
          work_status: string | null;
          history: string | null;
          status: string;
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
          base_price_krw?: number | null;
          work_status?: string | null;
          history?: string | null;
          status?: string;
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
          /** 자동갱신 청구용 결제자 정보 (0048) — 이니시스 빌링키 결제 필수 */
          buyer_name: string | null;
          buyer_email: string | null;
          buyer_phone: string | null;
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
          buyer_name?: string | null;
          buyer_email?: string | null;
          buyer_phone?: string | null;
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
      announcements: {
        Row: {
          id: string;
          title: string;
          body: string;
          image_url: string | null;
          link_url: string | null;
          link_label: string | null;
          starts_at: string;
          ends_at: string;
          active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body: string;
          image_url?: string | null;
          link_url?: string | null;
          link_label?: string | null;
          starts_at: string;
          ends_at: string;
          active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["announcements"]["Insert"]
        >;
        Relationships: [];
      };
      integrity_reports: {
        Row: {
          id: string;
          created_at: string;
          source: string;
          ok: boolean;
          issues: number;
          report: Json;
        };
        Insert: {
          id?: string;
          created_at?: string;
          source?: string;
          ok: boolean;
          issues?: number;
          report: Json;
        };
        Update: Partial<
          Database["public"]["Tables"]["integrity_reports"]["Insert"]
        >;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["push_subscriptions"]["Insert"]
        >;
        Relationships: [];
      };
      reminder_log: {
        Row: {
          id: string;
          user_id: string;
          channel: string;
          dedup_key: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          channel: string;
          dedup_key: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["reminder_log"]["Insert"]
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
          meta: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          reward_key: string;
          rule: string;
          up?: number;
          meta?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reward_events"]["Insert"]>;
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
      match_agent_memories: {
        Args: { p_business: string; p_query: string; p_count?: number };
        Returns: { content: string; similarity: number }[];
      };
      spend_partner_credits: {
        Args: {
          p_partner: string;
          p_amount: number;
          p_reason: string;
          p_ref_business?: string | null;
        };
        Returns: number;
      };
      bump_card_thanks: {
        Args: { p_id: string };
        Returns: number;
      };
      bump_card_view: {
        Args: { p_id: string };
        Returns: number;
      };
      bump_card_share: {
        Args: { p_id: string; p_channel: string; p_visitor: string | null };
        Returns: number;
      };
      active_custom_domain_for: {
        Args: { p_business_id: string };
        Returns: string | null;
      };
      account_owner_id: {
        Args: { p_user: string };
        Returns: string;
      };
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
      ad_wallet_spend: {
        Args: {
          p_business: string;
          p_amount: number;
          p_reason: string;
          p_ref_type: string | null;
          p_ref_id: string | null;
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
      integrity_report: {
        Args: Record<string, never>;
        Returns: Json;
      };
      admin_point_totals: {
        Args: Record<string, never>;
        Returns: {
          type: string;
          cnt: number;
          total: number;
          pos: number;
          neg: number;
        }[];
      };
      admin_referrer_stats: {
        Args: Record<string, never>;
        Returns: {
          referrer_user_id: string;
          referrer_name: string | null;
          referrer_email: string | null;
          signups: number;
          conversions: number;
        }[];
      };
      try_reserve_image_slot: {
        Args: {
          p_business: string;
          p_slot: string;
          p_limit: number;
        };
        Returns: boolean;
      };
      release_image_slot: {
        Args: {
          p_business: string;
          p_slot: string;
        };
        Returns: undefined;
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
export type AnnouncementRow =
  Database["public"]["Tables"]["announcements"]["Row"];
export type ProductOrderRow =
  Database["public"]["Tables"]["product_orders"]["Row"];
export type MarketerRow = Database["public"]["Tables"]["marketers"]["Row"];
export type MarketerRewardRow =
  Database["public"]["Tables"]["marketer_rewards"]["Row"];
export type MarketerCommissionRow =
  Database["public"]["Tables"]["marketer_commissions"]["Row"];
export type MarketerSettlementRow =
  Database["public"]["Tables"]["marketer_settlements"]["Row"];
export type NetworkMemberRow =
  Database["public"]["Tables"]["network_members"]["Row"];
export type DistributorRateRow =
  Database["public"]["Tables"]["distributor_rates"]["Row"];
export type AdCampaignRow = Database["public"]["Tables"]["ad_campaigns"]["Row"];
export type AdPlacementRow =
  Database["public"]["Tables"]["ad_placements"]["Row"];
export type AdEarningRow = Database["public"]["Tables"]["ad_earnings"]["Row"];
export type AdSettlementRow =
  Database["public"]["Tables"]["ad_settlements"]["Row"];
export type AdDepositOrderRow =
  Database["public"]["Tables"]["ad_deposit_orders"]["Row"];
export type AdLeadRow = Database["public"]["Tables"]["ad_leads"]["Row"];
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
export type ReservationRequestRow =
  Database["public"]["Tables"]["reservation_requests"]["Row"];
export type NotificationRow =
  Database["public"]["Tables"]["notifications"]["Row"];
export type MarketingContentRow =
  Database["public"]["Tables"]["marketing_contents"]["Row"];
