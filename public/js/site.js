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

  // ---------- Barème : grille compacte, une catégorie à la fois ----------
  const cats = (data.categories || []).filter((c) => c.visible !== false && (c.items || []).length);
  if (!cats.length) {
    catalog.replaceChildren(el("p", "empty", "Le barème arrive bientôt. Repassez à la hutte !"));
  } else {
    const frag = document.createDocumentFragment();
    cats.forEach((cat, i) => {
      const h = el("h3", "grid-title", cat.nom);
      h.dataset.cat = String(i);
      frag.append(h);
      for (const it of cat.items) {
        const vente = it.vente ?? it.prix;
        const tile = el("article", "tile" + (it.dispo === false ? " out" : ""));
        tile.dataset.cat = String(i);
        tile.dataset.search = norm(it.nom + " " + (it.unite || "") + " " + cat.nom);
        const info = el("div", "tile-info");
        const name = el("p", "tile-name", it.nom);
        name.title = it.nom + (it.unite ? " (" + it.unite + ")" : "");
        info.append(name);
        if (it.unite || it.dispo === false) {
          const meta = el("p", "tile-meta", it.unite || "");
          if (it.dispo === false) meta.append(el("span", "badge", "Rupture"));
          info.append(meta);
        }
        const prices = el("p", "tile-prices");
        prices.append(el("span", "sell", price(vente, it.devise)), el("span", "buy", it.rachat == null ? "—" : price(it.rachat, it.devise)));
        info.append(prices);
        tile.append(thumb(it), info);
        frag.append(tile);
      }
    });
    catalog.replaceChildren(frag);
    catalog.classList.add("grid");
    setupFilters(cats);
  }

  // Recherche sans accents ni majuscules : « peau ours » trouve « Peau d'ours »
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function setupFilters(cats) {
    const toolbar = document.getElementById("toolbar");
    const input = document.getElementById("search");
    const chipsBox = document.getElementById("chips");
    const onlyDispo = document.getElementById("only-dispo");
    const count = document.getElementById("count");
    const noResult = document.getElementById("no-result");
    const tiles = [...catalog.querySelectorAll(".tile")];
    const titles = [...catalog.querySelectorAll(".grid-title")];
    let activeCat = "0"; // on ouvre sur la première catégorie

    const mkChip = (label, value, n) => {
      const b = el("button", "chip", label);
      if (n != null) b.append(el("span", "chip-n", String(n)));
      b.type = "button";
      b.dataset.value = value;
      return b;
    };
    chipsBox.append(...cats.map((c, i) => mkChip(c.nom, String(i), c.items.length)), mkChip("Tout", "", tiles.length));

    function apply() {
      const words = norm(input.value).split(" ").filter(Boolean);
      // une recherche porte sur tout le barème
      const cat = words.length ? "" : activeCat;
      let shown = 0;
      const perCat = {};
      for (const t of tiles) {
        const ok = (!cat || t.dataset.cat === cat) && words.every((w) => t.dataset.search.includes(w)) && (!onlyDispo.checked || !t.classList.contains("out"));
        t.hidden = !ok;
        if (ok) { shown++; perCat[t.dataset.cat] = 1; }
      }
      // titres de catégorie seulement en vue « Tout » ou en recherche
      titles.forEach((h) => (h.hidden = !!cat || !perCat[h.dataset.cat]));
      chipsBox.querySelectorAll(".chip").forEach((c) => {
        const on = !words.length && c.dataset.value === activeCat;
        c.classList.toggle("active", on);
        c.setAttribute("aria-pressed", on ? "true" : "false");
      });
      count.textContent = words.length
        ? `${shown} résultat${shown > 1 ? "s" : ""} dans tout le barème`
        : `${shown} article${shown > 1 ? "s" : ""}`;
      noResult.hidden = shown > 0;
    }

    input.addEventListener("input", apply);
    onlyDispo.addEventListener("change", apply);
    chipsBox.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      activeCat = b.dataset.value;
      input.value = "";
      apply();
    });
    document.getElementById("reset").addEventListener("click", () => {
      input.value = ""; onlyDispo.checked = false; activeCat = "0"; apply(); input.focus();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !/^(input|textarea|select)$/i.test(document.activeElement.tagName)) {
        e.preventDefault(); input.focus(); input.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      if (e.key === "Escape" && document.activeElement === input) { input.value = ""; apply(); }
    });

    toolbar.hidden = false;
    apply();
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


  if (data.maj) {
    const d = new Date(data.maj);
    if (!isNaN(d)) {
      updated.textContent = "Mis à jour le " + d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      updated.hidden = false;
    }
  }
})();
