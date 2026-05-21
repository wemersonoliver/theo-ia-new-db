import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function extractDocxText(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const { unzipSync, strFromU8 } = await import("https://esm.sh/fflate@0.8.2");
  const entries = unzipSync(bytes);
  const xmlPaths = Object.keys(entries).filter(
    (k) => k === "word/document.xml" || /^word\/(header|footer)\d*\.xml$/.test(k),
  );
  let combined = "";
  for (const path of xmlPaths) {
    const xml = strFromU8(entries[path]);
    const paragraphs = xml.split(/<\/w:p>/);
    for (const p of paragraphs) {
      const withBreaks = p.replace(/<w:br\s*\/>/g, "\n");
      const matches = withBreaks.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      const line = matches.map((m) => m.replace(/<[^>]+>/g, "")).join("");
      if (line.trim()) combined += line + "\n";
    }
  }
  return combined
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { documentId } = await req.json();
    if (!documentId) return new Response(JSON.stringify({ error: "documentId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: doc, error } = await supabase.from("knowledge_base_documents").select("id, file_path, file_name").eq("id", documentId).single();
    if (error || !doc) return new Response(JSON.stringify({ error: "doc not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: fileData, error: dlErr } = await supabase.storage.from("knowledge-base").download(doc.file_path);
    if (dlErr || !fileData) return new Response(JSON.stringify({ error: "download failed", detail: dlErr?.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const ext = (doc.file_name.split(".").pop() || "").toLowerCase();
    let text = "";
    if (ext === "docx" || ext === "doc") text = await extractDocxText(fileData);
    else text = await fileData.text();

    const cleaned = text.replace(/\u0000/g, "").slice(0, 50000);
    await supabase.from("knowledge_base_documents").update({ content_text: cleaned, status: "ready" }).eq("id", documentId);

    return new Response(JSON.stringify({ ok: true, length: cleaned.length, preview: cleaned.slice(0, 500) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});