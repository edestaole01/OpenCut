import { db } from "../src/lib/db";
import { aiVideoAnalyses } from "../src/lib/db/schema";

async function checkHistory() {
  try {
    const list = await db.select().from(aiVideoAnalyses);
    console.log(`Encontrados ${list.length} registros no histórico.`);
    list.forEach(item => {
      console.log(`- ID: ${item.id}, Vídeo: ${item.videoName}, Criado em: ${item.createdAt}, UserId: ${item.userId}`);
    });
  } catch (err) {
    console.error("Erro ao buscar histórico:", err);
  } finally {
    process.exit(0);
  }
}

checkHistory();
