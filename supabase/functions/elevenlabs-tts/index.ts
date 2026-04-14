import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_VOICE_ID = "CwhRBWXzGAHq8TQ4Fs17"; // Roger

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const elevenlabsKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenlabsKey) {
      throw new Error("ELEVENLABS_API_KEY not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { text, voiceId, userId, phone, source, voiceSettings } = await req.json();

    if (!text || !phone) {
      return new Response(JSON.stringify({ error: "text and phone are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedSource = source || "support";
    const resolvedVoiceId = voiceId || DEFAULT_VOICE_ID;
    const charactersCount = text.length;
    const costCents = Math.ceil((charactersCount / 1000) * 24); // ~$0.24/1000 chars

    // For user_agent source, check credits
    if (resolvedSource === "user_agent" && userId) {
      const { data: credits } = await supabase
        .from("ai_credits")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!credits) {
        return new Response(JSON.stringify({ error: "no_credits", message: "Créditos de voz não configurados para este usuário" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!credits.voice_enabled) {
        return new Response(JSON.stringify({ error: "voice_disabled", message: "Voz não habilitada para este usuário" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (credits.balance_cents < costCents) {
        return new Response(JSON.stringify({ error: "insufficient_credits", message: "Créditos insuficientes", balance: credits.balance_cents, required: costCents }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`TTS request: ${charactersCount} chars, voice=${resolvedVoiceId}, phone=${phone}, source=${resolvedSource}`);

    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenlabsKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: voiceSettings?.stability ?? 0.5,
            similarity_boost: voiceSettings?.similarity_boost ?? 0.75,
            style: voiceSettings?.style ?? 0.3,
            use_speaker_boost: true,
            speed: voiceSettings?.speed ?? 1.0,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      console.error("ElevenLabs API error:", ttsResponse.status, errText);
      throw new Error(`ElevenLabs API error: ${ttsResponse.status} - ${errText.slice(0, 200)}`);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const audioBase64 = base64Encode(audioBuffer);

    // Track usage in ai_voice_usage
    try {
      await supabase.from("ai_voice_usage").insert({
        user_id: userId || null,
        phone,
        characters_count: charactersCount,
        cost_cents: costCents,
        source: resolvedSource,
      });
    } catch (trackErr) {
      console.error("Failed to track voice usage:", trackErr);
    }

    // Deduct credits for user_agent source
    if (resolvedSource === "user_agent" && userId) {
      try {
        const { data: currentCredits } = await supabase
          .from("ai_credits")
          .select("balance_cents, total_consumed_cents")
          .eq("user_id", userId)
          .single();

        if (currentCredits) {
          const newBalance = currentCredits.balance_cents - costCents;
          const newConsumed = currentCredits.total_consumed_cents + costCents;

          await supabase
            .from("ai_credits")
            .update({ balance_cents: newBalance, total_consumed_cents: newConsumed })
            .eq("user_id", userId);

          // Record transaction
          await supabase.from("ai_credit_transactions").insert({
            user_id: userId,
            type: "debit",
            amount_cents: costCents,
            balance_after_cents: newBalance,
            description: `TTS: ${charactersCount} caracteres`,
            reference_id: phone,
          });
        }
      } catch (creditErr) {
        console.error("Failed to deduct credits:", creditErr);
      }
    }

    console.log(`TTS generated: ${audioBase64.length} base64 chars, cost=${costCents} cents`);

    return new Response(JSON.stringify({ 
      audioBase64, 
      mimeType: "audio/mpeg",
      charactersCount,
      costCents,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("ElevenLabs TTS error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
