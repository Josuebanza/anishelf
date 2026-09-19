# Déployer AniShelf sur GitHub Pages

## 1. Vérifier localement

Avec Node.js installé :

```bash
node scripts/build-catalog.mjs
node scripts/audit.mjs
```

Pour précharger les vraies affiches dans le dépôt (optionnel) :

```bash
node scripts/fetch-posters.mjs
```

## 2. Envoyer sur GitHub

Place tous les fichiers du projet à la racine de la branche `main`.

## 3. Activer Pages

Dans GitHub :

`Settings → Pages → Deploy from a branch → main → / (root)`

## 4. Après une mise à jour

AniShelf utilise un service worker. Après avoir remplacé une ancienne version par la v7, fais une fois :

```text
Ctrl + Shift + R
```

Sur mobile, fermer/réouvrir l'onglet ou vider les données du site peut aussi forcer le nouveau cache.

## 5. Sauvegarder ses données avant un gros changement

Dans AniShelf :

`Réglages → Exporter toutes mes données JSON`

L'import restaure les notes, statuts, favoris, tops personnels et la tier list rapide.
