# Insights de consommation

Ce dossier transforme les données Parquet de l'ETL en rapports HTML locaux.
L'objectif est de comprendre simplement comment les sites consomment selon
leur type, l'heure, le jour, le mois, la température et l'humidité.

## Rapports disponibles

| Fichier | Contenu |
|---|---|
| `apercu_sites_001_003.html` | Vue détaillée de SITE001 et SITE003, qualité des données, périodicité et corrélations |
| `profils_consommation.html` | Profil d'un type de site, moyennes mensuelles et pics par site |
| `comparaison_types_sites.html` | Comparaison des types et tableau mensuel des sept sites |
| `tableau_kpi.html` | KPI filtrables par périmètre, période et seuil de pic |

Les fichiers HTML et JSON sont générés localement et ne sont pas versionnés.

## Conclusions principales

Les valeurs ci-dessous correspondent aux données actuellement présentes dans
`data/output`. Elles évolueront lorsque de nouvelles mesures seront chargées.

| Type | Moyenne horaire | Différence le week-end | Conclusion simple |
|---|---:|---:|---|
| Datacenter | 723,98 kWh | +0,1 % | Consommation élevée et très stable toute la semaine |
| Factory | 528,10 kWh | -47,4 % | Activité fortement réduite le week-end |
| Hospital | 467,98 kWh | +0,2 % | Consommation stable toute la semaine |
| Retail | 229,87 kWh | +32,9 % | Activité nettement plus forte le week-end |
| Office | 87,05 kWh | -27,8 % | Activité principalement concentrée sur les jours ouvrés |

Les bureaux et les usines ont donc les profils hebdomadaires les plus marqués.
Le datacenter et l'hôpital fonctionnent de manière beaucoup plus régulière.

La consommation des types `office`, `factory` et `retail` augmente légèrement
avec la température. La corrélation reste modérée (`r` entre 0,25 et 0,30) et
ne prouve pas que la température est la cause de cette hausse. Aucune relation
linéaire notable avec l'humidité n'apparaît dans les données.

Les moyennes mensuelles montrent notamment un maximum en octobre pour les
datacenters, les usines et les bureaux. Les hôpitaux et les commerces atteignent
leur maximum en avril. Ces observations sont descriptives et ne suffisent pas
à conclure à un effet saisonnier.

## Définition d'un pic

Un pic est calculé séparément pour chaque site :

```text
seuil = moyenne du site × (1 + pourcentage sélectionné / 100)
pic = consommation horaire strictement supérieure au seuil
```

Les rapports proposent des seuils de `+50 %`, `+60 %`, `+70 %`, `+80 %`,
`+90 %` et `+100 %`.

Le seuil `+50 %` identifie beaucoup d'heures pour les bureaux et les usines :
il représente surtout leurs périodes normales de forte activité. À `+100 %`,
les dépassements deviennent rares et se rapprochent davantage d'événements
exceptionnels. Aucun dépassement de `+50 %` n'est actuellement observé pour le
datacenter et l'hôpital, dont la consommation est plus stable.

Le « créneau moyen maximal » est différent d'un pic : il indique seulement le
jour et l'heure où la moyenne est la plus élevée.

## Limites à connaître

- Les types `datacenter`, `hospital` et `retail` ne contiennent qu'un seul site.
  Leur profil ne représente donc pas forcément tous les sites de ce type.
- Les valeurs corrigées par l'ETL sont utilisées pour les calculs.
- Une corrélation décrit une association, pas une causalité.
- Le seuil de pic est volontairement simple et doit être interprété selon le
  fonctionnement métier de chaque site.
- Les timestamps, jours et heures sont interprétés en UTC.

## Régénérer les rapports

Depuis la racine du dépôt, sous PowerShell :

```powershell
$env:PARQUET_DIR = "D:\enerVision\data\output"

& ".\apps\etl\.venv\Scripts\python.exe" ".\apps\etl\insights\prepare_data.py"
& ".\apps\etl\.venv\Scripts\python.exe" ".\apps\etl\insights\build_html.py"
& ".\apps\etl\.venv\Scripts\python.exe" ".\apps\etl\insights\build_profiles_html.py"
& ".\apps\etl\.venv\Scripts\python.exe" ".\apps\etl\insights\build_comparison_html.py"
& ".\apps\etl\.venv\Scripts\python.exe" ".\apps\etl\insights\build_kpi_html.py"
```

`prepare_data.py` doit toujours être lancé en premier. Il lit les Parquet et
génère `data.json`, `profiles_data.json` et `kpi_data.json`. Les quatre autres
scripts construisent ensuite les pages HTML.

## Organisation du code

| Fichier | Rôle |
|---|---|
| `prepare_data.py` | Lit les Parquet et prépare les données des rapports |
| `profiles.py` | Calcule les moyennes, corrélations, profils mensuels et pics |
| `kpis.py` | Calcule les KPI sur des fenêtres comparables de 30, 90 et 365 jours |
| `build_html.py` | Construit l'aperçu détaillé SITE001/SITE003 |
| `build_profiles_html.py` | Construit le rapport par type de site |
| `build_comparison_html.py` | Construit le rapport comparatif |
| `build_kpi_html.py` | Construit le tableau de bord KPI interactif |
