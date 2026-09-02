# STORYUP 인수인계 문서 (Next.js 버전)

**작성일:** 2026-08-24
**저장소:** https://github.com/Nexosone-ai/storyup (branch `main`)
**로컬 경로:** `D:\STORYUP` (노트북에서는 원하는 경로에 clone)
**최신 커밋:** `98bd2b2` (Phase 4 i18n)

> 이 문서는 **Next.js + Supabase + Anthropic** 로 새로 구축한 STORYUP MVP의 인수인계용 요약입니다.
> (Manus 버전과는 별개 코드베이스이며, Manus 버전의 기능을 이 버전으로 이식 완료했습니다.)

---

## 1. 제품 개요

소상공인·1인 사업자가 "자신의 이야기"를 입력하면 AI가 **브랜드 스토리 → 홈페이지 → 블로그 → SNS/카드뉴스 → 커뮤니티·마켓플레이스**로 확장해 주는 SaaS.
슬로건: **당신의 이야기를 비즈니스로 (Turn Your Story Into Business)**

## 2. 기술 스택

| 계층 | 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| 스타일 | Tailwind CSS v4 (디자인 토큰: `src/app/globals.css`) |
| DB / 인증 | Supabase (PostgreSQL, Auth, RLS, Storage) |
| AI 텍스트 | Anthropic Claude (`src/lib/ai/` — Provider 레이어) |
| AI 이미지 | 카드뉴스 배경/블로그: `src/lib/ai/image/`(Pollinations 무료 / fal / Gemini 전환식) |
| 배포 | Vercel (`storyup-two.vercel.app`) + GitHub |

## 3. 구현된 기능

### 코어 (초기 MVP)
| 영역 | 내용 | 경로 |
|---|---|---|
| 인증 | 이메일 회원가입/로그인/비번재설정, 미들웨어 라우트 가드 | `/login` `/signup` `/reset` |
| 온보딩 | 6단계 인터뷰 위저드 | `/onboarding` |
| AI 브랜드 스토리 | Claude 생성 + 편집 | `/business/[id]/brand` |
| 홈페이지 | **템플릿 3종(클래식/스플릿/미니멀) 선택 + 위지윅 인라인 편집 + 이미지 업로드/갤러리** | `/business/[id]/website` |
| 공개 사이트 | `/site/[slug]` + `/site/[slug]/blog` (SEO/OG 메타) | 로그인 불필요 |
| 블로그 | AI 생성 + 마크다운 에디터 + AI 커버 이미지 | `/business/[id]/blog` |
| 마케팅 | SNS 텍스트(IG/FB) + **카드뉴스 이미지(실제 AI 이미지)** | `/business/[id]/marketing` |
| 애널리틱스 | 기본 지표 | `/business/[id]/analytics` |

### 이식된 확장 기능 (Manus → Next.js)
| Phase | 기능 | 경로 |
|---|---|---|
| 1 | **커뮤니티** — 스토리 커넥트(피드) + 찐이야기(익명), 공감/삭제 | `/dashboard/community` |
| 2 | **발행 준비** — Blogger/티스토리/네이버 연결상태 + 채널별 Markdown 내보내기 + 예약 | `/business/[id]/publishing` |
| 3a | **포인트** — 원장/잔액/거래내역 + 출금요청, **관리자**(포인트 지급, 출금 승인/반려) | `/dashboard/points`, `/dashboard/admin` |
| 3b | **서포터즈** — 디자이너/영상/음악 프로필 + 프로젝트 의뢰(수락/거절/완료) | `/dashboard/supporters` |
| 3c | **프리미엄 템플릿** — 스토어(판매/구매, 포인트 결제, 플랫폼 수수료 20%) | `/dashboard/templates` |
| 4 | **KO/EN 다국어** — 공개 화면(랜딩/네비/인증/온보딩) 언어 전환 | 랜딩 상단 토글 |

## 4. 폴더 / 핵심 파일

```
src/
  app/
    (marketing)/page.tsx        랜딩 (i18n)
    (auth)/{login,signup,reset}  인증 화면 + actions.ts
    dashboard/
      page.tsx / layout.tsx      대시보드 + 사이드바(nav)
      community / points / admin / supporters / templates   (각 page.tsx + actions.ts)
    business/[id]/
      brand / website / blog / marketing / publishing / analytics
    site/[slug]/                 공개 사이트 + /blog
    api/ai/{brand,website,blog,marketing,card-news,card-image}/route.ts
    api/health/route.ts          env 진단(불리언만)
    actions/locale.ts            언어 쿠키 설정
  components/
    ui/ dashboard/ marketing/ auth/ onboarding/ ai/ blog/ cards/
    website/templates/           Classic/Split/Minimal + Editable(Text/Image)/Gallery
    community/ points/ admin/ supporters/ templates/ publishing/
  lib/
    supabase/{client,server,middleware}.ts
    ai/{provider,claude,index} + prompts/*  (텍스트)
    ai/image/{provider,gemini,fal,pollinations,index,prompt}  (이미지)
    queries.ts community.ts publishing.ts points.ts supporters.ts templates.ts i18n.ts
  types/{database,domain}.ts     (database.ts는 마이그레이션과 수기 동기화)
  utils/{slug,seo,markdown,cn,publishExport}.ts
supabase/migrations/0001~0006*.sql
scripts/seed.mjs                 CAFE MOMENT 데모 시드
serve.bat / autostart-*.bat      로컬 서버 실행 도우미(Windows)
DEPLOY.md                        Vercel 배포 가이드
```

## 5. 데이터베이스 마이그레이션 ⚠️ (신규 환경에서 순서대로 실행)

Supabase 대시보드 → **SQL Editor** 에서 각 파일 내용을 붙여넣고 실행. 전부 **idempotent**(재실행 안전).

```
0001_init.sql          기본 스키마 + RLS + 트리거 (profiles/businesses/brand/websites/blog/marketing)
0002_community.sql     커뮤니티
0003_publishing.sql    발행 준비
0004_points.sql        포인트/출금/관리자 (is_admin) — cto@nexosoneai.com, demo@storyup.app 자동 관리자 지정
0005_supporters.sql    서포터즈
0006_templates.sql     프리미엄 템플릿
```
> SQL 에디터에 붙여넣을 때 잘림 방지를 위해 **채팅이 아니라 파일에서 복사**하세요. 마지막 줄까지 들어갔는지 확인.
> Storage 버킷 `site-images`(공개)는 홈페이지 이미지 첫 업로드 시 서버가 자동 생성합니다.

## 6. 환경 변수 (`.env.local`)

`.env.local` 은 **git에 포함되지 않습니다.** 노트북으로 옮길 때 이 파일을 직접 복사하거나 아래 값을 다시 입력하세요. (양식은 `.env.example` 참고)

```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase → Settings → API (프로젝트 ref: wfzhzyqkelunwkjllbfm)
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # publishable 키 (sb_publishable_...)
SUPABASE_SERVICE_ROLE_KEY=       # secret 키 (sb_secret_...) — 서버 전용
ANTHROPIC_API_KEY=               # console.anthropic.com
ANTHROPIC_MODEL=claude-sonnet-5
IMAGE_PROVIDER=pollinations      # 무료. 또는 fal(잔액 필요) / gemini(과금 필요)
FAL_KEY=                         # fal 사용 시
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 7. 노트북에서 이어서 작업하는 절차

1. **Node 20+ (권장 22.x)** 설치 확인 (`node -v`).
2. 저장소 클론:
   ```bash
   git clone https://github.com/Nexosone-ai/storyup.git
   cd storyup
   npm install
   ```
3. `.env.local` 준비 (위 6번). 기존 PC에서 파일을 복사하는 게 가장 간단.
4. Supabase는 **같은 프로젝트**를 그대로 사용하면 마이그레이션 재실행 불필요(이미 적용됨). 새 프로젝트를 쓴다면 5번의 0001~0006을 순서대로 실행 후 `npm run seed`.
5. 실행:
   ```bash
   npm run dev        # http://localhost:3000
   ```
   (Windows에서 PowerShell 스크립트 정책 오류 시 `npm.cmd run dev` 또는 `serve.bat` 더블클릭)
6. 검증:
   ```bash
   npm run typecheck   # tsc --noEmit
   npm run lint
   npm run build       # ⚠️ 서버 액션/클라이언트 경계 오류는 build에서만 잡힘
   ```

## 8. 배포 (Vercel)

- GitHub 저장소를 Vercel에 import → **Environment Variables 에 6번 값들을 Production으로 등록** → Redeploy.
- Supabase → Auth → URL Configuration 에 배포 도메인 `/auth/callback` 추가.
- 자세한 내용은 `DEPLOY.md`.
- 현재 상태: 빌드는 통과하나 **Vercel 환경변수 미등록 시 로그인/AI가 500** → 위 등록 필요. (로컬은 정상)

## 9. 데모 / 관리자 계정

- 데모 로그인: `demo@storyup.app` / `storyup1234`
- 관리자: `0004_points.sql` 이 `cto@nexosoneai.com`, `demo@storyup.app` 을 자동 관리자 지정
- 데모 사업체/공개 사이트: `/site/cafe-moment`

## 10. 알려진 이슈 / 후속 작업

1. **미들웨어 → proxy**: Next 16에서 `middleware.ts` deprecated 경고. 동작엔 지장 없음(추후 `proxy.ts` 로 이관 가능).
2. **대시보드 다국어**: i18n은 공개 화면까지만. 대시보드 전체 EN 화는 후속.
3. **구매한 프리미엄 템플릿 적용**: 구매 기록만 저장, 홈페이지 에디터에 자동 적용은 미연동(후속).
4. **외부 블로그 실발행**: 현재 "발행 준비형"(연결상태 + Markdown 내보내기). Google OAuth 기반 Blogger 실발행 등은 후속.
5. **포인트 결제/정산**: 실제 충전·결제대행·정산계좌 검증은 미구현(관리자 수동 지급/출금 승인만).
6. **빌드 규칙**: `"use server"` 파일의 export는 모두 `async function` 이어야 함(화살표 const 금지) — 반드시 `npm run build` 로 확인.

## 11. 자주 쓰는 명령

```bash
npm run dev         # 개발 서버 (localhost:3000)
npm run build       # 프로덕션 빌드 검증
npm run typecheck   # 타입 검사
npm run lint        # 린트
npm run seed        # 데모 데이터(CAFE MOMENT) 생성 — .env.local 필요
```

---

이 문서는 현재 코드베이스(`main @ 98bd2b2`) 기준 요약입니다. 외부 채널/도메인/결제 연동 전에는 각 서비스의 최신 인증·약관 정책을 다시 확인하세요.
