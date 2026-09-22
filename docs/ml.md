# Modèle de prévision

Ce document est celui annoncé dans [`README.md`](./README.md) pour EC06. Il ne couvre pour l'instant que **l'impact métier du modèle** (#94). Le choix du modèle vit dans `apps/ml/notebooks/model_selection.ipynb`, le versionnement dans le registre MLflow posé par #37, et la surveillance de la dérive reste à venir avec #40.

Le carnet charge le modèle **depuis ce registre**, par son alias `champion` : il mesure donc la version que l'API sert, et non une copie posée à côté. Les chiffres ci-dessous portent sur la version 1.

## Ce qui est mesuré

Deux indicateurs, calculés sur le bloc de test que l'entraînement exclut : **1er juin au 18 septembre 2026, 18 396 heures, les sept sites du parc**. La prévision est rejouée toutes les six heures sur vingt-quatre heures, soit 72 912 prévisions issues de 434 origines.

**Aucune hypothèse.** Les deux indicateurs se lisent directement sur les prévisions rejouées : rien ne suppose qu'une recommandation ait été suivie, ni qu'elle ait produit un effet. La comparaison est faite avec la règle de seuil sans modèle (#43), qui ne voit un dépassement qu'une fois la mesure tombée, et n'offre donc ni annonce ni préavis.

La règle de recommandation simulée n'existe pas encore en code : elle appartient à l'applicatif (#43, #44), pas au service ML. Le seuil appliqué est le défaut écrit dans [`data.md`](./data.md), 80 % de la capacité souscrite ; `warning_threshold_kw` réglé à l'écran n'est pas connu de la simulation.

> **Écart avec le ticket.** Le critère 2 de #94 demandait des KPI calculés « avec et sans recommandation issue de la prévision », ce qui imposait de simuler l'effet d'une recommandation suivie, donc de poser une part de charge déplaçable, un taux d'acceptation et une fenêtre de report. Le critère a été ramené à ce que demande la grille d'épreuve, « des KPI mesurent l'impact du modèle sur les processus métiers simulés » : deux indicateurs entièrement mesurés valent mieux qu'un troisième qui ne se défend qu'en disant « à supposer que ».

## Les deux indicateurs

| Site | Dépassements | Annoncés | Fausses alertes | Alertes / semaine | Préavis médian |
|---|---:|---:|---:|---:|---:|
| SITE006 bureau | 139 | **17,3 %** | 40,0 % | 2,6 | 22 h |
| SITE005 hôpital | 641 | 46,2 % | 46,7 % | 35,5 | 21 h |
| SITE001 bureau | 281 | 63,7 % | 40,7 % | 19,3 | 22 h |
| SITE004 commerce | 306 | 69,6 % | 44,8 % | 24,7 | 21 h |
| SITE007 usine | 783 | 88,3 % | 17,2 % | 53,4 | 21 h |
| SITE002 usine | 823 | 93,2 % | 17,9 % | 59,7 | 21 h |
| SITE003 datacenter | 2553 | 100,0 % | 2,6 % | 167,7 | 21 h |

**Pics anticipés.** Le modèle annonce bien ce qui arrive souvent et rate ce qui arrive rarement : sur le petit bureau, qui dépasse une heure sur vingt, il manque cinq dépassements sur six. Le taux de fausses alertes suit la même logique inversée.

**Temps d'action gagné.** Quand le modèle annonce un dépassement, il le fait tôt : **94 à 99 % des annonces arrivent au moins 18 heures avant l'échéance**, selon le site. La règle de seuil seule n'en offre aucune, par construction. C'est le gain net de la prévision, et il ne dépend d'aucune hypothèse.

## Premier ajustement : le seuil des sites saturés

**Ce qui est changé.** Pour les sites dont le seuil par défaut est dépassé plus d'une heure sur deux à l'entraînement, le déclencheur passe de 80 % de la capacité souscrite au 90e percentile de l'historique du site. Un seul site est concerné, le datacenter, à 98 % de saturation : 640 devient 780 kW.

**Pourquoi.** Un site dont la charge de base vaut 90 % de sa capacité est en alerte permanente, et une alerte permanente n'est pas une alerte : 167 par semaine sur ce seul site.

**Le résultat, et il est mauvais.** Le seuil relevé laisse 176 vrais dépassements, et le modèle **n'en annonce aucun**. Les fausses alertes tombent à zéro parce qu'il n'y a plus d'alerte du tout.

**Ce que cela coûte par ailleurs.** Le seuil ajusté décrit le comportement du site et non plus son contrat d'abonnement : il ne dit donc plus rien du risque de pénalité.

## Second ajustement : le coefficient de déclenchement

**Ce qui est changé.** La recommandation part quand la prévision atteint une fraction du seuil, au lieu de le franchir.

**Pourquoi.** Le premier ajustement suggérait que le modèle est aveugle aux pointes rares. La mesure dit autre chose.

| Déclenchement | Annoncés, petit bureau | Fausses alertes | Alertes / semaine |
|---|---:|---:|---:|
| 100 % du seuil | 17,3 % | 40,0 % | 2,6 |
| 95 % | 87,8 % | 70,7 % | 26,7 |
| 90 % | 100,0 % | 78,7 % | 41,7 |
| 85 % | 100,0 % | 80,4 % | 45,4 |

**Le modèle voyait ces pics, il les sous-estimait de quelques pour cent.** Déclencher à 95 % du seuil fait passer le rappel de 17 % à 88 % sur le site le plus difficile, et à 90 % le rappel dépasse 99 % sur les sept sites. Ce n'est donc pas un défaut de détection mais un biais d'amplitude, et il se corrige par un réglage, pas par un réentraînement.

**Ce que cela coûte, et c'est mesuré.** Les fausses alertes passent de 40 % à 71 %, et la charge d'alertes est multipliée par dix, de 2,6 à 26,7 par semaine. L'arbitrage appartient à l'exploitant, pas au modèle.

**Ce que ça dit pour #44.** Le déclencheur a besoin de deux réglages par site, pas d'un : le seuil de vigilance, que `warning_threshold_kw` porte déjà, et le coefficient de déclenchement, qui n'existe nulle part. Les deux doivent être mesurés site par site, un réglage global donnant 2,6 alertes par semaine ici et 168 là.

## Limites

- Les seuils réglés à la main en base ne sont pas simulés, seul le défaut l'est.
- L'horizon est fixé à 24 heures. Les préavis mesurés sont donc plafonnés à cette valeur, et le contrat autorise 48.
- L'erreur de prévision ne croît pas avec l'horizon sur cette fenêtre : de 4 à 17 % selon le site, stable de H+6 à H+24. L'horizon de 24 heures n'est donc pas une contrainte du modèle.
- Rien ici ne mesure d'euros ni de kWh économisés. Les deux indicateurs disent ce que le modèle **permet** de faire, pas ce qu'une action produirait.
