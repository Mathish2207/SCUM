import { requireAdmin, json } from "../lib/auth.mjs";

// POST /api/login — vérifie seulement le mot de passe (utilisé par la page admin).
export default async (req, context) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  const denied = requireAdmin(req, context);
  if (denied) return denied;
  return json({ ok: true });
};

export const config = { path: "/api/login" };
