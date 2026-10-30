// Affichage du barème sur la page publique.
// Tout le texte est inséré avec textContent : aucune donnée n'est interprétée comme du HTML.
(async function () {
  const catalog = document.getElementById("catalog");
  const updated = document.getElementById("updated");

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  let data;
  try {
    data = await HutteData.load();
  } catch (e) {
    catalog.replaceChildren(el("p", "empty", "Impossible de charger les prix pour le moment."));
    return;
  }

  const cats = (data.categories || []).filter(c => (c.items || []).length);
  if (!cats.length) {
    catalog.replaceChildren(el("p", "empty", "Le barème arrive bientôt. Repassez à la hutte !"));
    return;
  }

  const frag = document.createDocumentFragment();
  for (const cat of cats) {
    const card = el("section", "card");
    card.append(el("h3", null, cat.nom));
    const ul = el("ul");
    for (const it of cat.items) {
      const li = el("li", "item" + (it.dispo === false ? " out" : ""));
      const name = el("span", "item-name", it.nom);
      if (it.unite) name.append(el("span", "item-unit", "/ " + it.unite));
      li.append(name, el("span", "item-dots"));
      if (it.dispo === false) li.append(el("span", "badge", "Rupture"));
      li.append(el("span", "item-price", HutteData.formatPrice(it)));
      ul.append(li);
    }
    card.append(ul);
    frag.append(card);
  }
  catalog.replaceChildren(frag);

  if (data.maj) {
    const d = new Date(data.maj);
    if (!isNaN(d)) {
      updated.textContent = "Mis à jour le " + d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      updated.hidden = false;
    }
  }
})();
