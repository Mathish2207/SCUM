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
        prices.append(el("span", "sell", vente == null ? "Sur demande" : price(vente, it.devise)), el("span", "buy", it.rachat == null ? "—" : price(it.rachat, it.devise)));
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

  // ---------- Cartes de session (chasse et pêche) ----------
  function renderSessions(box, list, emptyText) {
    const items = (list || []).filter((x) => x.nom);
    if (!items.length) { box.replaceChildren(el("p", "empty", emptyText)); return; }
    const frag = document.createDocumentFragment();
    for (const s of items) {
      const off = s.dispo === false;
      const card = el("article", "session" + (off ? " full" : ""));
      const top = el("div", "session-top");
      if (s.niveau) top.append(el("span", "level", s.niveau));
      top.append(el("span", "avail " + (off ? "no" : "yes"), off ? "Non disponible" : "Disponible"));
      card.append(top, el("h3", null, s.nom));
      if (s.description) card.append(el("p", "session-desc", s.description));
      const meta = el("ul", "session-meta");
      if (s.duree) meta.append(el("li", null, "Durée : " + s.duree));
      if (s.places) meta.append(el("li", null, s.places));
      card.append(meta);
      card.append(el("p", "session-price", s.prix == null ? "Prix sur demande" : price(s.prix, s.devise)));
      frag.append(card);
    }
    box.replaceChildren(frag);
  }
  renderSessions(sessionList, data.sessions, "Les prochaines sessions de chasse seront annoncées bientôt.");
  renderSessions(document.getElementById("peche-list"), data.peche?.sessions, "Les prochaines parties de pêche seront annoncées bientôt.");

  // ---------- Zones de pêche ----------
  const zones = (data.peche?.zones || []).filter((z) => z.nom && z.visible !== false);
  if (zones.length) {
    const box = document.getElementById("zones");
    for (const z of zones) {
      const card = el("article", "zone");
      card.append(el("h4", null, z.nom));
      if (z.description) card.append(el("p", "zone-desc", z.description));
      const fish = String(z.poissons || "").split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
      if (fish.length) {
        const ul = el("ul", "fish");
        fish.forEach((f) => ul.append(el("li", null, f)));
        card.append(ul);
      }
      box.append(card);
    }
    document.getElementById("zones-wrap").hidden = false;
  }

  // ---------- Affiches du magasin ----------
  const affBox = document.getElementById("affiches");
  for (const a of (data.affiches || []).filter((x) => x.titre && x.visible !== false)) {
    const card = el("aside", "affiche");
    const txt = el("div", "affiche-text");
    txt.append(el("p", "affiche-kicker", "Avis de la hutte"), el("h3", null, a.titre));
    if (a.texte) txt.append(el("p", "affiche-desc", a.texte));
    card.append(txt);
    if (a.prix != null) {
      const p = el("p", "affiche-price", price(a.prix, a.devise));
      if (a.unite) p.append(el("span", null, "/ " + a.unite));
      card.append(p);
    }
    affBox.append(card);
  }

  // ---------- Sections masquées (aperçu réservé à l'admin) ----------
  let apercu = false;
  try { apercu = new URLSearchParams(location.search).has("apercu") && localStorage.getItem("hutte-apercu") === "1"; } catch (_) {}
  const sec = data.sections || {};
  document.querySelectorAll("[data-section]").forEach((node) => {
    if (sec[node.dataset.section] !== false) return;
    if (apercu) {
      node.classList.add("preview-hidden");
      node.prepend(el("p", "preview-banner", "Aperçu admin : cette section est masquée pour les visiteurs"));
    } else {
      node.hidden = true;
    }
  });
  document.querySelectorAll("[data-needs]").forEach((a) => { if (sec[a.dataset.needs] === false && !apercu) a.hidden = true; });
  if (apercu) document.body.prepend(el("div", "preview-top", "Mode aperçu admin : les sections masquées sont visibles (hachurées)"));

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
