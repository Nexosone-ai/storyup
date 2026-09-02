# STORYUP

**당신의 이야기를 비즈니스로 — Turn Your Story Into Business**

AI 기반 비즈니스 브랜딩 · 홈페이지 · 콘텐츠 마케팅 SaaS (MVP).

사용자는 사업에 대한 몇 가지 질문에 답하는 것만으로
**Business Story → Brand → Website → Blog → Marketing** 으로 발전시킬 수 있습니다.

## 기술 스택

- **Next.js 16** (App Router) · React 19 · TypeScript
- **Tailwind CSS v4**
- **Supabase** (PostgreSQL · Auth · RLS)
- **Anthropic Claude** (AI Provider Layer로 분리)
- 배포: Vercel

## 빠른 시작

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수

`.env.local` 을 열어 값을 채웁니다. (템플릿은 `.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-5
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- Supabase: 프로젝트 → Settings → API 에서 URL / anon / service_role 키
- Anthropic: https://console.anthropic.com/settings/keys

### 3. 데이터베이스 마이그레이션

Supabase 대시보드의 **SQL Editor** 에 `supabase/migrations/0001_init.sql`
전체를 붙여넣고 실행합니다. (테이블 · RLS · 트리거 생성)

> Supabase Auth 설정에서 개발 편의를 위해 **"Confirm email"** 을 꺼두면
> 회원가입 직후 바로 로그인됩니다. (켜두면 확인 메일 링크가 필요)

### 4. 데모 데이터 (선택)

CAFE MOMENT 데모 비즈니스를 한 번에 생성합니다.

```bash
npm run seed
```

- 로그인: `demo@storyup.app` / `storyup1234`
- 공개 홈페이지: `/site/cafe-moment`
- 블로그 글: `/site/cafe-moment/blog/strawberry-cake`

### 5. 실행

```bash
npm run dev
```

http://localhost:3000

## 검증

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run build      # 프로덕션 빌드
```

## 전체 사용자 흐름

회원가입 → 대시보드 → **새 비즈니스 만들기** (6단계 AI 인터뷰) →
AI 브랜드 스토리 생성 → AI 홈페이지 생성 → 편집 → **게시** →
AI 블로그 글 생성 → 편집 → **게시** → SNS 마케팅 콘텐츠 생성.

## 구조

```
src/
  app/
    (marketing)/         랜딩
    (auth)/              로그인 · 회원가입 · 비밀번호 재설정
    auth/callback/       이메일 링크 처리
    dashboard/           대시보드 · 비즈니스 목록 · 설정
    onboarding/          6단계 인터뷰 위저드
    business/[id]/       워크스페이스 (개요·브랜드·홈페이지·블로그·마케팅·애널리틱스)
    site/[slug]/         공개 홈페이지 + /blog + /blog/[postSlug]
    api/ai/{brand,website,blog,marketing}/   Claude 호출 (서버 전용)
  components/{ui,marketing,auth,dashboard,onboarding,ai,website,blog,marketing}
  lib/
    supabase/{client,server,middleware}
    ai/{provider,claude,index} + prompts/*     AI Provider Layer
  types/{database,domain}
  utils/{slug,seo,markdown,cn}
supabase/migrations/0001_init.sql
scripts/seed.mjs
```

### AI Provider Layer

모든 Claude 호출은 서버에서만 실행되며 `AIProvider` 인터페이스 뒤에 있습니다
(`src/lib/ai/provider.ts`). 다른 모델이나 SNS API를 추가할 때 호출부 변경 없이
새 Provider 구현만 추가하면 됩니다. 프롬프트는 `src/lib/ai/prompts/` 에서 관리합니다.

## Phase 2 (MVP 제외)

Custom Domain · SNS 자동 포스팅 · 결제/구독 · 팀 계정 · 고급 애널리틱스 ·
Drag & Drop 빌더 · AI 이미지 생성. (Architecture는 확장을 고려해 설계됨)
