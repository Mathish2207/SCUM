// Espace admin : connexion par mot de passe, barème (vente / rachat / images) et sessions de chasse.
// Le mot de passe est vérifié côté serveur (fonction Netlify) ; il n'est jamais écrit dans le code.
(function () {
  const $ = (id) => document.getElementById(id);
  const KEY = "hutte-admin-pass";
  const DEMO = window.HUTTE_DEMO === true; // aperçu sans serveur
  let password = sessionStorage.getItem(KEY) || "";
  let dirty = false;

  const tplCat = $("tpl-cat"), tplItem = $("tpl-item"), tplSession = $("tpl-session");
  const cats = $("cats"), sessionsBox = $("sessions");

  // ---------- Notification ----------
  let toastTimer;
  function toast(msg, bad = false) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.toggle("bad", bad);
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3400);
  }

  // ---------- Connexion ----------
  async function checkPassword(pass) {
    if (DEMO) return true;
    const res = await fetch("/api/login", { method: "POST", headers: { Authorization: "Bearer " + pass } });
    if (res.status === 429) throw new Error("Trop de tentatives, réessayez dans quelques minutes.");
    if (res.status === 500) throw new Error("Le mot de passe admin n'est pas configuré sur Netlify (ADMIN_PASSWORD).");
    return res.ok;
  }

  async function enter() {
    $("login").hidden = true;
    $("editor").hidden = false;
    $("logout").hidden = false;
    render(await HutteData.load());
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

  // ---------- Onglets ----------
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
      document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = p.id !== t.dataset.tab));
      $("add-cat").hidden = t.dataset.tab !== "tab-bareme";
    })
  );

  // ---------- Images ----------
  function setImage(row, url) {
    row.querySelector(".f-image").value = url || "";
    const btn = row.querySelector(".img-btn");
    btn.replaceChildren();
    if (url) {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      btn.append(img);
      btn.title = "Changer l'image (clic droit : retirer)";
    } else {
      const s = document.createElement("span");
      s.textContent = "+";
      btn.append(s);
      btn.title = "Choisir une image";
    }
  }

  // Réduit l'image à 160 px max et la convertit en WEBP avant l'envoi (fichiers légers)
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 160 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error("Conversion impossible"))), "image/webp", 0.9);
      };
      img.onerror = () => reject(new Error("Image illisible"));
      img.src = URL.createObjectURL(file);
    });
  }

  async function upload(file) {
    const blob = await shrink(file);
    if (DEMO) return URL.createObjectURL(blob);
    const res = await fetch("/api/img", {
      method: "POST",
      headers: { Authorization: "Bearer " + password, "Content-Type": blob.type },
      body: blob,
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Erreur " + res.status);
    return out.url;
  }

  let pickRow = null;
  $("file-pick").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file || !pickRow) return;
    const row = pickRow;
    row.classList.add("uploading");
    try {
      setImage(row, await upload(file));
      dirty = true;
      toast("Image ajoutée. Pensez à enregistrer.");
    } catch (err) {
      toast("Image refusée : " + err.message, true);
    } finally {
      row.classList.remove("uploading");
    }
  });

  // ---------- Rendu ----------
  const num = (v) => (v == null || v === "" ? "" : v);

  function addItem(tbody, it = {}) {
    const row = tplItem.content.firstElementChild.cloneNode(true);
    row.querySelector(".f-nom").value = it.nom || "";
    row.querySelector(".f-vente").value = num(it.vente ?? it.prix);
    row.querySelector(".f-rachat").value = num(it.rachat);
    row.querySelector(".f-devise").value = it.devise === "or" ? "or" : "$";
    row.querySelector(".f-unite").value = it.unite || "";
    row.querySelector(".f-dispo").checked = it.dispo !== false;
    setImage(row, it.image);
    tbody.append(row);
    return row;
  }

  // Catégorie masquée : grisée dans l'admin, absente du site
  function setVisible(node, on) {
    node.querySelector(".cat-visible").checked = on;
    node.querySelector(".vis-toggle span").textContent = on ? "Visible" : "Masquée";
    node.classList.toggle("cat-hidden", !on);
  }

  function addCat(cat = { nom: "", items: [] }) {
    const node = tplCat.content.firstElementChild.cloneNode(true);
    node.querySelector(".cat-name").value = cat.nom || "";
    setVisible(node, cat.visible !== false);
    const tbody = node.querySelector("tbody");
    (cat.items || []).forEach((it) => addItem(tbody, it));
    cats.append(node);
    return node;
  }

  function addSession(s = {}) {
    const node = tplSession.content.firstElementChild.cloneNode(true);
    node.querySelector(".s-nom").value = s.nom || "";
    node.querySelector(".s-desc").value = s.description || "";
    node.querySelector(".s-niveau").value = s.niveau || "";
    node.querySelector(".s-duree").value = s.duree || "";
    node.querySelector(".s-places").value = s.places || "";
    node.querySelector(".s-prix").value = num(s.prix);
    node.querySelector(".s-devise").value = s.devise === "or" ? "or" : "$";
    node.querySelector(".s-dispo").checked = s.dispo !== false;
    sessionsBox.append(node);
    return node;
  }

  function render(data) {
    cats.replaceChildren();
    sessionsBox.replaceChildren();
    (data.categories || []).forEach(addCat);
    (data.sessions || []).forEach(addSession);
    $("discord").value = data.commande?.discord || "";
    $("commande-texte").value = data.commande?.texte || data.reservation || "";
  }

  // ---------- Lecture du formulaire ----------
  const val = (root, sel) => root.querySelector(sel).value.trim();
  const optNum = (v) => (v === "" ? null : Math.max(0, Number(v) || 0));

  function collect() {
    return {
      commande: { texte: $("commande-texte").value.trim(), discord: $("discord").value.trim() },
      categories: [...cats.querySelectorAll(".cat")]
        .map((c) => ({
          nom: val(c, ".cat-name"),
          visible: c.querySelector(".cat-visible").checked,
          items: [...c.querySelectorAll("tbody tr")]
            .map((r) => ({
              nom: val(r, ".f-nom"),
              image: r.querySelector(".f-image").value,
              vente: optNum(val(r, ".f-vente")),
              rachat: optNum(val(r, ".f-rachat")),
              devise: r.querySelector(".f-devise").value,
              unite: val(r, ".f-unite"),
              dispo: r.querySelector(".f-dispo").checked,
            }))
            .filter((it) => it.nom),
        }))
        .filter((c) => c.nom),
      sessions: [...sessionsBox.querySelectorAll(".session-edit")]
        .map((n) => ({
          nom: val(n, ".s-nom"),
          description: val(n, ".s-desc"),
          niveau: val(n, ".s-niveau"),
          duree: val(n, ".s-duree"),
          places: val(n, ".s-places"),
          prix: optNum(val(n, ".s-prix")),
          devise: n.querySelector(".s-devise").value,
          dispo: n.querySelector(".s-dispo").checked,
        }))
        .filter((s) => s.nom),
    };
  }

  // ---------- Actions ----------
  const editor = $("editor");
  editor.addEventListener("input", () => (dirty = true));
  editor.addEventListener("change", (e) => {
    dirty = true;
    if (e.target.classList.contains("cat-visible")) setVisible(e.target.closest(".cat"), e.target.checked);
  });

  editor.addEventListener("contextmenu", (e) => {
    const btn = e.target.closest(".img-btn");
    if (!btn) return;
    const row = btn.closest("tr");
    if (!row.querySelector(".f-image").value) return;
    e.preventDefault();
    if (confirm("Retirer l'image de cet article ?")) { setImage(row, ""); dirty = true; }
  });

  editor.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const cat = btn.closest(".cat");
    const row = btn.closest("tr");
    switch (btn.dataset.act) {
      case "img-pick":
        pickRow = row;
        $("file-pick").click();
        return;
      case "img-url": {
        const url = prompt("Lien de l'image (doit commencer par https://) :", row.querySelector(".f-image").value);
        if (url === null) return;
        if (url && !/^https:\/\/\S+$/.test(url.trim())) { toast("Le lien doit commencer par https://", true); return; }
        setImage(row, url.trim());
        break;
      }
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
      case "s-up": cat.previousElementSibling?.before(cat); break;
      case "s-down": cat.nextElementSibling?.after(cat); break;
      case "s-del": {
        const name = cat.querySelector(".s-nom").value || "cette session";
        if (confirm(`Supprimer « ${name} » ?`)) cat.remove();
        break;
      }
      default: return;
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

  // Remplace les catégories par le barème de base (prix marchands -20 % / 50 %), sans toucher aux sessions
  $("load-default").addEventListener("click", async () => {
    if (!confirm("Remplacer tout le barème actuel par le barème de base ?\nLes sessions de chasse et le lien Discord ne changent pas.\nRien n'est enregistré tant que vous ne cliquez pas sur « Enregistrer ».")) return;
    try {
      const res = await fetch("/data/prix-defaut.json", { cache: "no-store" });
      const base = await res.json();
      cats.replaceChildren();
      (base.categories || []).forEach(addCat);
      dirty = true;
      toast("Barème de base chargé. Vérifiez puis cliquez sur Enregistrer.");
    } catch {
      toast("Impossible de charger le barème de base.", true);
    }
  });

  $("add-session").addEventListener("click", () => {
    const s = addSession({ devise: "$", dispo: true });
    s.querySelector(".s-nom").focus();
    s.scrollIntoView({ behavior: "smooth", block: "center" });
    dirty = true;
  });

  $("save").addEventListener("click", async () => {
    const d = $("discord").value.trim();
    if (d && !/^https:\/\/(www\.)?(discord\.com|discord\.gg|discordapp\.com)\//.test(d)) {
      toast("Le lien Discord doit commencer par https://discord.com/ ou https://discord.gg/", true);
      return;
    }
    if (DEMO) {
      render(collect());
      dirty = false;
      toast("Aperçu : l'enregistrement fonctionnera une fois le site sur Netlify");
      return;
    }
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
      render(await res.json());
      dirty = false;
      toast("Enregistré ✔ Le site est à jour.");
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
