// Espace admin : connexion par mot de passe + édition du barème.
// Le mot de passe est vérifié côté serveur (fonction Netlify) ; il n'est jamais écrit dans le code.
(function () {
  const $ = (id) => document.getElementById(id);
  const KEY = "hutte-admin-pass";
  let password = sessionStorage.getItem(KEY) || "";
  let dirty = false;

  const tplCat = $("tpl-cat");
  const tplItem = $("tpl-item");
  const cats = $("cats");

  // ---------- Notification ----------
  let toastTimer;
  function toast(msg, bad = false) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.toggle("bad", bad);
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }

  // ---------- Connexion ----------
  async function checkPassword(pass) {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { Authorization: "Bearer " + pass },
    });
    if (res.status === 429) throw new Error("Trop de tentatives, réessayez dans quelques minutes.");
    if (res.status === 500) throw new Error("Le mot de passe admin n'est pas configuré sur Netlify (ADMIN_PASSWORD).");
    return res.ok;
  }

  async function enter() {
    $("login").hidden = true;
    $("editor").hidden = false;
    $("logout").hidden = false;
    const data = await HutteData.load();
    render(data);
    dirty = false;
  }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pass = $("password").value;
    $("login-error").textContent = "";
    try {
      if (await checkPassword(pass)) {
        password = pass;
        sessionStorage.setItem(KEY, pass);
        $("password").value = "";
        enter();
      } else {
        $("login-error").textContent = "Mot de passe incorrect.";
      }
    } catch (err) {
      $("login-error").textContent = err.message || "Connexion impossible.";
    }
  });

  $("logout").addEventListener("click", () => {
    if (dirty && !confirm("Des modifications ne sont pas enregistrées. Se déconnecter quand même ?")) return;
    sessionStorage.removeItem(KEY);
    location.reload();
  });

  // ---------- Rendu ----------
  function addItem(tbody, it = {}) {
    const row = tplItem.content.firstElementChild.cloneNode(true);
    row.querySelector(".f-nom").value = it.nom || "";
    row.querySelector(".f-prix").value = it.prix ?? "";
    row.querySelector(".f-devise").value = it.devise === "or" ? "or" : "$";
    row.querySelector(".f-unite").value = it.unite || "";
    row.querySelector(".f-dispo").checked = it.dispo !== false;
    tbody.append(row);
    return row;
  }

  function addCat(cat = { nom: "", items: [] }) {
    const node = tplCat.content.firstElementChild.cloneNode(true);
    node.querySelector(".cat-name").value = cat.nom || "";
    const tbody = node.querySelector("tbody");
    (cat.items || []).forEach((it) => addItem(tbody, it));
    cats.append(node);
    return node;
  }

  function render(data) {
    cats.replaceChildren();
    (data.categories || []).forEach(addCat);
  }

  // ---------- Lecture du formulaire ----------
  function collect() {
    return {
      categories: [...cats.querySelectorAll(".cat")].map((c) => ({
        nom: c.querySelector(".cat-name").value.trim(),
        items: [...c.querySelectorAll("tbody tr")]
          .map((r) => ({
            nom: r.querySelector(".f-nom").value.trim(),
            prix: Math.max(0, Number(r.querySelector(".f-prix").value) || 0),
            devise: r.querySelector(".f-devise").value,
            unite: r.querySelector(".f-unite").value.trim(),
            dispo: r.querySelector(".f-dispo").checked,
          }))
          .filter((it) => it.nom),
      })).filter((c) => c.nom),
    };
  }

  // ---------- Actions ----------
  cats.addEventListener("input", () => (dirty = true));
  cats.addEventListener("change", () => (dirty = true));

  cats.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const cat = btn.closest(".cat");
    const row = btn.closest("tr");
    switch (btn.dataset.act) {
      case "item-add": {
        const r = addItem(cat.querySelector("tbody"), { devise: "$", dispo: true });
        r.querySelector(".f-nom").focus();
        break;
      }
      case "item-del": row.remove(); break;
      case "item-up": row.previousElementSibling?.before(row); break;
      case "item-down": row.nextElementSibling?.after(row); break;
      case "cat-up": cat.previousElementSibling?.before(cat); break;
      case "cat-down": cat.nextElementSibling?.after(cat); break;
      case "cat-del": {
        const name = cat.querySelector(".cat-name").value || "cette catégorie";
        if (confirm(`Supprimer « ${name} » et tous ses articles ?`)) cat.remove();
        break;
      }
    }
    dirty = true;
  });

  $("add-cat").addEventListener("click", () => {
    const c = addCat();
    addItem(c.querySelector("tbody"), { devise: "$", dispo: true });
    c.querySelector(".cat-name").focus();
    c.scrollIntoView({ behavior: "smooth", block: "center" });
    dirty = true;
  });

  $("save").addEventListener("click", async () => {
    const btn = $("save");
    btn.disabled = true;
    btn.textContent = "Enregistrement…";
    try {
      const res = await fetch("/api/prices", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + password },
        body: JSON.stringify(collect()),
      });
      if (res.status === 401) {
        sessionStorage.removeItem(KEY);
        toast("Session expirée : reconnectez-vous.", true);
        setTimeout(() => location.reload(), 1500);
        return;
      }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Erreur " + res.status);
      const saved = await res.json();
      render(saved);
      dirty = false;
      toast("Barème enregistré ✔");
    } catch (err) {
      toast("Échec : " + err.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Enregistrer";
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  // Reconnexion automatique pendant la session de l'onglet
  if (password) {
    checkPassword(password).then((ok) => (ok ? enter() : sessionStorage.removeItem(KEY))).catch(() => {});
  }
})();
