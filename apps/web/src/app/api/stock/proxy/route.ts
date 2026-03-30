import { type NextRequest, NextResponse } from "next/server";

// Domínios permitidos para proxy de download
const ALLOWED_HOSTS = [
	"images.pexels.com",
	"videos.pexels.com",
	"player.vimeo.com",
	"vod-progressive.akamaized.net",
	"media.giphy.com",
	"media0.giphy.com",
	"media1.giphy.com",
	"media2.giphy.com",
	"media3.giphy.com",
	"media4.giphy.com",
	"i.giphy.com",
];

const PEXELS_HOSTS = ["images.pexels.com", "videos.pexels.com", "player.vimeo.com", "vod-progressive.akamaized.net"];

export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const url = searchParams.get("url");

	if (!url) {
		return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
	}

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
	} catch {
		return NextResponse.json({ error: "Invalid url" }, { status: 400 });
	}

	if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
		return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
	}

	try {
		const headers: Record<string, string> = {
			"User-Agent": "Mozilla/5.0 (compatible; OpenCut/1.0)",
		};

		if (PEXELS_HOSTS.includes(parsedUrl.hostname)) {
			headers["Referer"] = "https://www.pexels.com/";
		}

		const upstream = await fetch(url, { headers });

		if (!upstream.ok) {
			return NextResponse.json(
				{ error: `Upstream error: ${upstream.status}` },
				{ status: upstream.status },
			);
		}

		const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
		const contentLength = upstream.headers.get("content-length");

		const responseHeaders: Record<string, string> = {
			"Content-Type": contentType,
			"Cache-Control": "public, max-age=3600",
		};
		if (contentLength) responseHeaders["Content-Length"] = contentLength;

		return new NextResponse(upstream.body, {
			status: 200,
			headers: responseHeaders,
		});
	} catch (error) {
		console.error("Stock proxy error:", error);
		return NextResponse.json({ error: "Proxy fetch failed" }, { status: 502 });
	}
}
