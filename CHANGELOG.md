# Changelog

## 4.0.1 — Shareable PNG tier lists

- Retour de l’export image, désormais prioritaire sur le PDF.
- Export PNG natif pour le mode RAPIDE et AniShelf, sans bibliothèque externe.
- Composition éditoriale avec branding, tiers et posters locaux.
- Partage natif sur mobile quand le navigateur le permet, téléchargement sinon.
- PDF conservé comme option secondaire.

## 4.0.0 — GitHub Pages foundation

- Séparation du prototype monolithique en `index.html`, `css/`, `js/`, `data/` et `assets/`.
- Conservation des deux modes : **RAPIDE** et **ANISHELF**.
- Ajout de 168 posters SVG locaux de secours.
- Convention `posterSlug.webp` → fallback automatique `posterSlug.svg`.
- Ajout d'un script optionnel de téléchargement des covers via Jikan.
- Ajout du manifeste PWA et d'un service worker léger.
- Documentation GitHub Pages, posters, catalogue et sauvegardes.
- Aucun framework, aucun bundler et aucune dépendance CDN côté visiteur.
