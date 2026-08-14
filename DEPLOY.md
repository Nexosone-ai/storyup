# Deploying STORYUP to Vercel

## 1. Import the repo
1. https://vercel.com/dashboard → **Add New → Project**
2. Import **`Nexosone-ai/storyup`**
3. Framework preset: **Next.js** (auto-detected). Leave build/output defaults.

## 2. Environment Variables
Add these in the Vercel import screen (**Environment Variables**), using your
**real** values from your local `.env.local` (NOT the placeholders):

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project>.supabase.co` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_…` | publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_…` | **server-only secret** |
| `ANTHROPIC_API_KEY` | `sk-ant-…` | server-only |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | optional |
| `IMAGE_PROVIDER` | `pollinations` | free; or `fal`/`gemini` |
| `FAL_KEY` | `…` | only if using fal (funded) |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` | set after first deploy, then redeploy |

> `NEXT_PUBLIC_SITE_URL` is a chicken-and-egg value: deploy once, copy the
> Vercel domain, set this var to it, then **Redeploy** so SEO/OG URLs and auth
> redirects are correct.

## 3. Deploy
Click **Deploy**. When it finishes, open the URL from the **Deployments** tab
(the **Visit** button) — do not guess the URL.

## 4. Point Supabase at production
Supabase → **Authentication → URL Configuration**:
- **Site URL**: your Vercel domain
- **Redirect URLs**: add `https://<your-app>.vercel.app/auth/callback`

This makes email confirmation & password-reset links work in production.

## 5. Verify
- `/` landing loads
- Sign up / log in works (email confirmation setting respected)
- `/site/cafe-moment` public page renders (after seeding prod DB — run
  `npm run seed` locally against the same Supabase project, or create a
  business through the app)

## Notes
- The DB schema must already exist in the Supabase project
  (`supabase/migrations/0001_init.sql`).
- Image generation defaults to free Pollinations; switch `IMAGE_PROVIDER` to
  `fal` (funded) for higher quality.
