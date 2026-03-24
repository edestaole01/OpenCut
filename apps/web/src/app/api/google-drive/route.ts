import { type NextRequest, NextResponse } from "next/server";

function extractFileId(input: string): string | null {
  if (/^[a-zA-Z0-9_-]{25,}$/.test(input.trim())) return input.trim();
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Extrai token de confirmação e uuid da página HTML de aviso do Google Drive */
function extractConfirmToken(html: string): { confirm: string; uuid: string } | null {
  // Tenta extrair do link de download direto
  const linkMatch = html.match(/href="(\/uc\?[^"]*confirm=([^"&]+)[^"]*)"/) ||
                    html.match(/href="(https:\/\/drive\.google\.com\/uc\?[^"]*confirm=([^"&]+)[^"]*)"/) ;
  if (linkMatch) {
    const url = linkMatch[1];
    const confirmMatch = url.match(/confirm=([^&"]+)/);
    const uuidMatch = url.match(/uuid=([^&"]+)/);
    if (confirmMatch) {
      return { confirm: confirmMatch[1], uuid: uuidMatch?.[1] || "" };
    }
  }

  // Tenta extrair dos inputs hidden do form
  const confirmInput = html.match(/name="confirm"[^>]*value="([^"]+)"/);
  const uuidInput = html.match(/name="uuid"[^>]*value="([^"]+)"/);
  if (confirmInput) {
    return { confirm: confirmInput[1], uuid: uuidInput?.[1] || "" };
  }

  // Formato alternativo: confirm=t direto na URL do form
  const formAction = html.match(/action="[^"]*[?&]confirm=([^"&]+)/);
  if (formAction) {
    return { confirm: formAction[1], uuid: "" };
  }

  return null;
}

async function downloadWithHeaders(url: string, cookies = "") {
  return fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(cookies ? { "Cookie": cookies } : {}),
    },
    redirect: "follow",
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawInput = searchParams.get("fileId") || searchParams.get("url") || "";

  if (!rawInput) {
    return NextResponse.json({ error: "fileId ou url obrigatório" }, { status: 400 });
  }

  const fileId = extractFileId(rawInput);
  if (!fileId) {
    return NextResponse.json(
      { error: "Não foi possível extrair o ID do arquivo. Use o link de compartilhamento do Google Drive." },
      { status: 400 }
    );
  }

  // ── Tentativa 1: endpoint novo do Google (drive.usercontent.google.com) ──
  const newEndpointUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`;

  try {
    const res1 = await downloadWithHeaders(newEndpointUrl);
    const ct1 = res1.headers.get("content-type") || "";

    if (res1.ok && !ct1.includes("text/html") && !ct1.includes("application/json")) {
      return buildVideoResponse(res1);
    }
  } catch {
    // Continua para próxima tentativa
  }

  // ── Tentativa 2: endpoint clássico uc?export=download ──
  const classicUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  let cookies = "";
  let res2: Response;

  try {
    res2 = await downloadWithHeaders(classicUrl);
  } catch (_e) {
    return NextResponse.json({ error: "Erro de rede ao acessar Google Drive." }, { status: 500 });
  }

  const ct2 = res2.headers.get("content-type") || "";

  // Captura cookies de sessão para usar na confirmação
  const setCookie = res2.headers.get("set-cookie") || "";
  if (setCookie) {
    // Extrai NID e outros cookies relevantes
    const cookieMatches = setCookie.match(/(NID|CONSENT|SOCS)=[^;]+/g) || [];
    cookies = cookieMatches.join("; ");
  }

  // Se retornou arquivo diretamente (< 25MB sem confirmação)
  if (res2.ok && !ct2.includes("text/html")) {
    return buildVideoResponse(res2);
  }

  // ── É uma página HTML de confirmação ──
  if (ct2.includes("text/html")) {
    const html = await res2.text();
    const tokenData = extractConfirmToken(html);

    if (tokenData) {
      // ── Tentativa 3: URL com token de confirmação ──
      let confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${tokenData.confirm}`;
      if (tokenData.uuid) confirmUrl += `&uuid=${tokenData.uuid}`;

      try {
        const res3 = await downloadWithHeaders(confirmUrl, cookies);
        const ct3 = res3.headers.get("content-type") || "";

        if (res3.ok && !ct3.includes("text/html")) {
          return buildVideoResponse(res3);
        }

        // ── Tentativa 4: usercontent com token ──
        const usercontent2 = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${tokenData.confirm}${tokenData.uuid ? `&uuid=${tokenData.uuid}` : ""}`;
        const res4 = await downloadWithHeaders(usercontent2, cookies);
        const ct4 = res4.headers.get("content-type") || "";

        if (res4.ok && !ct4.includes("text/html")) {
          return buildVideoResponse(res4);
        }
      } catch (e) {
        console.error("Confirm request failed:", e);
      }
    }

    // Verifica se o arquivo é privado (não compartilhado)
    if (html.includes("accounts.google.com") || html.includes("ServiceLogin")) {
      return NextResponse.json(
        { error: "Arquivo privado. No Google Drive, clique em 'Compartilhar' → 'Qualquer pessoa com o link' e tente novamente." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Não foi possível baixar automaticamente. Tente baixar o vídeo do Drive e fazer upload manual." },
      { status: 422 }
    );
  }

  if (!res2.ok) {
    return NextResponse.json(
      { error: `Google Drive retornou erro ${res2.status}. Verifique se o arquivo é público.` },
      { status: 400 }
    );
  }

  return buildVideoResponse(res2);
}

function buildVideoResponse(res: Response): NextResponse {
  const contentType = res.headers.get("content-type") || "video/mp4";
  const contentLength = res.headers.get("content-length");

  const disposition = res.headers.get("content-disposition") || "";
  const nameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
  const filename = nameMatch
    ? nameMatch[1].replace(/['"]/g, "").trim()
    : `video_drive.mp4`;

  // Stream direto — não carrega tudo na memória
  return new NextResponse(res.body, {
    headers: {
      "Content-Type": contentType,
      ...(contentLength ? { "Content-Length": contentLength } : {}),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
