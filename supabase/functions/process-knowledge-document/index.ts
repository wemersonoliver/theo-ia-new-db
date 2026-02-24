import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const userId = claimsData.user.id;
    const { filePath } = await req.json();

    if (!filePath) {
      return new Response(JSON.stringify({ error: "File path required" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await serviceSupabase.storage
      .from("knowledge-base")
      .download(filePath);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      await updateDocumentStatus(supabase, userId, filePath, "error");
      return new Response(JSON.stringify({ error: "Failed to download file" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Extract text based on file type
    const fileName = filePath.split("/").pop() || "";
    const extension = fileName.split(".").pop()?.toLowerCase();
    let extractedText = "";

    if (extension === "txt") {
      extractedText = await fileData.text();
    } else if (extension === "pdf") {
      // For PDF, we'll extract basic text
      // In production, you'd use a proper PDF parser
      extractedText = await extractPdfText(fileData);
    } else if (extension === "docx" || extension === "doc") {
      // For Word docs, extract basic text
      extractedText = await extractDocxText(fileData);
    } else {
      // Try as plain text
      try {
        extractedText = await fileData.text();
      } catch {
        extractedText = "[Formato não suportado]";
      }
    }

    // Update document with extracted text
    await supabase
      .from("knowledge_base_documents")
      .update({
        content_text: extractedText.slice(0, 50000), // Limit to 50k chars
        status: extractedText ? "ready" : "error",
      })
      .eq("user_id", userId)
      .eq("file_path", filePath);

    console.log(`Document processed: ${fileName}, ${extractedText.length} chars`);

    return new Response(JSON.stringify({ 
      success: true, 
      textLength: extractedText.length 
    }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (error) {
    console.error("Process error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});

async function updateDocumentStatus(supabase: any, userId: string, filePath: string, status: string) {
  await supabase
    .from("knowledge_base_documents")
    .update({ status })
    .eq("user_id", userId)
    .eq("file_path", filePath);
}

async function extractPdfText(blob: Blob): Promise<string> {
  // Basic PDF text extraction
  // For production, consider using pdf-parse or similar
  try {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    
    // Try to find text streams in the PDF
    const textMatches = text.match(/\((.*?)\)/g) || [];
    const extracted = textMatches
      .map(m => m.slice(1, -1))
      .filter(t => t.length > 2 && /[a-zA-ZÀ-ÿ]/.test(t))
      .join(" ");

    if (extracted.length > 100) {
      return extracted.replace(/\s+/g, " ").trim();
    }

    // Fallback: extract any readable text
    return text
      .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 10000) || "[Não foi possível extrair texto do PDF]";
  } catch (e) {
    console.error("PDF extraction error:", e);
    return "[Erro ao processar PDF]";
  }
}

async function extractDocxText(blob: Blob): Promise<string> {
  // Basic DOCX text extraction
  // DOCX is a ZIP file with XML content
  try {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    
    // Try to find text between XML tags
    const textMatches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
    const extracted = textMatches
      .map(m => m.replace(/<[^>]+>/g, ""))
      .join(" ");

    if (extracted.length > 50) {
      return extracted.replace(/\s+/g, " ").trim();
    }

    // Fallback
    return text
      .replace(/<[^>]+>/g, " ")
      .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 10000) || "[Não foi possível extrair texto do documento]";
  } catch (e) {
    console.error("DOCX extraction error:", e);
    return "[Erro ao processar documento]";
  }
}
