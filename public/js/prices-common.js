// Chargement des prix, partagé par le site et l'admin.
// 1) on demande à la fonction Netlify (/api/prices) les prix enregistrés
// 2) si rien n'a encore été enregistré (ou en local sans fonctions), on prend le fichier par défaut
window.HutteData = {
  async load() {
    try {
      const res = await fetch("/api/prices", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.categories)) return data;
      }
    } catch (_) { /* fonction indisponible : on bascule sur le fichier par défaut */ }
    const res = await fetch("/data/prix-defaut.json", { cache: "no-store" });
    return res.json();
  },

  formatPrice(item) {
    const n = Number(item.prix) || 0;
    const montant = n.toLocaleString("fr-FR");
    return item.devise === "or" ? `${montant} or` : `${montant} $`;
  },
};
