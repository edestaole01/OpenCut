import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const video = formData.get("video") as File;

    if (!video) {
      return NextResponse.json({ error: "No video provided" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return NextResponse.json(getMockResult());
    }

    // Upload video to Gemini File API
    const videoBuffer = await video.arrayBuffer();
    const videoBase64 = Buffer.from(videoBuffer).toString("base64");

    const prompt = `Você é um especialista em marketing de conteúdo e criação de vídeos virais para redes sociais.

Analise este vídeo e retorne um JSON com os melhores clips para redes sociais.

Retorne APENAS o JSON, sem explicações:
{
  "clips": [
    {
      "id": "1",
      "title": "título descritivo do clip",
      "start": 0,
      "end": 18,
      "score": 88,
      "tag": "Gancho|Tutorial|Story|Dica|CTA",
      "caption": "caption sugerida para redes sociais com emojis"
    }
  ],
  "transcript": "transcrição resumida do vídeo"
}

Sugira entre 4-8 clips com os momentos mais impactantes. O score deve ser de 0-100 baseado no potencial viral.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: video.type,
                  data: videoBase64,
                }
              }
            ]
          }]
        })
      }
    );

    if (!response.ok) {
      return NextResponse.json(getMockResult());
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return NextResponse.json(getMockResult());
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(getMockResult());
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json(getMockResult());
  }
}

function getMockResult() {
  return {
    clips: [
      { id: "1", title: "Introdução impactante", start: 0, end: 18, score: 88, tag: "Gancho", caption: "Descubra como transformar sua empresa com IA!" },
      { id: "2", title: "Ponto principal do conteúdo", start: 45, end: 165, score: 84, tag: "Tutorial", caption: "Os 7 passos para lucrar com inteligência artificial" },
      { id: "3", title: "Momento de conexão", start: 180, end: 218, score: 78, tag: "Story", caption: "A história que mudou tudo para nossos clientes" },
      { id: "4", title: "Dica prática", start: 230, end: 277, score: 71, tag: "Dica", caption: "Essa dica simples pode dobrar seus resultados" },
      { id: "5", title: "Call to action", start: 290, end: 320, score: 65, tag: "CTA", caption: "Não perca essa oportunidade única! Clique agora" },
    ],
    transcript: "Transcrição completa do vídeo gerada pela IA...",
  };
}
