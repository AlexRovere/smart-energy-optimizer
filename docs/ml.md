# Modèle de prévision

Ce document est celui annoncé dans [`README.md`](./README.md) pour EC06. Il ne couvre pour l'instant que **l'impact métier du modèle** (#94). Le choix du modèle vit dans `apps/ml/notebooks/model_selection.ipynb`, le versionnement dans #37 et la surveillance de la dérive dans #40 : chaque section arrive avec son ticket.

## Ce qui est mesuré, et ce qui ne l'est pas

Deux KPI métier, calculés sur le bloc de test que l'entraînement exclut : **1er juin au 18 septembre 2026, 18 396 heures, les sept sites du parc**. La prévision est rejouée toutes les six heures sur vingt-quatre heures, soit 72 912 prévisions issues de 434 origines.

Aucune charge n'a réellement été déplacée. L'effet d'une recommandation suivie est une hypothèse paramétrée : **15 % de la charge de l'heure signalée est déplaçable**, vers les heures voisines à plus ou moins trois heures, dans la même journée, à énergie totale conservée. Les chiffres mesurent donc le couple modèle plus hypothèse. Le carnet `apps/ml/notebooks/impact_kpi.ipynb` balaie cette hypothèse de 5 % à 30 % : le gain reste positif sur toute la plage, seule son ampleur bouge.

La règle de recommandation simulée n'existe pas encore en code : elle appartient à l'applicatif (#43, #44), pas au service ML. Le seuil appliqué est le défaut écrit dans [`data.md`](./data.md), 80 % de la capacité souscrite ; `warning_threshold_kw` réglé à l'écran n'est pas connu de la simulation.

**Trois bras** sont comparés, parce que « avec et sans recommandation » mesure la boucle et non le modèle : A, rien ; B, seuil réactif, qui agit une fois le dépassement constaté ; C, anticipation par la prévision. **C moins B est l'apport du modèle.**

## KPI 1 : pics anticipés

Part des dépassements réels annoncés à l'avance, et son inséparable taux de fausses alertes. Les sites sont triés par fréquence de dépassement.

| Site | Heures en dépassement | Annoncés | Fausses alertes |
|---|---:|---:|---:|
| SITE006 bureau | 5,4 % | **17,3 %** | 40,0 % |
| SITE001 bureau | 10,7 % | 63,7 % | 40,7 % |
| SITE004 commerce | 11,7 % | 69,6 % | 44,8 % |
| SITE005 hôpital | 24,6 % | 46,2 % | 46,7 % |
| SITE007 usine | 29,9 % | 88,3 % | 17,2 % |
| SITE002 usine | 31,5 % | 93,2 % | 17,9 % |
| SITE003 datacenter | 97,4 % | 100,0 % | 2,6 % |

**Le modèle annonce bien ce qui arrive souvent, et rate ce qui arrive rarement.** Sur le petit bureau, il manque cinq dépassements sur six. Sur le datacenter, qui dépasse en permanence, il les voit tous, ce qui ne prouve pas grand-chose. Le préavis médian est de 21 à 22 heures sur tous les sites : largement actionnable.

## KPI 2 : énergie de dépassement évitée

Les kWh consommés au-dessus du seuil, avant et après la manoeuvre, sur la période.

| Site | B, seuil réactif | C, prévision | Apport du modèle |
|---|---:|---:|---:|
| SITE001 | 1 221 | 1 422 | +201 |
| SITE002 | 24 997 | 32 325 | +7 329 |
| SITE003 | 866 | 866 | 0 |
| SITE004 | 2 302 | 3 234 | +932 |
| SITE005 | 3 535 | 3 790 | +255 |
| SITE006 | 261 | 134 | **-127** |
| SITE007 | 21 835 | 28 918 | +7 083 |
| **Total** | **55 016** | **70 689** | **+15 672** |

Anticiper fait **28 % mieux** que réagir, et les deux usines font 92 % de ce gain. Deux écarts défavorables, et ils se tiennent : sur le petit bureau, le modèle fait **moins bien** que le seuil réactif, parce qu'il ne voit pas venir un dépassement sur six ; sur le datacenter, il ne fait ni mieux ni moins bien, parce qu'un site en alerte permanente n'a rien à anticiper.

## Le coût, et il est défavorable

Le gain se paie en énergie déplacée. Le rapport entre les deux est **toujours inférieur à 1**.

| Part déplaçable | kWh évités | kWh évités par kWh déplacé |
|---|---:|---:|
| 5 % | 38 245 | 0,58 |
| 15 % | 70 689 | 0,35 |
| 30 % | 88 206 | 0,21 |

À l'hypothèse de référence, **on déplace 2,9 kWh pour en effacer 1 au-dessus du seuil**. Et l'efficacité se dégrade quand on déplace davantage : multiplier par six la part déplaçable ne multiplie le gain que par 2,3, et divise le rendement par 2,8. Conclusion opérationnelle contre-intuitive : **mieux vaut déplacer peu et bien que beaucoup**.

## L'ajustement documenté

**Ce qui a été changé.** Sur les sites dont le seuil par défaut est dépassé plus d'une heure sur deux à l'entraînement, le déclencheur passe de 80 % de la capacité souscrite au 90e percentile de l'historique du site. Un seul site est concerné, le datacenter : 640 devient 780 kW.

**Pourquoi.** Il passe 97 % de ses heures au-dessus de son seuil par défaut, sa charge de base valant environ 90 % de sa capacité. Une alerte permanente n'est pas une alerte.

**Le résultat, et il est mauvais.** Le seuil relevé laisse 176 vrais dépassements sur la période, et le modèle **n'en annonce aucun**. Il suit bien le régime normal d'un site, il n'annonce pas ses extrêmes rares. C'est la limite la plus nette de ce modèle, cohérente avec le KPI 1 où le rappel s'effondre dès que l'événement devient rare, et elle n'apparaît que parce que l'ajustement a été fait.

**Ce que ça dit pour #44.** Le seuil de déclenchement ne peut pas être une constante globale : à 80 % de la capacité il sature les sites à charge plate, relevé il dépasse la capacité de détection du modèle. Il doit être réglable par site, ce que `warning_threshold_kw` permet déjà, et son réglage doit être mesuré, pas choisi.

## Limites

- L'effet d'une recommandation est une hypothèse, jamais une observation.
- Les seuils réglés à la main en base ne sont pas simulés, seul le défaut l'est.
- Le KPI 2 compte l'énergie au-dessus du **seuil de vigilance**, qui ne se facture pas. Le dépassement de la capacité souscrite, lui, reste rare sur la période, donc il ne fournit pas de signal exploitable.
- L'erreur de prévision ne croît pas avec l'horizon sur cette fenêtre : de 4 à 17 % selon le site, stable de H+6 à H+24. L'horizon de 24 heures n'est donc pas une contrainte du modèle.
