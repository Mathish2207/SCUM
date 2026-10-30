import { getStore } from "@netlify/blobs";
import { requireAdmin, json } from "../lib/auth.mjs";

// Les prix sont stockés dans Netlify Blobs (stockage clé/valeur inclus avec Netlify, rien à installer).
const STORE = "la-hutte";
const KEY = "prix";

const str = (v, max) => String(v ?? "").trim().slice(0, max);

// Nettoie et valide ce qu'envoie l'admin : on ne garde que les champs attendus.
function sanitize(input) {
  if (!input || !Array.isArray(input.categories)) throw new Error("Format invalide.");
  if (input.categories.length > 50) throw new Error("Trop de catégories (50 max).");

  const categories = input.categories
    .map((c) => {
      const items = Array.isArray(c?.items) ? c.items : [];
      if (items.length > 200) throw new Error("Trop d'articles dans une catégorie (200 max).");
      return {
        nom: str(c?.nom, 60),
        items: items
          .map((it) => {
            const prix = Number(it?.prix);
            return {
              nom: str(it?.nom, 80),
              prix: Number.isFinite(prix) && prix >= 0 ? Math.min(Math.round(prix * 100) / 100, 1e9) : 0,
              devise: it?.devise === "or" ? "or" : "$",
              unite: str(it?.unite, 30),
              dispo: it?.dispo !== false,
            };
          })
          .filter((it) => it.nom),
      };
    })
    .filter((c) => c.nom);

  return { maj: new Date().toISOString(), categories };
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
    if (raw.length > 200_000) return json({ error: "Données trop volumineuses." }, 413);

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
