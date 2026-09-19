# Posters AniShelf

## Priorité d'affichage

Pour chaque anime `id`, AniShelf essaie dans cet ordre :

1. `assets/posters/<id>.webp`
2. `assets/posters/<id>.jpg`
3. `assets/posters/<id>.jpeg`
4. `assets/posters/<id>.png`
5. poster AniList résolu en ligne
6. `assets/posters/<id>.svg`

Un poster local permet donc toujours de **forcer** l'image de ton choix.

## Résolution AniList

Pour éviter les doublons et mauvaises associations :

- les titres sensibles peuvent avoir un champ `anilistId` dans `data/catalog.json` ;
- les autres utilisent une recherche de plusieurs candidats ;
- l'application compare le titre anglais, romaji, natif, les synonymes et l'année ;
- les anciennes mauvaises correspondances sont isolées par une nouvelle version du cache.

Exemple :

```json
{
  "id": "sword-art-online",
  "title": "Sword Art Online",
  "anilistId": 11757,
  "year": 2012
}
```

## Remplacer manuellement un poster

Pour `city-hunter`, dépose simplement :

```text
assets/posters/city-hunter.webp
```

Tu peux conserver `city-hunter.svg` : il restera uniquement comme secours.

## Télécharger les posters AniList

```bash
node scripts/fetch-posters.mjs
```

Le script affiche pour chaque téléchargement le titre demandé, le titre AniList choisi et l'ID AniList. Cela facilite le contrôle des éventuels mauvais matchs.
