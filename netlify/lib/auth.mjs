import { createHash, timingSafeEqual } from "node:crypto";

const sha = (s) => createHash("sha256").update(String(s)).digest();

// Limite simple des essais ratés (par instance de fonction) pour freiner le forçage du mot de passe.
const failures = new Map(); // ip -> { count, until }
const MAX_FAILS = 8;
const LOCK_MS = 10 * 60 * 1000;

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * Vérifie l'en-tête "Authorization: Bearer <mot de passe>".
 * Renvoie null si OK, sinon une Response d'erreur à retourner telle quelle.
 */
export function requireAdmin(req, context) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return json({ error: "ADMIN_PASSWORD non configuré sur Netlify." }, 500);

  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "inconnu";
  const now = Date.now();
  const f = failures.get(ip);
  if (f && f.until > now) return json({ error: "Trop de tentatives." }, 429);

  const header = req.headers.get("authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const ok = given.length > 0 && timingSafeEqual(sha(given), sha(expected));

  if (!ok) {
    const expired = f && f.until !== 0 && f.until <= now; // ancien blocage terminé : on repart de zéro
    const count = (expired ? 0 : f?.count || 0) + 1;
    failures.set(ip, { count, until: count >= MAX_FAILS ? now + LOCK_MS : 0 });
    return json({ error: "Mot de passe incorrect." }, 401);
  }
  failures.delete(ip);
  return null;
}
