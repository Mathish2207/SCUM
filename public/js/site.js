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
  // les catégories masquées dans l'admin ne s'affichent pas
  const cats = (data.categories || []).filter((c) => c.visible !== false && (c.items || []).length);
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
    setupFilters(cats);
  }

  // ---------- Recherche + filtres du barème ----------
  // Recherche sans accents ni majuscules : « peau ours » trouve « Peau d'ours »
  function norm(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function setupFilters(cats) {
    const toolbar = document.getElementById("toolbar");
    const input = document.getElementById("search");
    const chipsBox = document.getElementById("chips");
    const onlyDispo = document.getElementById("only-dispo");
    const count = document.getElementById("count");
    const noResult = document.getElementById("no-result");
    const cards = [...catalog.querySelectorAll(".card")];
    const total = catalog.querySelectorAll(".item").length;
    let activeCat = "";

    // index de recherche sur chaque ligne
    cards.forEach((card, i) => {
      card.dataset.cat = String(i);
      card.querySelectorAll(".item").forEach((li) => {
        li.dataset.search = norm(li.querySelector(".item-label").textContent + " " + (li.querySelector(".item-unit")?.textContent || "") + " " + cats[i].nom);
      });
    });

    const mkChip = (label, value) => {
      const b = el("button", "chip" + (value === "" ? " active" : ""), label);
      b.type = "button";
      b.dataset.value = value;
      b.setAttribute("aria-pressed", value === "" ? "true" : "false");
      return b;
    };
    chipsBox.append(mkChip("Tout", ""), ...cats.map((c, i) => mkChip(c.nom, String(i))));

    function apply() {
      const words = norm(input.value).split(" ").filter(Boolean);
      let shown = 0;
      for (const card of cards) {
        let inCard = 0;
        const catOk = !activeCat || card.dataset.cat === activeCat;
        card.querySelectorAll(".item").forEach((li) => {
          const ok = catOk && words.every((w) => li.dataset.search.includes(w)) && (!onlyDispo.checked || !li.classList.contains("out"));
          li.hidden = !ok;
          if (ok) inCard++;
        });
        card.hidden = inCard === 0;
        shown += inCard;
      }
      const filtered = words.length || activeCat || onlyDispo.checked;
      count.textContent = filtered ? `${shown} article${shown > 1 ? "s" : ""} sur ${total}` : `${total} article${total > 1 ? "s" : ""}`;
      noResult.hidden = shown > 0;
      catalog.classList.toggle("filtered", Boolean(words.length));
    }

    input.addEventListener("input", apply);
    onlyDispo.addEventListener("change", apply);
    chipsBox.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      activeCat = b.dataset.value;
      chipsBox.querySelectorAll(".chip").forEach((c) => {
        c.classList.toggle("active", c === b);
        c.setAttribute("aria-pressed", c === b ? "true" : "false");
      });
      apply();
    });
    document.getElementById("reset").addEventListener("click", () => {
      input.value = ""; onlyDispo.checked = false; activeCat = "";
      chipsBox.querySelector('[data-value=""]').click();
      input.focus();
    });
    // raccourci clavier « / » pour aller dans la recherche
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !/^(input|textarea|select)$/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        input.focus();
        input.scrollIntoView({ behavior: "smooth", block: "center" });
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
