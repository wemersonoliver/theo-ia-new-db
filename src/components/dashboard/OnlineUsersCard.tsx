import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useEffect, useState } from "react";

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutos

function getInitials(name: string | null, email: string | null) {
  const base = (name || email || "?").trim();
  const parts = base.split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function OnlineUsersCard() {
  const { members, isLoading } = useTeamMembers();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const active = (members || []).filter((m) => m.status === "active");
  const online = active.filter(
    (m) => m.last_seen_at && now - new Date(m.last_seen_at).getTime() <= ONLINE_THRESHOLD_MS,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
            <Users className="h-4 w-4" />
          </div>
          Usuários online
        </CardTitle>
        <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/20" variant="outline">
          {online.length} / {active.length}
        </Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : online.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário online no momento.</p>
        ) : (
          <ul className="space-y-2">
            {online.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(m.full_name, m.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {m.full_name || m.email || "Sem nome"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate capitalize">{m.role}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}