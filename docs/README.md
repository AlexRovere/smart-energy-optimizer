# Documentation

| Fichier | Contenu | Épreuve |
|---|---|---|
| `architecture.md` | **La référence d'architecture de l'équipe**, figée au J1, et les écarts constatés ensuite | EC01, EC02 |
| `ci-cd.md` | Fonctionnement du pipeline, quality gate, scans | EC03 |
| **`securisation.md`** | **Le rapport de sécurisation : chaque contrôle avec la commande qui le rejoue et son résultat daté, puis les limites connues** | **EC04** |
| `secrets.md` | Chiffrement au repos, clés age, procédure de chiffrement et de déchiffrement, rotation | EC03, EC04 |
| `data.md` | Modèle relationnel, contrat des fichiers Parquet, stratégie d'imputation, règles de qualité | EC05 |
| `api.md` | Contrats d'interface des quatre briques, croisés à partir des propositions de chacun et figés avant le développement parallèle | EC03, C20 |

Annoncés et pas encore écrits, pour ne pas laisser croire le contraire : `ml.md` (modèle,
entraînement, versionnement, dérive, pour l'EC06) et `runbook.md` (démarrage, exploitation, incidents
connus). `cloud.md` n'existera pas : sa partie sécurité est devenue `securisation.md`, et ce qui reste
(la machine et sa configuration) attend le playbook, `infra/ansible/` ne portant pour l'instant qu'un
README.

Les livrables notés (dossiers EC01 et EC02) sont **individuels ou collectifs selon l'épreuve** et ne sont pas versionnés ici : les dossiers de conception passent au contrôle anti-plagiat et un document accessible aux autres membres est un risque partagé.
