"use client";
import { useState, useCallback, useRef } from "react";

declare global {
  interface Window {
    google: any;
    gapi: any;
    onGoogleApiLoad: () => void;
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const PICKER_API = "https://apis.google.com/js/api.js";
const GIS_API = "https://accounts.google.com/gsi/client";

type PickerStatus = "idle" | "loading" | "picking" | "downloading" | "done" | "error";

export function useGoogleDrivePicker() {
  const [status, setStatus] = useState<PickerStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const gapiLoaded = useRef(false);

  const loadScript = useCallback((src: string): Promise<void> =>
    new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(s);
    }), []);

  const loadGapi = useCallback(async (): Promise<void> => {
    if (gapiLoaded.current) return;
    await loadScript(PICKER_API);
    await new Promise<void>((resolve) => {
      window.gapi.load("picker", () => {
        gapiLoaded.current = true;
        resolve();
      });
    });
  }, [loadScript]);

  const getAccessToken = useCallback(async (): Promise<string> => {
    if (tokenRef.current) return tokenRef.current;
    await loadScript(GIS_API);

    return await new Promise<string>((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: (resp: any) => {
          if (resp.error) {
            reject(new Error(resp.error));
            return;
          }
          tokenRef.current = resp.access_token;
          resolve(resp.access_token);
        },
      });
      client.requestAccessToken({ prompt: "consent" });
    });
  }, [loadScript]);

  const openPicker = useCallback(
    (accessToken: string): Promise<{ id: string; name: string; mimeType: string; sizeBytes: number }> =>
      new Promise((resolve, reject) => {
        const picker = new window.google.picker.PickerBuilder()
          .addView(
            new window.google.picker.View(window.google.picker.ViewId.DOCS_VIDEOS)
          )
          .setOAuthToken(accessToken)
          .setDeveloperKey(API_KEY)
          .setTitle("Selecione um vídeo do Google Drive")
          .setCallback((data: any) => {
            if (data.action === window.google.picker.Action.PICKED) {
              const doc = data.docs[0];
              resolve({
                id: doc.id,
                name: doc.name,
                mimeType: doc.mimeType,
                sizeBytes: doc.sizeBytes || 0,
              });
            } else if (data.action === window.google.picker.Action.CANCEL) {
              reject(new Error("CANCELLED"));
            }
          })
          .build();
        picker.setVisible(true);
      }),
    []
  );

  const downloadFile = useCallback(
    async (fileId: string, filename: string, mimeType: string, accessToken: string): Promise<File> => {
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) throw new Error(`Erro ao baixar arquivo: ${res.status}`);

      const contentLength = res.headers.get("content-length");
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream não disponível");

      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total > 0) setProgress(Math.round((received / total) * 100));
      }

      const blob = new Blob(chunks, { type: mimeType || "video/mp4" });
      return new File([blob], filename, { type: mimeType || "video/mp4" });
    },
    []
  );

  const pickFile = useCallback(async (): Promise<File | null> => {
    if (!CLIENT_ID || CLIENT_ID.includes("SEU_CLIENT_ID")) {
      setError("Google Client ID não configurado. Adicione NEXT_PUBLIC_GOOGLE_CLIENT_ID no .env");
      return null;
    }
    if (!API_KEY || API_KEY.includes("SUA_API_KEY")) {
      setError("Google API Key não configurada. Adicione NEXT_PUBLIC_GOOGLE_API_KEY no .env");
      return null;
    }

    setStatus("loading");
    setError(null);
    setProgress(0);

    try {
      const [accessToken] = await Promise.all([
        getAccessToken(),
        loadGapi(),
      ]);

      setStatus("picking");
      const fileInfo = await openPicker(accessToken);

      setStatus("downloading");
      setProgress(0);
      const file = await downloadFile(fileInfo.id, fileInfo.name, fileInfo.mimeType, accessToken);

      setStatus("done");
      setTimeout(() => setStatus("idle"), 2000);
      return file;
    } catch (e: any) {
      if (e.message === "CANCELLED") {
        setStatus("idle");
        return null;
      }
      console.error("Google Drive error:", e);
      setError(e.message || "Erro ao importar do Google Drive.");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 5000);
      return null;
    }
  }, [getAccessToken, loadGapi, openPicker, downloadFile]);

  return { pickFile, status, progress, error };
}
