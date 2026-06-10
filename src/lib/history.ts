import { supabase } from "@/integrations/supabase/client";

export interface LocalHistoryEntry {
  id: string;
  tool_slug: string;
  tool_name: string;
  file_names: string[];
  output_name?: string;
  output_size?: number;
  output_type?: string;
  output_id?: string;
  created_at: string;
}

const LOCAL_HISTORY_KEY = "converta.history.v1";
const DB_NAME = "converta-output-store";
const STORE_NAME = "outputs";

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openOutputDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveOutputBlob(id: string, blob: Blob) {
  if (!canUseBrowserStorage()) return;
  const db = await openOutputDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getLocalOutput(id: string): Promise<Blob | null> {
  if (!canUseBrowserStorage()) return null;
  const db = await openOutputDb();
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return blob;
}

export function getLocalHistory(): LocalHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as LocalHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

async function saveLocalHistory(entry: Omit<LocalHistoryEntry, "id" | "created_at"> & { blob?: Blob }) {
  if (typeof window === "undefined") return;
  const output_id = entry.blob ? crypto.randomUUID() : undefined;
  if (entry.blob && output_id) await saveOutputBlob(output_id, entry.blob);
  const nextEntry: LocalHistoryEntry = {
    id: crypto.randomUUID(),
    tool_slug: entry.tool_slug,
    tool_name: entry.tool_name,
    file_names: entry.file_names,
    output_name: entry.output_name,
    output_size: entry.output_size,
    output_type: entry.blob?.type,
    output_id,
    created_at: new Date().toISOString(),
  };
  const existing = getLocalHistory();
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify([nextEntry, ...existing].slice(0, 100)));
}

export async function logHistory(entry: {
  tool_slug: string;
  tool_name: string;
  file_names: string[];
  output_name?: string;
  output_size?: number;
  blob?: Blob;
}) {
  try {
    await saveLocalHistory(entry);
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("tool_history" as never).insert({
      user_id: data.user.id,
      tool_slug: entry.tool_slug,
      tool_name: entry.tool_name,
      file_names: entry.file_names,
      output_name: entry.output_name,
      output_size: entry.output_size,
    } as never);
  } catch {
    // silent fail — history is best-effort
  }
}
