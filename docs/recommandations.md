# Recommandations

Les recommandations sont des conseils d'action générés automatiquement par le dashboard à partir des mesures historiques et, quand disponible, des prévisions ML. Elles sont visibles sur la page de chaque site dans le dashboard.

## Détection d'un pic de consommation

Un pic est détecté quand la dernière mesure dépasse d'un facteur configurable la moyenne glissante récente du site.

Paramètres (table `alert_thresholds`, type `pic`) :
- `duration` : fenêtre de calcul de la moyenne glissante, en heures (défaut : 5 h).
- `threshold` : facteur multiplicatif appliqué à cette moyenne (défaut : 1,5 — soit +50 %).

Exemple : si la consommation moyenne des 5 dernières heures est 100 kW et que le facteur est 1,5, toute mesure au-dessus de 150 kW déclenche une recommandation de type `load_balancing`, priorité `high`.

## Détection d'une consommation excessive

Une consommation excessive est détectée quand la moyenne glissante de consommation (en kWh) sur une fenêtre dépasse un seuil configuré pour le site.

Paramètres (table `alert_thresholds`, type `conso`) :
- `duration` : fenêtre glissante, en heures (défaut : 5 h).
- `threshold` : seuil en kWh (défaut : 200 kWh).

Exemple : si la consommation cumulée sur les 5 dernières heures dépasse 200 kWh, une recommandation de type `efficiency`, priorité `medium`, est générée.

## Deux sources de recommandations

| Valeur de `source` | Signification |
|---|---|
| `threshold` | Déclenchement constaté sur les données historiques actuelles. Ne dépend pas du service ML. |
| `forecast` | Déclenchement prévu dans les **48 prochaines heures** d'après les prédictions CatBoost. Nécessite le service ML. Au-delà de deux jours, une alerte n'est plus actionnable et la prédiction autorégressive accumule ses biais (#6). |

Les recommandations de type `threshold` sont prioritaires : si une alerte est déjà active aujourd'hui, aucune recommandation `forecast` n'est ajoutée pour le même type de déclencheur.

## Lire une recommandation

Chaque recommandation contient :
- `priority` (`high`, `medium`, `low`) : urgence de l'action.
- `title` : intitulé court de l'anomalie détectée.
- `description` : justification et suggestion d'action.
- `trigger.value_kw` : valeur mesurée ou prédite au moment du déclenchement.
- `trigger.threshold_kw` : seuil dépassé.
- `trigger.timestamp` : horodatage du déclenchement. Pour une prévision, c'est l'heure pleine où le dépassement est prévu, affichée « prévu le 30/09 14:00 ».
- `source` : `threshold` (historique) ou `forecast` (prévision ML).

## Dans le dashboard

La section **Recommandations** est visible sur la page de chaque site, après la liste des alertes actives. Elle est toujours affichée :

- **Liste non vide** : chaque recommandation indique sa priorité (badge coloré), son titre, sa justification, et les valeurs de déclenchement.
- **Liste vide, toutes sources consultées** : message « Aucune recommandation active », aucune anomalie ni pic prévu sur le site.
- **Source manquante** : bandeau « Recommandations partielles : prévision indisponible » (ou « historique indisponible »), au lieu d'annoncer une absence d'anomalie que rien n'a vérifiée.

Une modale s'ouvre automatiquement à l'arrivée sur la page si des recommandations sont présentes, pour attirer l'attention sur une situation nécessitant une action.

## Dégradation gracieuse

Si le service ML est indisponible, les recommandations basées sur les prévisions (`source = "forecast"`) ne sont pas générées. Les recommandations de seuil (`source = "threshold"`) continuent de fonctionner normalement.

Si le répertoire Parquet est absent, aucune donnée historique n'est disponible et les deux types de recommandations retournent un tableau vide.

Dans les deux cas, la réponse le dit dans `unavailable` (`forecast` ou `history`, voir `docs/api.md`), et l'écran affiche des recommandations partielles plutôt qu'un « aucune anomalie ».

## Cas vérifié sur données réelles

Le 29 septembre 2026, sur la pile de développement (un an d'historique écrit par l'ETL depuis le simulateur, modèle entraîné sur ces données, seuils par défaut) :

- **Consommation excessive constatée** (`threshold`, `efficiency`) sur SITE002, SITE003, SITE004, SITE005 et SITE007 : moyenne des cinq dernières heures entre 340 et 874 kWh, pour un seuil par défaut de 200 kWh. Ce seuil est pensé pour un bureau : sur une usine ou un centre de données, il se déclenche en permanence, et c'est à régler site par site dans les paramétrages.
- **Pic prévu** (`forecast`, `load_balancing`) sur SITE001, SITE002, SITE004, SITE006 et SITE007, tous dans les 48 heures. Par exemple, SITE002 : 645 kW prévus le lendemain à 07:00, pour un seuil de pic de 457 kW (1,5 fois la moyenne glissante).

Chaque famille s'est donc déclenchée sur des données réelles et sur une prévision réelle. Aucune source ne manquait (`unavailable` vide).
