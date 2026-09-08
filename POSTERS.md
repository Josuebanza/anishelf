# Posters

- Les `.svg` sont des **fallbacks graphiques générés pour AniShelf** et sont inclus dans le dépôt.
- Les `.webp` sont optionnels et prennent automatiquement priorité s’ils existent sous le même slug.
- `scripts/fetch-posters.mjs` peut tenter de générer les `.webp` depuis Jikan/MyAnimeList.
- Une couverture incorrecte peut être remplacée manuellement en conservant exactement le nom `<posterSlug>.webp`.

Le champ `posterSlug` se trouve dans `data/catalog.json`.
