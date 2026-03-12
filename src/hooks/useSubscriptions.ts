import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface Subscription {
  id: string;
  user_id: string;
  kiwify_order_id: string | null;
  kiwify_product_id: string | null;
  product_name: string | null;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  plan_type: string | null;
  amount_cents: number | null;
  currency: string | null;
  started_at: string | null;
  expires_at: string | null;
  cancelled_at: string | null;
  refunded_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useSubscriptions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["subscriptions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("subscriptions" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as Subscription[];
    },
    enabled: !!user,
  });
}

export function useUserSubscription() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-subscription", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("subscriptions" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as Subscription | null;
    },
    enabled: !!user,
  });
}
