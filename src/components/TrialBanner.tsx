import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Clock, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const TRIAL_DAYS = 15;

export function TrialBanner() {
  const { user } = useAuth();
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!user) return;

      // Skip for super_admin
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin");
      if (roles && roles.length > 0) return;

      // Skip if has active subscription
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (sub) return;

      // Calculate trial days left
      const { data: profile } = await supabase
        .from("profiles")
        .select("created_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profile?.created_at) {
        const diffMs = Date.now() - new Date(profile.created_at).getTime();
        const left = TRIAL_DAYS - Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (left > 0) {
          setDaysLeft(left);
          setShow(true);
        }
      }
    };
    check();
  }, [user]);

  if (!show || daysLeft === null) return null;

  const urgent = daysLeft <= 3;

  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
      urgent
        ? "border-destructive/30 bg-destructive/5 text-destructive"
        : "border-primary/20 bg-primary/5 text-foreground"
    }`}>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" />
        <span>
          {daysLeft === 1
            ? "Último dia do seu teste gratuito!"
            : `Restam ${daysLeft} dias do seu teste gratuito.`}
        </span>
      </div>
      <a
        href="https://pay.kiwify.com.br/bpNMdQ0"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 whitespace-nowrap font-medium text-primary hover:underline"
      >
        Assinar agora <ArrowRight className="h-3 w-3" />
      </a>
    </div>
  );
}
