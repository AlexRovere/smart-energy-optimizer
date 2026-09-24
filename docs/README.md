# Documentation

| Fichier | Contenu | Épreuve |
|---|---|---|
| `architecture.md` | **La référence d'architecture de l'équipe**, figée au J1, et les écarts constatés ensuite | EC01, EC02 |
| `ci-cd.md` | Fonctionnement du pipeline, quality gate, scans | EC03 |
| **`securisation.md`** | **Le rapport de sécurisation : chaque contrôle avec la commande qui le rejoue et son résultat daté, puis les limites connues** | **EC04** |
| `supervision.md` | Sources de mesure, indicateurs retenus et la question à laquelle chacun répond, mise en service | EC04 |
| `secrets.md` | Chiffrement au repos, clés age, procédure de chiffrement et de déchiffrement, rotation | EC03, EC04 |
| `data.md` | Modèle relationnel, contrat des fichiers Parquet, stratégie d'imputation, règles de qualité | EC05 |
| `api.md` | Contrats d'interface des quatre briques, croisés à partir des propositions de chacun et figés avant le développement parallèle | EC03, C20 |
| `recommandations.md` | Détection de pic et de consommation excessive, lecture d'une recommandation dans le dashboard | #45 |
| `ml.md` | Modèle de prévision, indicateurs, ajustements, surveillance de la dérive | EC06 |
| `runbook.md` | Quoi faire selon la situation : démarrer, exploiter (déployer, ETL, sauvegarde, rotation, Grafana), incidents connus | EC06 |
| `rapports/` | Rapports datés : un constat à une date, pas une référence tenue à jour. Aujourd'hui la synthèse Sonar du 23 septembre | EC03 |

`cloud.md` n'existera pas : sa partie sécurité est devenue `securisation.md`, et la machine et sa
configuration sont décrites par le playbook et son README, dans [`../infra/ansible/`](../infra/ansible/).

Les livrables notés (dossiers EC01 et EC02) sont **individuels ou collectifs selon l'épreuve** et ne sont pas versionnés ici : les dossiers de conception passent au contrôle anti-plagiat et un document accessible aux autres membres est un risque partagé.
