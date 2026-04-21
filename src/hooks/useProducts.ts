import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccountId } from "@/hooks/useAccount";
import { resolveAccountContext } from "@/lib/account-context";
import { toast } from "sonner";

export interface Product {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  quantity: number;
  price_cents: number;
  sku: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useProducts() {
  const { user } = useAuth();
  const { accountId } = useAccountId();
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ["products", accountId],
    enabled: !!user && !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("account_id", accountId!)
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const createProduct = useMutation({
    mutationFn: async (product: { name: string; description?: string; quantity?: number; price_cents?: number; sku?: string }) => {
      const ctx = await resolveAccountContext(user!.id);
      const { error } = await supabase.from("products").insert({ ...product, user_id: user!.id, account_id: ctx?.accountId });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Produto criado"); },
    onError: () => toast.error("Erro ao criar produto"),
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Product> & { id: string }) => {
      const { error } = await supabase.from("products").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Produto atualizado"); },
    onError: () => toast.error("Erro ao atualizar produto"),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Produto excluído"); },
    onError: () => toast.error("Erro ao excluir produto"),
  });

  const bulkCreateProducts = useMutation({
    mutationFn: async (products: { name: string; description?: string; quantity?: number; price_cents?: number; sku?: string }[]) => {
      const ctx = await resolveAccountContext(user!.id);
      const rows = products.map(p => ({ ...p, user_id: user!.id, account_id: ctx?.accountId }));
      const { error } = await supabase.from("products").insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`${vars.length} produtos importados`);
    },
    onError: () => toast.error("Erro ao importar produtos"),
  });

  return { products: productsQuery.data || [], isLoading: productsQuery.isLoading, createProduct, updateProduct, deleteProduct, bulkCreateProducts };
}

export function useDealProducts(dealId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["deal-products", dealId],
    enabled: !!dealId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_deal_products")
        .select("*, products(name, price_cents)")
        .eq("deal_id", dealId!);
      if (error) throw error;
      return data as any[];
    },
  });

  const setDealProducts = useMutation({
    mutationFn: async ({ dealId, items }: { dealId: string; items: { product_id: string; quantity: number; unit_price_cents: number }[] }) => {
      // Delete existing
      await supabase.from("crm_deal_products").delete().eq("deal_id", dealId);
      if (items.length > 0) {
        const ctx = await resolveAccountContext(user!.id);
        const rows = items.map(i => ({ ...i, deal_id: dealId, user_id: user!.id, account_id: ctx?.accountId }));
        const { error } = await supabase.from("crm_deal_products").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deal-products"] }),
  });

  return { dealProducts: query.data || [], isLoading: query.isLoading, setDealProducts };
}
