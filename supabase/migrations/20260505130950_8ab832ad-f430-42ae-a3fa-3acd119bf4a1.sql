UPDATE public.appointments a
SET account_id = ac.id,
    assigned_to = COALESCE(a.assigned_to, a.user_id),
    updated_at = now()
FROM public.accounts ac
WHERE a.account_id IS NULL
  AND ac.owner_user_id = a.user_id;