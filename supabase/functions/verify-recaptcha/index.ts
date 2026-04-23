const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIN_SCORE = 0.5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, action } = await req.json();

    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Token ausente" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const secret = Deno.env.get("RECAPTCHA_SECRET_KEY");
    if (!secret) {
      console.error("RECAPTCHA_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "reCAPTCHA não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const params = new URLSearchParams();
    params.append("secret", secret);
    params.append("response", token);

    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await res.json();
    console.log("reCAPTCHA verify:", { action, expected: action, got: data.action, score: data.score, success: data.success });

    if (!data.success) {
      return new Response(
        JSON.stringify({ success: false, error: "Verificação falhou", details: data["error-codes"] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (typeof data.score === "number" && data.score < MIN_SCORE) {
      return new Response(
        JSON.stringify({ success: false, error: "Pontuação baixa, possível bot", score: data.score }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action && data.action && data.action !== action) {
      return new Response(
        JSON.stringify({ success: false, error: "Ação não corresponde", expected: action, got: data.action }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, score: data.score, action: data.action }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("verify-recaptcha error:", e);
    return new Response(
      JSON.stringify({ success: false, error: String((e as Error).message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
