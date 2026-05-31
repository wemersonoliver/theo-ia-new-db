import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAccountId } from "@/hooks/useAccount";
import { toast } from "sonner";

export interface IgreenAccountProduct {
  id: string;
  account_id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  position: number;
  created_at: string;
  updated_at: string;
  video_url: string | null;
}

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || `prod_${Date.now()}`;
}

export function useIgreenAccountProducts() {
  const { accountId } = useAccountId();
  const qc = useQueryClient();

  const productsQ = useQuery({
    queryKey: ["igreen-account-products", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("igreen_account_products")
        .select("*")
        .eq("account_id", accountId!)
        .order("position");
      if (error) throw error;
      return (data ?? []) as IgreenAccountProduct[];
    },
  });

  const createProduct = useMutation({
    mutationFn: async (vars: { name: string; description?: string | null }) => {
      if (!accountId) throw new Error("conta não disponível");
      const baseKey = slugify(vars.name);
      const existing = productsQ.data ?? [];
      let key = baseKey;
      let i = 2;
      while (existing.some((p) => p.key === key)) {
        key = `${baseKey}_${i++}`;
      }
      const nextPos = (existing[existing.length - 1]?.position ?? 0) + 1;
      const { data, error } = await supabase
        .from("igreen_account_products")
        .insert({
          account_id: accountId,
          key,
          name: vars.name.trim(),
          description: vars.description?.trim() || null,
          position: nextPos,
          enabled: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data as IgreenAccountProduct;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["igreen-account-products"] });
      qc.invalidateQueries({ queryKey: ["igreen-products"] });
      toast.success("Produto criado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar produto"),
  });

  const updateProduct = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<IgreenAccountProduct> }) => {
      const { error } = await supabase
        .from("igreen_account_products")
        .update(vars.patch)
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["igreen-account-products"] });
      qc.invalidateQueries({ queryKey: ["igreen-products"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("igreen_account_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["igreen-account-products"] });
      qc.invalidateQueries({ queryKey: ["igreen-products"] });
      toast.success("Produto excluído");
    },
    onError: (e: any) =>
      toast.error(
        e?.message?.includes("foreign key")
          ? "Não é possível excluir: existem cenários vinculados a este produto."
          : e?.message ?? "Erro ao excluir produto",
      ),
  });

  return { productsQ, createProduct, updateProduct, deleteProduct };
}