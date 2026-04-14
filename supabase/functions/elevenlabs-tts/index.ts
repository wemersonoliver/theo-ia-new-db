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

    const { text, voiceId, userId, phone, source } = await req.json();

    if (!text || !phone) {
      return new Response(JSON.stringify({ error: "text and phone are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedVoiceId = voiceId || DEFAULT_VOICE_ID;
    const charactersCount = text.length;

    console.log(`TTS request: ${charactersCount} chars, voice=${resolvedVoiceId}, phone=${phone}`);

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
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
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

    // Track usage
    const costCents = Math.ceil((charactersCount / 1000) * 24); // ~$0.24/1000 chars

    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      await supabase.from("ai_voice_usage").insert({
        user_id: userId || null,
        phone,
        characters_count: charactersCount,
        cost_cents: costCents,
        source: source || "support",
      });
    } catch (trackErr) {
      console.error("Failed to track voice usage:", trackErr);
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
