import { type NextRequest, NextResponse } from "next/server";
import { join } from "node:path";
import { createReadStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";

/**
 * Serves uploaded AI Studio video files with proper streaming.
 * Used as fallback when the static /uploads/ai-studio/ path fails to load.
 *
 * GET /api/ai-studio/file?path=/uploads/ai-studio/filename.mp4
 */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const filePath = searchParams.get("path");

	if (!filePath) {
		return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
	}

	// Security: only allow files within /uploads/ai-studio/
	if (!filePath.startsWith("/uploads/ai-studio/")) {
		return NextResponse.json({ error: "Access denied" }, { status: 403 });
	}

	// Prevent path traversal
	const fileName = filePath.split("/").pop();
	if (!fileName || fileName.includes("..") || !fileName.match(/^[\w\-.]+$/)) {
		return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
	}

	const absolutePath = join(process.cwd(), "public", "uploads", "ai-studio", fileName);

	if (!existsSync(absolutePath)) {
		return NextResponse.json({ error: "File not found" }, { status: 404 });
	}

	const stat = statSync(absolutePath);
	const fileSize = stat.size;
	const rangeHeader = request.headers.get("range");

	const ext = fileName.split(".").pop()?.toLowerCase() ?? "mp4";
	const mimeTypes: Record<string, string> = {
		mp4: "video/mp4",
		mov: "video/quicktime",
		webm: "video/webm",
		avi: "video/x-msvideo",
		mkv: "video/x-matroska",
	};
	const contentType = mimeTypes[ext] ?? "video/mp4";

	// Support Range requests for video seeking
	if (rangeHeader) {
		const [startStr, endStr] = rangeHeader.replace("bytes=", "").split("-");
		const start = Number.parseInt(startStr, 10);
		const end = endStr ? Number.parseInt(endStr, 10) : fileSize - 1;
		const chunkSize = end - start + 1;

		const stream = createReadStream(absolutePath, { start, end });
		const nodeReadable = Readable.toWeb(stream) as ReadableStream;

		return new NextResponse(nodeReadable, {
			status: 206,
			headers: {
				"Content-Type": contentType,
				"Content-Range": `bytes ${start}-${end}/${fileSize}`,
				"Accept-Ranges": "bytes",
				"Content-Length": chunkSize.toString(),
				"Cache-Control": "private, max-age=3600",
			},
		});
	}

	// Full file
	const stream = createReadStream(absolutePath);
	const nodeReadable = Readable.toWeb(stream) as ReadableStream;

	return new NextResponse(nodeReadable, {
		status: 200,
		headers: {
			"Content-Type": contentType,
			"Content-Length": fileSize.toString(),
			"Accept-Ranges": "bytes",
			"Cache-Control": "private, max-age=3600",
		},
	});
}
