import { getStore } from "@netlify/blobs";
import { requireAdmin, json } from "../lib/auth.mjs";

// Le catalogue (articles vente/rachat + sessions de chasse) est stocké dans Netlify Blobs.
const STORE = "la-hutte";
const KEY = "prix";

const str = (v, max) => String(v ?? "").trim().slice(0, max);
const money = (v) => {
  if (v === "" || v === null || v === undefined) return null; // null = pas de prix (ex : on ne rachète pas)
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n * 100) / 100, 1e9) : null;
};
const devise = (v) => (v === "or" ? "or" : "$");
// Image : soit une image envoyée via l'admin (/api/img/...), soit un lien https
const image = (v) => {
  const s = str(v, 500);
  if (/^\/api\/img\/[a-z0-9-]+\.(png|jpg|webp|gif)$/.test(s)) return s;
  if (/^https:\/\/[^\s"'<>]+$/.test(s)) return s;
  return "";
};

function sanitize(input) {
  if (!input || !Array.isArray(input.categories)) throw new Error("Format invalide.");
  if (input.categories.length > 50) throw new Error("Trop de catégories (50 max).");
  const sessions = Array.isArray(input.sessions) ? input.sessions : [];
  if (sessions.length > 50) throw new Error("Trop de sessions (50 max).");

  const categories = input.categories
    .map((c) => {
      const items = Array.isArray(c?.items) ? c.items : [];
      if (items.length > 300) throw new Error("Trop d'articles dans une catégorie (300 max).");
      return {
        nom: str(c?.nom, 60),
        items: items
          .map((it) => ({
            nom: str(it?.nom, 80),
            image: image(it?.image),
            vente: money(it?.vente ?? it?.prix), // compatibilité avec l'ancien champ "prix"
            rachat: money(it?.rachat),
            devise: devise(it?.devise),
            unite: str(it?.unite, 30),
            dispo: it?.dispo !== false,
          }))
          .filter((it) => it.nom),
      };
    })
    .filter((c) => c.nom);

  return {
    maj: new Date().toISOString(),
    reservation: str(input.reservation, 300),
    categories,
    sessions: sessions
      .map((s) => ({
        nom: str(s?.nom, 80),
        description: str(s?.description, 600),
        niveau: str(s?.niveau, 30),
        appat: str(s?.appat, 60),
        duree: str(s?.duree, 40),
        places: str(s?.places, 30),
        prix: money(s?.prix),
        devise: devise(s?.devise),
        dispo: s?.dispo !== false,
      }))
      .filter((s) => s.nom),
  };
}

export default async (req, context) => {
  const store = getStore({ name: STORE, consistency: "strong" });

  if (req.method === "GET") {
    const data = await store.get(KEY, { type: "json" });
    // null => rien d'enregistré pour l'instant, le site utilisera /data/prix-defaut.json
    return json(data ?? { categories: null });
  }

  if (req.method === "PUT") {
    const denied = requireAdmin(req, context);
    if (denied) return denied;

    const raw = await req.text();
    if (raw.length > 500_000) return json({ error: "Données trop volumineuses." }, 413);

    let clean;
    try {
      clean = sanitize(JSON.parse(raw));
    } catch (e) {
      return json({ error: e.message || "JSON invalide." }, 400);
    }
    await store.setJSON(KEY, clean);
    return json(clean);
  }

  return json({ error: "Méthode non autorisée" }, 405);
};

export const config = { path: "/api/prices" };
