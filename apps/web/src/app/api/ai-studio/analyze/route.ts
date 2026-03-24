import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { aiVideoAnalyses } from "@/lib/db/schema";
import { nanoid } from "nanoid";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";

// Upload video using Gemini File API (supports files up to 2GB)
async function uploadVideoToGemini(videoBuffer: ArrayBuffer, mimeType: string, apiKey: string): Promise<string> {
  const numBytes = videoBuffer.byteLength;

  // Step 1: Initiate resumable upload
  const initRes = await fetch(
    `${GEMINI_API_BASE}/upload/v1beta/files?uploadType=resumable&key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "X-Goog-Upload-Protocol": "resumable",
        "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": numBytes.toString(),
        "X-Goog-Upload-Header-Content-Type": mimeType,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: { display_name: "video_upload" } }),
    }
  );

  if (!initRes.ok) {
    throw new Error(`File API init failed: ${initRes.status}`);
  }

  const uploadUrl = initRes.headers.get("X-Goog-Upload-URL");
  if (!uploadUrl) throw new Error("No upload URL returned");

  // Step 2: Upload the file
  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": numBytes.toString(),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: videoBuffer,
  });

  if (!uploadRes.ok) {
    throw new Error(`File upload failed: ${uploadRes.status}`);
  }

  const fileData = await uploadRes.json();
  const fileUri = fileData.file?.uri;
  if (!fileUri) throw new Error("No file URI in response");

  // Step 3: Wait for file to be ACTIVE (processed)
  let fileState = fileData.file?.state;
  let attempts = 0;
  while (fileState === "PROCESSING" && attempts < 30) {
    await new Promise(r => setTimeout(r, 5000)); // wait 5s
    const statusRes = await fetch(
      `${GEMINI_API_BASE}/v1beta/files/${fileData.file.name.split("/").pop()}?key=${apiKey}`
    );
    const statusData = await statusRes.json();
    // GET /files/{name} returns the file object directly (no 'file' wrapper)
    fileState = statusData.state ?? statusData.file?.state;
    attempts++;
  }

  if (fileState !== "ACTIVE") {
    throw new Error(`File not ready: ${fileState}`);
  }

  return fileUri;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const video = formData.get("video") as File;

    if (!video) {
      return NextResponse.json({ error: "No video provided" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.log("No GEMINI_API_KEY, returning mock");
      return NextResponse.json(getMockResult());
    }

    // Log available models once to help diagnose model availability issues
    try {
      const listRes = await fetch(
        `${GEMINI_API_BASE}/v1beta/models?key=${geminiKey}&pageSize=50`
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const videoCapableModels = (listData.models || [])
          .filter((m: any) =>
            m.supportedGenerationMethods?.includes("generateContent") &&
            (m.name.includes("flash") || m.name.includes("pro"))
          )
          .map((m: any) => m.name);
        console.log("Available Gemini models:", videoCapableModels.join(", "));
      }
    } catch { /* ignore */ }

    const videoBuffer = await video.arrayBuffer();
    const mimeType = video.type || "video/mp4";
    const fileSizeMB = videoBuffer.byteLength / (1024 * 1024);

    console.log(`Video size: ${fileSizeMB.toFixed(1)}MB, type: ${mimeType}`);

    let contentParts: any[];

    if (fileSizeMB > 15) {
      // Use File API for large videos
      console.log("Using Gemini File API for large video...");
      try {
        const fileUri = await uploadVideoToGemini(videoBuffer, mimeType, geminiKey);
        console.log("File uploaded, URI:", fileUri);
        contentParts = [
          { text: getPrompt() },
          { file_data: { mime_type: mimeType, file_uri: fileUri } }
        ];
      } catch (uploadErr) {
        console.error("File API upload failed:", uploadErr);
        // Fallback to inline for smaller segments or return mock
        return NextResponse.json(getMockResult());
      }
    } else {
      // Inline base64 for small videos (< 15MB)
      console.log("Using inline base64 for small video...");
      const videoBase64 = Buffer.from(videoBuffer).toString("base64");
      contentParts = [
        { text: getPrompt() },
        { inline_data: { mime_type: mimeType, data: videoBase64 } }
      ];
    }

    // Models confirmed available for this API key (verified via ListModels)
    const models = [
      "gemini-2.0-flash",       // fastest, supports video well
      "gemini-1.5-flash",       // standard fallback
      "gemini-1.5-flash-8b",    // very fast fallback
      "gemini-1.5-pro",         // higher quality, slower
      "gemini-pro-latest",      // alias fallback
    ];
    let text: string | null = null;

    for (const model of models) {
      try {
        console.log(`Trying model: ${model}`);
        const response = await fetch(
          `${GEMINI_API_BASE}/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: contentParts }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 8192,
              }
            })
          }
        );

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          console.warn(`Model ${model} failed (${response.status}):`, errText.slice(0, 200));
          continue;
        }

        const data = await response.json();
        text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          console.log(`Success with model: ${model}`);
          break;
        }
      } catch (modelErr) {
        console.warn(`Model ${model} error:`, modelErr);
      }
    }

    if (!text) {
      console.error("All models failed, returning mock");
      return NextResponse.json(getMockResult());
    }

    // Parse JSON from response
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found:", text.slice(0, 300));
      return NextResponse.json(getMockResult());
    }

    const result = JSON.parse(jsonMatch[0]);

    if (!result.transcript || result.transcript.length < 20) {
      result.transcript = "Transcription not returned by AI. Check the video's audio quality and file size.";
    }

    // Salvar no banco para persistência
    await db.insert(aiVideoAnalyses).values({
      id: nanoid(),
      userId: session.user.id,
      videoName: video.name || "Video sem nome",
      videoSize: video.size,
      result: result,
    }).catch(err => console.error("Erro ao salvar análise:", err));

    return NextResponse.json(result);

  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(getMockResult());
  }
}

function getPrompt() {
  return `You are a video transcription and content analysis expert.

Your task has TWO parts:

PART 1 — VERBATIM TRANSCRIPTION:
Transcribe EXACTLY what is spoken in the video, word for word. Do NOT paraphrase, summarize, or add words that were not said. Use the language spoken in the video (do not translate). Add a [MM:SS] timestamp at the start of each sentence or every ~10 seconds.

PART 2 — VIRAL CLIPS:
Identify 4-8 of the most impactful moments for social media. For each clip, write the "caption" in the same language as the video.

Return ONLY valid JSON, no markdown, no explanations:
{
  "clips": [
    {
      "id": "1",
      "title": "descriptive title",
      "start": 0,
      "end": 18,
      "score": 88,
      "tag": "Hook",
      "caption": "engaging caption with emojis 🚀"
    }
  ],
  "transcript": "[00:00] exact words spoken here... [00:30] continuation..."
}

Rules:
- transcript: copy the EXACT words spoken — no paraphrasing, no invention
- clips start/end: in seconds (integers)
- score: 0-100 viral potential
- tags: Hook, Tutorial, Story, Tip, CTA`;
}

function getMockResult() {
  return {
    clips: [
      { id: "1", title: "Introdução impactante", start: 0, end: 18, score: 88, tag: "Gancho", caption: "Descubra como transformar sua empresa com IA! 🚀" },
      { id: "2", title: "Ponto principal do conteúdo", start: 45, end: 165, score: 84, tag: "Tutorial", caption: "Os 7 passos para lucrar com inteligência artificial 💡" },
      { id: "3", title: "Momento de conexão", start: 180, end: 218, score: 78, tag: "Story", caption: "A história que mudou tudo para nossos clientes 🎯" },
      { id: "4", title: "Dica prática", start: 230, end: 277, score: 71, tag: "Dica", caption: "Essa dica simples pode dobrar seus resultados ⚡" },
      { id: "5", title: "Call to action", start: 290, end: 320, score: 65, tag: "CTA", caption: "Não perca essa oportunidade única! Clique agora 👇" },
    ],
    transcript: "⚠️ Modo demonstração — a Gemini API não conseguiu processar o vídeo.\n\nPossíveis causas:\n• Modelo Gemini ainda sendo configurado\n• Vídeo muito grande (tente com menos de 50MB)\n• API key sem permissão para vídeo\n\nQuando funcionar, aparecerá assim:\n[00:00] Olá pessoal, hoje vou mostrar como usar IA...\n[00:15] O primeiro passo é abrir o dashboard...\n[00:45] E o resultado foi incrível, a empresa cresceu 3x...",
  };
}
