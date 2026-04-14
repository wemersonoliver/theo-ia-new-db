import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useAdminAiCredits } from "@/hooks/useAiCredits";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Plus, Users, Volume2, Loader2, Search } from "lucide-react";

interface ProfileWithCredits {
  user_id: string;
  full_name: string | null;
  email: string | null;
  credits?: {
    balance_cents: number;
    total_added_cents: number;
    total_consumed_cents: number;
    voice_enabled: boolean;
  };
}

export default function AdminCreditsManager() {
  const { allCredits, isLoading: loadingCredits, addCredits, toggleVoice } = useAdminAiCredits();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState("");
  const [addDescription, setAddDescription] = useState("");

  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles-for-credits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const enrichedProfiles: ProfileWithCredits[] = (profiles || []).map((p) => {
    const credit = allCredits?.find((c) => c.user_id === p.user_id);
    return {
      ...p,
      credits: credit
        ? {
            balance_cents: credit.balance_cents,
            total_added_cents: credit.total_added_cents,
            total_consumed_cents: credit.total_consumed_cents,
            voice_enabled: credit.voice_enabled,
          }
        : undefined,
    };
  });

  const filtered = enrichedProfiles.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (p.full_name || "").toLowerCase().includes(s) ||
      (p.email || "").toLowerCase().includes(s)
    );
  });

  const handleAddCredits = () => {
    if (!selectedUser || !addAmount) return;
    const cents = Math.round(parseFloat(addAmount) * 100);
    if (isNaN(cents) || cents <= 0) return;
    addCredits.mutate(
      { userId: selectedUser, amountCents: cents, description: addDescription || undefined },
      { onSuccess: () => { setAddAmount(""); setAddDescription(""); setSelectedUser(null); } }
    );
  };

  const isLoading = loadingCredits || loadingProfiles;

  return (
    <AdminLayout title="Créditos de Voz IA" description="Gerencie créditos e acesso à voz por usuário">
      <div className="space-y-6">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="pl-10 bg-slate-800 border-slate-700 text-slate-200"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((profile) => (
              <Card key={profile.user_id} className="border-slate-700/50 bg-slate-900/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    {/* User info */}
                    <div className="flex-1 min-w-[200px]">
                      <p className="text-sm font-medium text-white">{profile.full_name || "Sem nome"}</p>
                      <p className="text-xs text-slate-500">{profile.email}</p>
                    </div>

                    {/* Credits info */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Saldo</p>
                        <p className="text-sm font-bold text-amber-400">
                          ${((profile.credits?.balance_cents || 0) / 100).toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Consumido</p>
                        <p className="text-sm text-slate-300">
                          ${((profile.credits?.total_consumed_cents || 0) / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    {/* Voice toggle */}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-slate-400">Voz</Label>
                      <Switch
                        checked={profile.credits?.voice_enabled || false}
                        onCheckedChange={(checked) =>
                          toggleVoice.mutate({ userId: profile.user_id, enabled: checked })
                        }
                      />
                    </div>

                    {/* Add credits */}
                    {selectedUser === profile.user_id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          value={addAmount}
                          onChange={(e) => setAddAmount(e.target.value)}
                          placeholder="USD"
                          className="w-20 bg-slate-800 border-slate-700 text-slate-200 text-sm"
                        />
                        <Input
                          value={addDescription}
                          onChange={(e) => setAddDescription(e.target.value)}
                          placeholder="Descrição"
                          className="w-32 bg-slate-800 border-slate-700 text-slate-200 text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={handleAddCredits}
                          disabled={addCredits.isPending}
                          className="bg-amber-500 hover:bg-amber-600 text-black text-xs"
                        >
                          {addCredits.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedUser(null)}
                          className="text-slate-400 text-xs"
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedUser(profile.user_id)}
                        className="border-slate-700 text-slate-300 hover:bg-slate-800 text-xs gap-1"
                      >
                        <Plus className="h-3 w-3" /> Créditos
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {filtered.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">Nenhum usuário encontrado.</p>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
