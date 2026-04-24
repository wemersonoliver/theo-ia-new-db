

## Fix: Restrict Evolution API key access to account owners only

### Problem
The `platform_settings` table stores sensitive Evolution API credentials (`evolution_api_url`, `evolution_api_key`). Currently it has two RLS policies:
- ✅ `Users manage own platform settings` → owner-only (correct)
- ❌ `Team members manage platform settings` → grants `ALL` (read + write) to any team member with the `settings` permission

The `settings` permission is included by default for **every role** (owner, manager, seller, agent), because it's needed for the in-app Settings page (notifications, profile, tutorial). The result: a low-privilege `agent` or `seller` can run `SELECT * FROM platform_settings` and read the owner's Evolution API key in plain text.

### Solution
The Evolution API credentials in `platform_settings` are only ever used by the account owner — the frontend hook (`usePlatformSettings.ts`) and all Edge Functions read them scoped to `user_id = auth.uid()`. There is no legitimate reason for team members (manager/seller/agent) to access this table at all.

The fix is to **drop the team-members policy** and keep only the owner-scoped policy.

### Database migration
```sql
-- Remove the overly permissive policy that exposes API keys to team members
DROP POLICY IF EXISTS "Team members manage platform settings" ON public.platform_settings;

-- Confirm the remaining policy (already in place, owner-only)
-- "Users manage own platform settings": USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
```

### Impact
- ✅ Only the account owner can read or write Evolution API credentials.
- ✅ No frontend changes needed — `usePlatformSettings.ts` already filters by `auth.uid()`.
- ✅ No Edge Function changes needed — they use the `service_role` key, which bypasses RLS.
- ✅ Team members (manager/seller/agent) keep full access to all other features they had before.

### After applying
The Lovable security scanner will re-run and the `platform_settings_api_key_exposure` finding will be marked resolved.

