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

## Sécurité inter-zones

Le service tourne côté AWS et n'est appelé que par la VM on-premise : HTTPS obligatoire, jeton de service, et Security Group restreignant l'accès à la seule IP de la VM.
