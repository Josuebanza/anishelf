# AniShelf

AniShelf est une petite application **mobile-first**, sans backend et sans framework, prévue pour être hébergée directement sur **GitHub Pages**.

Cette version unifie les anciens modes en une seule navigation :

- **Accueil** : résumé et raccourcis explicites.
- **Ma liste** : En attente / En cours / Fini / Pas suivi.
- **Tri rapide** : unique source de la tier list.
- **Mes tops** : classements personnels par catégorie, avec non-classés et glisser-déposer.
- **Profil** : notes, favoris, export/import et comparaison entre amis.

Les données personnelles restent dans `localStorage`. Aucun compte ni serveur n'est requis.

## Tier list : une seule source

Le **Tri rapide** alimente l'unique tier list **et enregistre automatiquement la note étoile correspondante** :

- `S` — **5★** — Immense
- `A` — **4.5★** — Chef-d’œuvre
- `B` — **4★** — Excellent
- `C` — **3.5★** — Mérite d’être vu
- `D` — **3★** — Bon / solide
- `E` — **2.5★** — Correct / oubliable
- `F` — **2★** — Moyen / échec
- `Pas fini` — sans note
- `Pas vu` — sans note

Un titre passé avec le bouton **Passer** reste non classé. `Pas vu` est au contraire un choix explicite qui permet de terminer le tri sans prétendre avoir vu l'œuvre.

Les étoiles restent disponibles sur les fiches pour voter ou corriger une note manuellement. Si l'œuvre repasse ensuite par le Tri rapide, le choix du tier resynchronise automatiquement la note.

Lors de la migration depuis la v6, l'ancien `D` (qui signifiait « Correct / oubliable ») est converti en `E = 2.5★` afin de conserver son sens.

## Suivi de lecture / visionnage

Chaque fiche anime possède un statut :

- Pas suivi
- En attente
- En cours
- Fini

La page **Ma liste** peut être filtrée par statut.

## Tops personnels par catégorie

La page **Mes tops** propose 10 sélections éditoriales. Pour chaque catégorie :

- les œuvres commencent dans **Non classés** ;
- un tap sur `+ Ajouter` les ajoute au classement ;
- la poignée `≡` permet de les réordonner par glisser-déposer sur mobile ou desktop ;
- `↑` et `↓` constituent l'alternative accessible au drag ;
- `×` renvoie l'œuvre dans Non classés ;
- `Passer` fait défiler le prochain candidat sans le classer ;
- `Préremplir` charge l'ordre éditorial AniShelf comme point de départ.

Ces tops ne modifient ni les étoiles ni la tier list rapide.

## Synopsis intégrés

Les **202 œuvres** possèdent désormais un synopsis court directement dans :

```text
data/catalog.json
```

Ils sont donc disponibles hors-ligne et ne dépendent ni d'AniList ni d'une autre API.

Pour modifier un synopsis, édite simplement la propriété :

```json
{
  "id": "attack-on-titan",
  "title": "Attack on Titan",
  "synopsis": "Ton texte ici."
}
```

Puis régénère les données navigateur :

```bash
node scripts/build-catalog.mjs
```

## Affiches

Ordre de priorité :

1. poster local dans `assets/posters/<id>.webp|jpg|jpeg|png` ;
2. AniList, avec matching vérifié et cache local ;
3. SVG AniShelf livré dans le repo.

Les IDs AniList explicites dans `catalog.json` sont prioritaires pour les titres ambigus.

Pour télécharger les affiches AniList directement dans le repo :

```bash
node scripts/fetch-posters.mjs
```

Pour tout retélécharger :

```bash
node scripts/fetch-posters.mjs --force
```

Aucun `npm install` n'est nécessaire ; Node.js 18+ suffit.

## Modifier catalogue et catégories

Sources éditables :

```text
data/catalog.json
data/categories.json
```

Après modification :

```bash
node scripts/build-catalog.mjs
node scripts/audit.mjs
```

`audit.mjs` contrôle notamment les IDs, fallbacks de posters, références de catégories et la présence des synopsis.

## Déploiement GitHub Pages

1. Mets le contenu du dossier à la racine de ton repo.
2. `Settings → Pages`.
3. `Deploy from a branch`.
4. Branche `main`, dossier `/ (root)`.

Après une grosse mise à jour, fais une fois `Ctrl + Shift + R` pour forcer la nouvelle version du service worker.

## Export / sauvegarde

Le menu Réglages permet d'exporter un JSON contenant :

- tier list rapide ;
- étoiles ;
- statuts de suivi ;
- notes ;
- favoris ;
- tops par catégorie ;
- pseudo.

La tier list rapide peut aussi être exportée en **PNG** pour le partage.

## Structure

```text
index.html
css/styles.css
js/app.js
js/pwa.js
data/catalog.json
data/catalog.js
data/categories.json
data/categories.js
assets/posters/
assets/icons/
scripts/fetch-posters.mjs
scripts/build-catalog.mjs
scripts/audit.mjs
manifest.webmanifest
sw.js
```

Le code est volontairement commenté par sections pour rester facile à reprendre avant une éventuelle migration vers une stack plus lourde.
