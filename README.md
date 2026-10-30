# La Hutte Enchanté

Site du magasin **La Hutte Enchanté** sur le jeu SCUM : page d'accueil plein écran, barème vente / rachat avec l'image de chaque article, sessions de chasse à l’appât, carte de localisation (secteur B2), et un espace admin pour tout modifier.

Le site est hébergé sur **Netlify**. Les prix sont stockés avec **Netlify Blobs**, il n'y a pas de base de données à installer.

## Mise en ligne sur Netlify

1. Sur Netlify, faites **Add new site → Import an existing project → GitHub**, puis choisissez ce dépôt.
   La configuration est déjà dans `netlify.toml`, il n'y a rien à remplir.
2. Allez dans **Site configuration → Environment variables** et ajoutez :
   - `ADMIN_PASSWORD` : le mot de passe de l'admin (choisissez-en un solide).
3. Relancez un déploiement (**Deploys → Trigger deploy**) pour que le mot de passe soit pris en compte.

Chaque `git push` sur `main` redéploie le site automatiquement.

## Utilisation

- **Site public :** `https://votre-site.netlify.app/`
- **Admin :** `https://votre-site.netlify.app/admin`

Dans l'admin, onglet **Barème** :
- prix de **vente** et de **rachat** (laisser « Rachat » vide si vous ne rachetez pas l'article), devise ($ ou or), unité ;
- **image** de l'article : cliquez sur la vignette pour envoyer un fichier (PNG, JPG, WEBP, GIF ; réduit automatiquement), ou « lien » pour coller une adresse https ; clic droit sur la vignette pour la retirer ;
- disponible / en rupture, ajout, suppression et ordre des articles et des catégories.

En haut de l’admin, **Commandes & réservations** : lien du post « Commande » du forum Discord et texte affiché sous le barème et sous les sessions (avec un bouton vers ce post).

Onglet **Sessions de chasse** :
- sessions de chasse (une par bête) : nom, description, étiquette, durée, places, prix, et « Places dispo » (décochée = affichée « Complet »).

Le bouton **Enregistrer** met le site à jour immédiatement.

Tant que rien n'a été enregistré depuis l'admin, le site affiche les exemples du fichier `public/data/prix-defaut.json`.

## Organisation des fichiers

```
public/                 le site (HTML, CSS, JS, images)
  index.html            accueil + barème
  admin.html            espace admin
  data/prix-defaut.json catalogue et sessions de départ
  img/carte.webp        carte du secteur B2 (le marqueur est placé en CSS dans index.html)
netlify/functions/      API côté serveur
  prices.mjs            GET /api/prices (lecture) · PUT /api/prices (écriture, mot de passe requis)
  images.mjs            POST /api/img (envoi d'image, mot de passe requis) · GET /api/img/:id
  login.mjs             POST /api/login (vérification du mot de passe)
netlify/lib/auth.mjs    contrôle du mot de passe + limite des essais
netlify.toml            configuration Netlify
```

## Tester en local (optionnel)

```bash
npm install
npx netlify-cli dev
```

Puis ouvrez http://localhost:8888. Pour l'admin en local, définissez `ADMIN_PASSWORD` dans un fichier `.env`.

## Branches

- **`main`** = production. Chaque push sur `main` met le site en ligne à jour.
- **`dev`** = développement des prochains ajouts. Les pushs sur `dev` **ne déclenchent aucun build Netlify**
  (règle `ignore` dans `netlify.toml`), donc aucune consommation de minutes de build.

Pour mettre en ligne les ajouts de `dev` : ouvrir une pull request `dev` → `main`, puis la fusionner.
Seule la fusion déclenche le build de production.
