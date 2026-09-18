# Déploiement rapide

GitHub → nouveau repository → upload du contenu → Settings → Pages → Deploy from a branch → `main` / `(root)`.

Après une grosse mise à jour du site, recharge une fois la page. Le service worker utilise un numéro de cache (`anishelf-shell-v4`) qui peut être incrémenté dans `sw.js` pour forcer le renouvellement des fichiers statiques.
