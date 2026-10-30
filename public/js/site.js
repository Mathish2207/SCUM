// Affichage du barème (vente / rachat) et des sessions sur la page publique.
// Tout le texte est inséré avec textContent : aucune donnée n'est interprétée comme du HTML.
(async function () {
  const catalog = document.getElementById("catalog");
  const sessionList = document.getElementById("session-list");
  const updated = document.getElementById("updated");

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const price = (value, devise) => (value == null ? "—" : HutteData.formatPrice({ prix: value, devise }));

  // Vignette de l'article : l'image si elle existe, sinon les initiales
  function thumb(it) {
    const box = el("span", "thumb");
    if (it.image) {
      const img = el("img");
      img.src = it.image;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => { img.remove(); box.textContent = initials(it.nom); };
      box.append(img);
    } else {
      box.textContent = initials(it.nom);
      box.classList.add("thumb-empty");
    }
    return box;
  }
  const initials = (s) => s.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  let data;
  try {
    data = await HutteData.load();
  } catch (e) {
    catalog.replaceChildren(el("p", "empty", "Impossible de charger les prix pour le moment."));
    return;
  }

  // ---------- Barème ----------
  const cats = (data.categories || []).filter((c) => (c.items || []).length);
  if (!cats.length) {
    catalog.replaceChildren(el("p", "empty", "Le barème arrive bientôt. Repassez à la hutte !"));
  } else {
    const frag = document.createDocumentFragment();
    for (const cat of cats) {
      const card = el("section", "card");
      const head = el("div", "card-head");
      head.append(el("h3", null, cat.nom), el("span", "col", "Vente"), el("span", "col", "Rachat"));
      card.append(head);
      const ul = el("ul");
      for (const it of cat.items) {
        const vente = it.vente ?? it.prix; // compatibilité ancien format
        const li = el("li", "item" + (it.dispo === false ? " out" : ""));
        const name = el("span", "item-name");
        name.append(el("span", "item-label", it.nom));
        if (it.unite) name.append(el("span", "item-unit", it.unite));
        if (it.dispo === false) name.append(el("span", "badge", "Rupture"));
        li.append(thumb(it), name, el("span", "item-price sell", price(vente, it.devise)), el("span", "item-price buy", price(it.rachat, it.devise)));
        ul.append(li);
      }
      card.append(ul);
      frag.append(card);
    }
    catalog.replaceChildren(frag);
  }

  // ---------- Sessions ----------
  const sessions = (data.sessions || []).filter((s) => s.nom);
  if (!sessions.length) {
    sessionList.replaceChildren(el("p", "empty", "Les prochaines sessions seront annoncées bientôt."));
  } else {
    const frag = document.createDocumentFragment();
    for (const s of sessions) {
      const card = el("article", "session" + (s.dispo === false ? " full" : ""));
      const top = el("div", "session-top");
      if (s.niveau) top.append(el("span", "level", s.niveau));
      if (s.dispo === false) top.append(el("span", "badge", "Complet"));
      card.append(top, el("h3", null, s.nom));
      if (s.description) card.append(el("p", "session-desc", s.description));
      const meta = el("ul", "session-meta");
      if (s.duree) meta.append(el("li", null, "Durée : " + s.duree));
      if (s.places) meta.append(el("li", null, s.places));
      card.append(meta);
      card.append(el("p", "session-price", s.prix == null ? "Prix sur demande" : price(s.prix, s.devise)));
      frag.append(card);
    }
    sessionList.replaceChildren(frag);
  }
  // ---------- Commandes / réservations (forum Discord) ----------
  const text = data.commande?.texte || data.reservation || "";
  const link = data.commande?.discord || "";
  document.querySelectorAll("[data-order]").forEach((box) => {
    if (!text && !link) return;
    box.querySelector("[data-order-text]").textContent = text;
    const a = box.querySelector("[data-order-link]");
    if (link) { a.href = link; a.hidden = false; }
    box.hidden = false;
  });
  const nav = document.querySelector("[data-nav-discord]");
  if (link && nav) { nav.href = link; nav.target = "_blank"; nav.rel = "noopener"; nav.hidden = false; }

  if (data.maj) {
    const d = new Date(data.maj);
    if (!isNaN(d)) {
      updated.textContent = "Mis à jour le " + d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      updated.hidden = false;
    }
  }
})();
