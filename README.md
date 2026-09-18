# AniShelf

Mini application mobile-first de tier list anime, prévue pour **GitHub Pages**.

## Deux modes

- **Rapide** : classement S / A / B / C / D.
- **AniShelf** : notation 0–5★, bibliothèque, notes, favoris, tier list et comparaison JSON entre amis.

Les données personnelles restent dans `localStorage` du navigateur. Aucun compte ni backend n'est requis.

## Affiches : ordre de priorité

AniShelf ne dépend jamais complètement d'un service externe :

1. **Poster local personnalisé** dans `assets/posters/` (`.webp`, `.jpg`, `.jpeg` ou `.png`).
2. **AniList** via GraphQL, avec URL mise en cache dans `localStorage`.
3. **Poster SVG fallback** livré dans le repo.

Exemple pour Attack on Titan :

```text
assets/posters/attack-on-titan.webp   # prioritaire si présent
assets/posters/attack-on-titan.jpg    # accepté aussi
assets/posters/attack-on-titan.svg    # fallback permanent
```

Dans l'app, **Réglages → Rafraîchir les affiches manquantes** retente AniList sans effacer tes notes.

## Télécharger toutes les affiches AniList dans le repo

Avec Node.js 18+ :

```bash
node scripts/fetch-posters.mjs
```

Pour remplacer aussi les images locales déjà téléchargées :

```bash
node scripts/fetch-posters.mjs --force
```

Le script ne nécessite aucun `npm install`. Il interroge AniList par lots, télécharge les images et conserve tous les SVG fallback.

> Vérifie les résultats avant publication : une recherche textuelle peut occasionnellement choisir un remake, une saison ou un titre homonyme.

## Modifier le catalogue

Édite `data/catalog.json`, puis :

```bash
node scripts/build-catalog.mjs
node scripts/audit.mjs
```

`id` doit rester stable lorsque des utilisateurs ont déjà des données sauvegardées : les notes sont indexées par cet identifiant.

## Déploiement GitHub Pages

1. Crée un repository GitHub.
2. Place **le contenu de ce dossier** à la racine de la branche `main`.
3. `Settings → Pages`.
4. Source : `Deploy from a branch`.
5. Branche : `main`, dossier : `/ (root)`.

Le fichier `.nojekyll` évite le traitement Jekyll inutile.

## Export PNG

La tier list peut être exportée en PNG. Le moteur essaie les posters locaux/AniList et retombe sur le SVG local si une image distante ne peut pas être dessinée dans le canvas à cause de CORS.

## Structure

```text
index.html
css/styles.css
js/app.js
js/pwa.js
data/catalog.json
data/catalog.js
assets/posters/
assets/icons/
scripts/fetch-posters.mjs
scripts/build-catalog.mjs
scripts/audit.mjs
manifest.webmanifest
sw.js
```

## Notes techniques

Le projet n'utilise aucun framework. C'est volontaire : le repo reste lisible, léger et facilement modifiable. Si AniShelf grandit (authentification, comptes partagés, recherche complète, listes cloud), il sera alors raisonnable de migrer vers un bundler/framework.
