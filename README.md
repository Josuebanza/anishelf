# AniShelf

AniShelf est une petite application statique **mobile-first** pour classer des séries anime de deux façons :

- **RAPIDE** — tier sprint `S / A / B / C / D` ;
- **ANISHELF** — notes `0 → 5★`, favoris, commentaires, tier list personnelle et comparaison par export JSON.

Le projet est volontairement sans framework et sans backend : HTML/CSS/JavaScript pur, compatible **GitHub Pages**.

## Structure

```text
.
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   └── pwa.js
├── data/
│   ├── catalog.json      # source de vérité du catalogue
│   └── catalog.js        # copie navigateur générée
├── assets/
│   ├── icons/
│   └── posters/          # .webp si présents, sinon fallback .svg
├── scripts/
│   ├── build-catalog.mjs
│   ├── fetch-posters.mjs
│   └── audit.mjs
├── manifest.webmanifest
├── sw.js
└── .nojekyll
```

## Lancer en local

Le site fonctionne en ouvrant `index.html`, mais pour tester exactement comme sur GitHub Pages (service worker compris), lance un petit serveur :

```bash
python -m http.server 8000
```

Puis ouvre `http://localhost:8000`.

## Publier sur GitHub Pages

1. Crée un nouveau dépôt GitHub, par exemple `anishelf`.
2. Envoie **tout le contenu de ce dossier à la racine du dépôt**.
3. Dans GitHub : **Settings → Pages**.
4. Dans **Build and deployment**, choisis **Deploy from a branch**.
5. Sélectionne la branche `main` et le dossier `/ (root)`, puis **Save**.
6. GitHub affichera l’URL publique du site après le premier déploiement.

Aucun token, serveur, base de données ou secret n’est nécessaire.

## Posters

Le dépôt contient déjà **un fallback SVG local pour les 168 entrées**. Ce sont des affiches graphiques AniShelf, pas les key arts officiels. Elles garantissent que le site ne présente jamais une carte vide.

L’application préfère automatiquement :

1. `assets/posters/<slug>.webp` ;
2. sinon `assets/posters/<slug>.svg`.

Pour tenter de récupérer des couvertures depuis Jikan / MyAnimeList sur ta machine :

```bash
node scripts/fetch-posters.mjs
```

Le script nécessite **Node.js 18+**, n’a aucune dépendance npm et attend volontairement entre les requêtes. Après téléchargement, vérifie visuellement les couvertures : une recherche par titre peut parfois choisir une mauvaise saison ou une œuvre homonyme.

> Important : avant de republier des visuels tiers, vérifie leurs conditions d’utilisation et les droits applicables. Le code AniShelf n’accorde aucun droit sur les illustrations d’anime.

## Modifier le catalogue

Édite `data/catalog.json`, puis régénère la copie utilisée par le navigateur :

```bash
node scripts/build-catalog.mjs
```

Les `id` doivent rester stables : les notes sauvegardées sont indexées par identifiant.

## Vérification rapide

```bash
node --check js/app.js
node scripts/audit.mjs
```

## Export image des tier lists

Les deux modes proposent **Partager en image**. L’image PNG est composée directement dans le navigateur (sans dépendance externe), avec les posters locaux, le branding AniShelf et les tiers visibles. Sur mobile, le navigateur essaie d’ouvrir la feuille de partage native ; sinon le PNG est téléchargé. Le PDF reste disponible comme option secondaire.

## Sauvegardes et GitHub Pages

Les notes utilisent `localStorage`. Elles sont donc liées au **navigateur + domaine**.

Exemple : les données enregistrées en ouvrant un ancien fichier local `file://...` ne sont pas automatiquement visibles sur `https://tonpseudo.github.io/anishelf/`. Avant de changer d’adresse, utilise **AniShelf → Amis → Exporter mon profil**, puis importe le JSON sur la nouvelle adresse.

## Où brancher une API plus tard ?

Le terrain est préparé pour ne pas casser l’interface :

- `data/catalog.json` = catalogue local actuel ;
- `posterSlug` = liaison stable avec les fichiers image ;
- `searchTitle` = texte prévu pour les recherches externes ;
- `scripts/fetch-posters.mjs` = exemple d’intégration API hors navigateur.

On pourra ensuite ajouter une vraie recherche AniList/Jikan dans l’app, un backend léger, ou une base partagée sans réécrire les vues de classement.

## Sources du preset

Le preset de consensus vient de notre comparaison de classements Japon / francophonie / anglophone. Les champs `sources` dans `data/catalog.json` indiquent uniquement la présence dans les signaux utilisés pour cette version ; ils ne constituent pas une mesure scientifique universelle de qualité.
