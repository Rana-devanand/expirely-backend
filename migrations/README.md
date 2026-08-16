# Database migrations

`npm run migrate` applies top-level `.sql` files in lexical order and records a SHA-256 checksum in `public.schema_migrations`. Applied files are immutable: make a new migration for every later change.

## Safe vendor rollout

1. Take a Supabase snapshot and verify restore access.
2. Run the migrations against a staging clone.
3. Deploy the backend with all vendor flags unset/false.
4. Verify login, product CRUD, household, location, notification, and community chat flows using the current production mobile build.
5. For an internal test build, set `ENABLE_VENDOR_ENTRY: true`; keep it false in public builds until rollout approval.
6. Set `ENABLE_VENDOR_MARKETPLACE=true`, `ENABLE_VENDOR_DISCOVERY=true`, and `ENABLE_VENDOR_EXTERNAL_DISCOVERY=true` only in the controlled backend environment.
7. After metrics are healthy, release a mobile build with the entry enabled for the intended production audience.

Geoapify external discovery is implemented server-side. Enable it only after adding `GEOAPIFY_API_KEY` and setting `ENABLE_VENDOR_EXTERNAL_DISCOVERY=true`. Searches remain DB-first; a grid area is refreshed only when missing/stale, concurrent refreshes are locked, failures back off, and claimed/pending stores are never overwritten. Results display the required Geoapify/OpenStreetMap attribution.

The default cache TTL is 72 hours. Override it with `VENDOR_DISCOVERY_CACHE_HOURS` (allowed range: 1–720 hours).

Do not relax `community_conversations.listing_id` in this rollout.

## Rollback

Prefer disabling the flags; the schema is additive and inactive tables are harmless. Destructive rollback scripts are supplied for staging/emergency review only. Take a snapshot first and never run them automatically.
