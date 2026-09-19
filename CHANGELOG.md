# Changelog

## v7 — tiers et étoiles synchronisés

- Le **Tri rapide note désormais automatiquement** l'œuvre en même temps qu'il la classe.
- Nouvelle correspondance : `S=5★`, `A=4.5★`, `B=4★`, `C=3.5★`, `D=3★`, `E=2.5★`, `F=2★`.
- Ajout du tier **E** pour conserver toute l'échelle 5★ → 2★ par demi-étoile.
- Ajout de **Pas vu** en plus de **Pas fini** ; ces deux choix restent sans note.
- Le bouton Annuler restaure désormais à la fois le tier précédent et la note précédente.
- Migration v6 : l'ancien `D = Correct / oubliable` devient automatiquement `E = 2.5★`.
- Export PNG mis à jour pour afficher la note associée à chaque tier.
- Cache PWA incrémenté à `anishelf-shell-v7`.

## v6 — navigation unifiée, suivi et tops personnels

- Suppression de la séparation visuelle `Rapide / AniShelf`.
- Nouvelle page **Accueil** avec raccourcis explicites et statistiques.
- Nouvelle navigation : Accueil / Ma liste / Tri rapide / Mes tops / Profil.
- Le **Tri rapide devient l'unique source de la tier list**.
- Ajout des tiers `Pas fini` et `F` (rouge).
- Conservation des étoiles 2–5★ comme note personnelle indépendante.
- Ajout du suivi `Pas suivi / En attente / En cours / Fini`.
- Refonte des Tops par catégorie en classements personnels interactifs.
- Réorganisation tactile par glisser-déposer via la poignée `≡`.
- Boutons monter / descendre comme alternative au drag.
- Zone `Non classés` et bouton `Passer` pour chaque catégorie.
- Ajout de **202 synopsis locaux** dans le catalogue.
- Fiches anime enrichies : synopsis, suivi, étoiles, favoris, note personnelle.
- Export JSON étendu aux statuts, tops personnels et tier rapide.
- Migration automatique des principales données des anciennes clés v3.
- Cache PWA incrémenté à `anishelf-shell-v6`.

## v5

- Catalogue porté à 202 œuvres.
- Ajout de classiques et de titres modernes/récents.
- Tops éditoriaux par catégories.
- Matching AniList renforcé avec IDs fixes et score de correspondance.
