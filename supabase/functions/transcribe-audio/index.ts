import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageKey, instanceName } = await req.json();
    
    const evolutionUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
    const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
    const groqApiKey = Deno.env.get("GROQ_API_KEY");

    if (!evolutionUrl || !evolutionKey) {
      console.error("Missing Evolution API configuration");
      return new Response(JSON.stringify({ error: "Missing Evolution API configuration" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (!groqApiKey) {
      console.error("Missing GROQ_API_KEY");
      return new Response(JSON.stringify({ error: "Missing GROQ_API_KEY" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log("Downloading audio from Evolution API for instance:", instanceName);

    // 1. Download audio from Evolution API
    const mediaResponse = await fetch(
      `${evolutionUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
        body: JSON.stringify({
          message: { key: messageKey },
          convertToMp4: false,
        }),
      }
    );

    if (!mediaResponse.ok) {
      const errorText = await mediaResponse.text();
      console.error("Evolution media error:", mediaResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to download audio from Evolution API" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const mediaData = await mediaResponse.json();
    const base64Audio = mediaData.base64;

    if (!base64Audio) {
      console.error("No audio data received from Evolution API");
      return new Response(JSON.stringify({ error: "No audio data received" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log("Audio downloaded, size:", base64Audio.length, "characters");

    // 2. Convert Base64 to Buffer
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log("Sending audio to Groq Whisper API...");

    // 3. Send to Groq Whisper API
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([bytes], { type: "audio/ogg" }),
      "audio.ogg"
    );
    formData.append("model", "whisper-large-v3-turbo");
    formData.append("language", "pt");

    const transcribeResponse = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: formData,
      }
    );

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error("Groq transcription error:", transcribeResponse.status, errorText);
      return new Response(JSON.stringify({ error: "Transcription failed", details: errorText }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const transcription = await transcribeResponse.json();
    console.log("Transcription successful:", transcription.text?.slice(0, 100));

    return new Response(JSON.stringify({ 
      success: true, 
      text: transcription.text 
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("Transcription error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
