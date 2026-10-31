// Chargement des prix, partagé par le site et l'admin.
// 1) on demande à la fonction Netlify (/api/prices) les prix enregistrés
// 2) si rien n'a encore été enregistré (ou en local sans fonctions), on prend le fichier par défaut
window.HutteData = {
  async load() {
    const defaults = await fetch("/data/prix-defaut.json", { cache: "no-store" }).then((r) => r.json());
    try {
      const res = await fetch("/api/prices", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.categories)) {
          // données enregistrées avant l'ajout d'une rubrique : on complète avec le contenu par défaut
          for (const k of ["affiches", "peche", "sections"]) if (data[k] === undefined) data[k] = defaults[k];
          return data;
        }
      }
    } catch (_) { /* fonction indisponible : on bascule sur le fichier par défaut */ }
    return defaults;
  },

  formatPrice(item) {
    const n = Number(item.prix) || 0;
    const montant = n.toLocaleString("fr-FR");
    return item.devise === "or" ? `${montant} or` : `${montant} $`;
  },
};
