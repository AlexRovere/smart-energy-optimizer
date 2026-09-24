# Les prédictions dans le dashboard

Le modèle de prévision (voir [`ml.md`](./ml.md)) estime la consommation d'un site heure par heure, sur 24 ou 48 heures. Cette page explique comment le dashboard s'en sert et comment le montrer en démo.

## Où les voir

- **Page Prédictions** : on choisit un site, un horizon, et on lance. On obtient la courbe, le pic prévu, la marge au seuil et la version du modèle.
- **Fiche d'un site** (`/sites/:id`) : la carte « Prévision de consommation » fait la même chose pour le site affiché.

Dans les deux cas, **rien n'est calculé à l'ouverture de la page**. On clique sur « Lancer la prédiction » et on voit l'appel partir, puis revenir. C'est voulu : en démo, l'action et son résultat doivent se voir.

## Ce qui se passe quand on clique

1. Le navigateur appelle `POST /api/sites/{id}/prediction` avec l'horizon choisi.
2. Le serveur Nuxt vérifie que le compte a bien accès au site, puis découpe l'horizon en heures.
3. Il envoie ces heures au service ML (`POST /predictions`) et lui demande la version du modèle en service (`GET /model`).
4. Le service ML lit l'historique récent dans les fichiers Parquet et fait tourner le modèle `champion`.
5. La réponse revient au dashboard, qui trace la prévision à la suite des 24 dernières heures mesurées.

Le détail du contrat est dans [`api.md`](./api.md).

## Lire le retour

Sous le bouton, une ligne résume ce qui est revenu :

> ● 24 points · v3 · 14:32:05 · 412 ms

Soit : le nombre d'heures prévues, la version du modèle dans le registre MLflow, l'heure du calcul, et le temps de l'aller-retour vu du navigateur.

Si le point est rouge avec « Service de prédiction indisponible », le service ML n'a pas répondu. Aucune courbe n'est inventée à la place.

Changer de site ou d'horizon efface le résultat : une courbe calculée pour autre chose serait trompeuse.

## Quand ça ne marche pas

| Symptôme | Cause probable | Que faire |
|---|---|---|
| « Service de prédiction indisponible » tout de suite | Aucun modèle `champion` dans le registre | Cliquer « Entraîner le modèle » dans la barre latérale (compte ADMIN), attendre le badge « Succès », relancer |
| Même message, service ML démarré | Le dashboard ne trouve pas le service | Vérifier `NUXT_ML_SERVICE_URL` (par défaut `http://ml:8000`) |
| Le bouton répond mais pas de courbe | Pas d'historique sur les 24 dernières heures | Vérifier que l'ETL a tourné récemment (voir [`runbook.md`](./runbook.md)) |

## Déroulé de démo

1. Ouvrir la page **Prédictions**. Les indicateurs affichent « — » : rien n'a encore été demandé.
2. Choisir un site, par exemple S002 (usine), et l'horizon 24 h.
3. Cliquer **Lancer la prédiction**. Le bouton tourne, la ligne indique « Calcul en cours ».
4. La courbe apparaît, les indicateurs se remplissent, la ligne de retour donne la version du modèle et le temps de réponse.
5. Passer à 48 h puis relancer, ou ouvrir la fiche du même site pour montrer que c'est le même appel.

## Limites connues

- Le service ne renvoie pas d'intervalle de confiance : la courbe n'a pas de bande d'incertitude.
- La carte « Simulation de pic » de la page Prédictions n'est pas encore branchée.
