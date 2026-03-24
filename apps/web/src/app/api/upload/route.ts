import { type NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { auth } from "@/lib/auth/server";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Caminho da pasta de uploads
    const uploadDir = join(process.cwd(), "public", "uploads");
    
    // Garantir que a pasta existe
    await mkdir(uploadDir, { recursive: true }).catch(() => {});

    // Nome único para o arquivo
    const fileExtension = file.name.split(".").pop();
    const fileName = `${nanoid()}.${fileExtension}`;
    const filePath = join(uploadDir, fileName);

    // Salvar no disco
    await writeFile(filePath, buffer);

    // Retornar a URL pública
    const url = `/uploads/${fileName}`;
    
    return NextResponse.json({ 
      url, 
      name: file.name,
      size: file.size,
      id: fileName 
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Erro ao salvar arquivo no servidor" }, { status: 500 });
  }
}
