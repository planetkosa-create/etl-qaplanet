# ETL QAplanet Deployment

## Target

- App: ETL QAplanet
- Production URL: https://etl.qaplanet.ca
- DNS provider: IONOS
- Recommended Next.js host: Vercel
- Auth provider: Supabase
- Supabase URL: https://jsjirznjelewjqezpfan.supabase.co

## Recommended Hosting Path

1. Push this project to GitHub.
2. Import the GitHub repo into Vercel as a Next.js project.
   - Framework Preset: Next.js
   - Root Directory: project root
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: leave empty for Next.js
3. Add the production domain in Vercel:
   - `etl.qaplanet.ca`
4. In IONOS DNS, replace the existing webhosting records for the `etl` host with the DNS value that Vercel gives you.
   - Host: `etl`
   - Preferred type when no email is needed on `etl.qaplanet.ca`: `CNAME`
   - Preferred value: usually `cname.vercel-dns.com` or `cname.vercel-dns-0.com`, but use the exact value shown in the Vercel domain screen.
   - If email must remain active on `etl.qaplanet.ca`, use the Vercel-recommended `A` record from Project Settings > Domains instead of CNAME, because CNAME cannot coexist with MX/TXT records at the same host.
5. Keep the existing mail records if email for `etl.qaplanet.ca` is needed.
6. Wait for DNS propagation and SSL provisioning.

## IONOS DNS Notes

The screenshot currently shows `etl.qaplanet.ca` pointing to IONOS webhosting with:

- `A etl -> 74.208.236.241`
- `AAAA etl -> 2607:f1c0:100f:f000::0:0:2d4`
- `A www.etl -> 74.208.236.241`
- `AAAA www.etl -> 2607:f1c0:100f:f000::0:0:2d4`

For Vercel, the `etl` host should not keep the IONOS webhosting A/AAAA records. Replace the `etl` webhosting destination with Vercel DNS.

If `etl.qaplanet.ca` does not need email, remove the `etl` MX/TXT mail records too and use Vercel's CNAME.

If `etl.qaplanet.ca` must keep email, do not use CNAME for `etl`; use the Vercel-recommended A record so the existing MX/TXT records can stay. Add `www.etl` only if you want `www.etl.qaplanet.ca` to work too.

## Vercel Environment Variables

Add these in Vercel Project Settings > Environment Variables:

```text
NEXT_PUBLIC_SUPABASE_URL=https://jsjirznjelewjqezpfan.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-public-key
NEXT_PUBLIC_APP_URL=https://etl.qaplanet.ca
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4.1-mini
```

`SUPABASE_SERVICE_ROLE_KEY` is server-side only. Use it while Phase 2 does not have user auth wired yet, so the server API can write to the private `etl-artifacts` bucket and `etl_artifacts` table. Never create a `NEXT_PUBLIC_` service role variable.

## Supabase Phase 2 Setup

Run this SQL in Supabase SQL Editor:

```text
supabase/etl_artifacts.sql
```

It creates:

- `public.etl_artifacts`
- `etl-artifacts` private storage bucket
- authenticated-user RLS policies ready for the auth phase

For Phase 2 before auth is wired, set `SUPABASE_SERVICE_ROLE_KEY` in Vercel so the server-side upload API can write safely without exposing privileged keys to the browser.

## Supabase Phase 3 Setup

Run this SQL in Supabase SQL Editor after Phase 2 setup:

```text
supabase/etl_analysis_phase3.sql
```

It creates:

- `etl_analysis_runs`
- `etl_mapping_items`
- `etl_rule_items`
- `etl_data_quality_items`
- `etl_analysis_gaps`

Add `OPENAI_API_KEY` in Vercel before running AI analysis. The key is server-side only and must not be prefixed with `NEXT_PUBLIC_`.

## Supabase Auth Configuration

In Supabase Authentication > URL Configuration:

- Site URL: `https://etl.qaplanet.ca`
- Additional Redirect URLs:
  - `https://etl.qaplanet.ca/auth/callback`
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3002/auth/callback`

The anon public key is safe to use in the browser, but the service role key must never be added to the frontend or Vercel public variables.
