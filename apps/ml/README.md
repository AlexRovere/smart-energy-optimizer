# Service de prédiction

Entraîne et sert le modèle de prévision de consommation. FastAPI, Prophet, versionnement MLflow.

Rôle porteur : Data & IA. Domaine : `domain:ml`. Épreuve : EC06.

## Attendus de l'épreuve

- Modèle entraîné et **versionné avec MLflow** (le sujet nomme l'outil).
- **Endpoint de prédiction déployé et fonctionnel** le jour de la démo.
- **Surveillance du modèle en production** : dérive des prédictions, métriques de performance.
- Documentation de l'API prédictive claire et utilisable.
- KPI mesurant l'impact du modèle, avec ajustements documentés.

## Choix assumé

Prophet plutôt qu'un réseau de neurones : la consommation est fortement saisonnière, Prophet y excelle nativement et gère les valeurs manquantes, ce qui compte vu la fréquence des pannes de capteurs simulées. Pour un client industriel, un modèle interprétable prime sur la sophistication.

Repli documenté si le temps manque : une baseline en moyenne mobile, comparée au modèle, avec MLflow conservé.

## Exposition

Conteneur sur la machine sur site, joignable **uniquement** depuis le réseau interne Docker : aucun port publié sur l'hôte, aucun accès depuis l'extérieur. Le seul appelant est l'applicatif. Il n'y a plus de frontière inter-zones à sécuriser, l'architecture hybride ayant été écartée lors de la séance de cadrage du J1.

Le service n'a **aucune notion d'utilisateur** : l'autorisation est résolue par l'applicatif avant l'appel. Il ne monte que le répertoire d'entraînement du volume Parquet, en lecture seule.

## Traçabilité du jeu d'entraînement

Les jeux sont versionnés avec **DVC** : les fichiers restent sur le volume, seuls leurs pointeurs et leurs empreintes entrent dans Git. Un modèle du registre est ainsi rattaché à l'état exact des données qui l'a produit, et réentraînable à l'identique.

## Contrat de l'endpoint

FastAPI **génère** son OpenAPI : le contrat de référence est servi par le service lui-même, il n'est pas recopié ici. Ce qui est figé en séance #102 et ne change plus que par décision tracée : le site, l'horizon et les variables en entrée ; la valeur, l'intervalle de confiance et la version du modèle en sortie.
