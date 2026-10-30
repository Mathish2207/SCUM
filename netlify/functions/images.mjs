import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";
import { requireAdmin, json } from "../lib/auth.mjs";

// Images des articles, envoyées depuis l'admin.
//   POST /api/img        (mot de passe requis) corps = l'image brute → { url }
//   GET  /api/img/:id    sert l'image
const STORE = "la-hutte-images";
const MAX = 400 * 1024;

// On vérifie le vrai format du fichier (octets de début), pas seulement ce que dit le navigateur.
function sniff(b) {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return ["png", "image/png"];
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return ["jpg", "image/jpeg"];
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return ["gif", "image/gif"];
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return ["webp", "image/webp"];
  return null;
}

export default async (req, context) => {
  const store = getStore({ name: STORE });

  if (req.method === "GET") {
    const id = context.params?.id || "";
    if (!/^[a-z0-9-]+\.(png|jpg|webp|gif)$/.test(id)) return new Response("Introuvable", { status: 404 });
    const res = await store.getWithMetadata(id, { type: "arrayBuffer" });
    if (!res) return new Response("Introuvable", { status: 404 });
    return new Response(res.data, {
      headers: {
        "Content-Type": res.metadata?.type || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (req.method === "POST") {
    const denied = requireAdmin(req, context);
    if (denied) return denied;
    const buf = new Uint8Array(await req.arrayBuffer());
    if (buf.length === 0) return json({ error: "Fichier vide." }, 400);
    if (buf.length > MAX) return json({ error: "Image trop lourde (400 Ko max)." }, 413);
    const kind = sniff(buf);
    if (!kind) return json({ error: "Format non accepté (PNG, JPG, WEBP ou GIF)." }, 415);
    const id = `${randomUUID()}.${kind[0]}`;
    await store.set(id, buf, { metadata: { type: kind[1] } });
    return json({ url: `/api/img/${id}` });
  }

  return json({ error: "Méthode non autorisée" }, 405);
};

export const config = { path: ["/api/img", "/api/img/:id"] };
