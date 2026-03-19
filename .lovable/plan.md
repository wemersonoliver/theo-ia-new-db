

# Fix: Blank Screen on AI Interview Start

## Problem
The `interview-ai-agent` edge function crashes because it calls `supabase.auth.getClaims(token)` -- a method that does not exist in the Supabase JS client. This returns a 500 error. Meanwhile, the frontend has already set `interviewState = "chat"` before calling the edge function, so the user sees a blank chat screen with no messages.

## Root Cause
In `supabase/functions/interview-ai-agent/index.ts` (lines ~228-235), the auth validation uses:
```typescript
const { data: authData, error: authError } = await supabase.auth.getClaims(token);
```
This method does not exist. The correct approach is `supabase.auth.getUser(token)`.

## Fix (2 changes)

### 1. Edge Function: Fix auth validation
**File:** `supabase/functions/interview-ai-agent/index.ts`

Replace `getClaims` with `getUser`:
```typescript
const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
if (authError || !authUser) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
const userId = authUser.id;
```

### 2. Frontend: Better error handling in `handleStart`
**File:** `src/pages/AIAgent.tsx`

Move `setInterviewState("chat")` to after the first successful AI response, or revert it on error. Currently, the state is set to `"chat"` on line 221 before `callInterviewAgent` is called, so if the call fails the user is stuck on a blank chat screen. The fix is to only transition to chat state after confirming the edge function works, or add a catch that resets `interviewState` to `"idle"`.

## Deploy
The edge function must be redeployed after the fix.

