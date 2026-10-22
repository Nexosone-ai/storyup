# Tech editorial automation — integration checklist

This branch introduces scheduling configuration only; no production job is enabled.

## Intended workflow
1. Select fresh technology news from licensed feeds or allowed APIs; preserve original URLs and publication times.
2. Deduplicate canonical URLs and reject stories with fewer than two independently verifiable sources.
3. Generate Korean editorial copy with the existing AI provider, retaining citations and avoiding invented claims.
4. Generate a cover image using an approved image provider and store it in Supabase Storage.
5. Create the article using the existing blog draft pipeline, associated with the correct business and Tech category.
6. Publish to Storyup only after a dedicated service-account/business authorization, idempotency key, billing policy, and failure handling are configured.
7. Prepare a Naver-ready copy package (title, text, sources, image); Naver's official blog write API was retired May 2020, so do not claim automated Naver publication.

## Required before enabling
- Confirm the correct business_id and Tech category mapping for the requested Storyup account.
- Decide whether editorial automation incurs AI points, and ensure the user explicitly authorizes that charge.
- Configure a trusted news retrieval source, image generation provider, and storage bucket.
- Add a durable run ledger keyed by KST date + slot to avoid duplicate posts.
- Add a protected cron endpoint and schedule with UTC/KST conversion and runtime-limit considerations.
- Validate generated content, copyright/source attribution, failure retries, and production build.
- Add publication status and manual Naver handoff UI.
- Never commit credentials or automate bypass of Naver account security challenges.

## Status
Implementation scaffold only. No publishing has been activated.
