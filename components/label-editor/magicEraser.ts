/**
 * Client du serveur de détourage « gomme magique » (detourage/server.py).
 * L'upload crée une session (BiRefNet + embedding SAM côté serveur) et
 * renvoie le PNG détouré ; chaque clic renvoie le PNG mis à jour.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_MAGIC_ERASER_URL ?? "http://localhost:8001";

export async function createEraserSession(
  file: File,
): Promise<{ sessionId: string; blob: Blob }> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${BASE_URL}/sessions`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`détourage : HTTP ${res.status}`);
  const sessionId = res.headers.get("X-Session-Id");
  if (!sessionId) throw new Error("détourage : en-tête X-Session-Id absent");
  return { sessionId, blob: await res.blob() };
}

export async function clickEraserSession(
  sessionId: string,
  x: number,
  y: number,
): Promise<Blob> {
  const res = await fetch(`${BASE_URL}/sessions/${sessionId}/clicks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x, y }),
  });
  if (!res.ok) throw new Error(`gomme magique : HTTP ${res.status}`);
  return res.blob();
}

/** Libération côté serveur, sans attente ni gestion d'échec (éviction LRU en repli). */
export function deleteEraserSession(sessionId: string): void {
  fetch(`${BASE_URL}/sessions/${sessionId}`, { method: "DELETE" }).catch(
    () => {},
  );
}
