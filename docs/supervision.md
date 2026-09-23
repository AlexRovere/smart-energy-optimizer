# Supervision

Ce que la pile mesure, et pourquoi ces indicateurs-là. L'objectif tient en une phrase :
**diagnostiquer sans se connecter aux conteneurs**.

Rôle porteur : Cloud / DevOps. Épreuve : EC04. Issue : #55.

## Deux sources de mesure

| Conteneur | Ce qu'il apporte |
|---|---|
| `prometheus` | Collecte toutes les 15 s, conserve les séries, interface sur `127.0.0.1:9090`. |
| `node-exporter` | Mesure la **machine** : processeur, mémoire, disques, réseau. |
| `cadvisor` | Mesure les **conteneurs** : consommation, redémarrages, dernière apparition. |
| `grafana` | Restitue. Servi par Caddy sur `GRAFANA_PORT`, en TLS, et ne publie aucun port lui-même. |

**Aucune des deux sources ne voit ce que voit l'autre.** Une machine saine peut héberger un
conteneur qui redémarre en boucle ; des conteneurs sobres ne disent rien d'un disque que
remplissent les journaux. Une troisième s'y ajoute avec #40 : le service ML expose
`/metrics`, avec l'erreur de prévision relative par site. Le détail du calcul et du seuil vit
dans [`ml.md`](./ml.md), pas ici, cette page ne couvre que la collecte. La cible `dashboard`
reste commentée dans [`../infra/prometheus.yml`](../infra/prometheus.yml), en attente d'un
`/metrics` côté applicatif.

## Les indicateurs, et la question de chacun

Un panneau, une question. Un indicateur qui ne répond à aucune question qu'on se pose
vraiment occupe l'écran où on cherchera l'information utile le jour de l'incident.

| Panneau | La question | Seuil |
|---|---|---|
| Cibles de collecte | La collecte tient-elle ? Une cible tombée rend tout le reste muet sans prévenir : les courbes s'arrêtent, elles ne rougissent pas. | hors ligne = rouge |
| Redémarrages sur 24 h | Une brique redémarre-t-elle en boucle ? `unless-stopped` relance un service qui tombe : la pile paraît saine. Seul endroit où ça se voit. | 3 orange, 10 rouge |
| Dernier passage de l'ETL | Le cron a-t-il tourné avec succès ? L'ETL est le seul service sans politique de redémarrage : son absence est **normale**, donc son oubli invisible ailleurs. Un passage horaire manqué laisse un trou d'une heure. Lu par node-exporter : un passage dure 3 s, trop peu pour cAdvisor. | 2 h orange, 26 h rouge |
| Part libre la plus faible | Combien de temps avant que le disque ne bloque l'ETL ? Les Parquet grossissent et rien ne purge. En part et non en octets : la petite partition de démarrage gagnerait sinon le classement en permanence. | 20 % orange, 10 % rouge |
| Processeur de la machine | La machine tient-elle la charge ? Se lit pendant un passage de l'ETL et un entraînement, les deux seuls moments qui la sollicitent. | 75 % / 90 % |
| Mémoire de la machine | Reste-t-il de la place pour une brique de plus ? | 80 % / 92 % |
| Espace libre par système de fichiers | À quelle vitesse le disque se remplit-il ? C'est la **pente** qui donne la date de saturation, pas la valeur. | |
| Processeur par conteneur | Quelle brique consomme ? Sans ça, une machine à 90 % ne désigne aucun coupable et le diagnostic repart d'un `docker stats` à la main. | |
| Mémoire par conteneur | Une brique fuit-elle ? Une consommation qui monte sans redescendre sur plusieurs jours, ce qu'une valeur instantanée cache. | |

**Écartés** : les tableaux communautaires (des centaines d'indicateurs dont aucun n'est
choisi, bons pour fouiller, inutilisables comme tableau de garde) ; le détail réseau et les
entrées/sorties disque (aucune question à leur poser ici) ; les alertes, qui sont #56.

## Mise en service

**Sur un poste** : la pile se lance comme d'habitude, la supervision part avec elle.

```bash
sops exec-env secrets.enc.yaml 'docker compose up -d'
curl -s http://127.0.0.1:9090/api/v1/targets | grep -o '"health":"[a-z]*"'   # trois "up"
```

Grafana sur <https://localhost:3001>, compte `admin`. Source de données et tableaux sont
provisionnés depuis [`../infra/grafana/`](../infra/grafana/), rien à cliquer.

**Sur la machine** : rien de spécifique non plus. Le playbook de #47 lance
`docker compose up -d --wait` sans liste de services, donc les quatre conteneurs partent avec
le reste ; ils portent `restart: unless-stopped` et reviennent après un redémarrage de la
machine. **Grafana se joint directement**, en TLS, sur <https://\<adresse-machine\>:3001> : c'est
Caddy qui le sert, et c'est le seul service de supervision visible depuis le réseau (#39,
[`architecture.md`](./architecture.md)). Prometheus, lui, reste sur la boucle locale et demande
un tunnel :

```bash
ssh -L 9090:127.0.0.1:9090 apprenant@<machine>
```

## Le secret

`GRAFANA_ADMIN_PASSWORD` vit dans `secrets.enc.yaml` ([`secrets.md`](./secrets.md)). La
composition l'exige par un `:?` : sans valeur, la pile refuse de démarrer plutôt que de
laisser Grafana sur le mot de passe par défaut de son image, qui est public.

**Grafana ne le relit qu'au premier démarrage**, ensuite il vit dans le volume `grafana_data`.
Une rotation se joue donc dans le conteneur, pas dans le fichier chiffré :

```bash
docker compose exec grafana grafana cli admin reset-admin-password '<nouvelle-valeur>'
```

## Limites connues

- **Rétention de six mois** (`--storage.tsdb.retention.time=180d` sur le conteneur
  `prometheus`), au-delà du défaut de quinze jours. Portée à cette valeur pour #40 : l'erreur
  de prévision se lit sur la durée, une fenêtre de quinze jours l'aurait effacée trop tôt.
- **cAdvisor tourne en mode privilégié**, il lui faut `/dev/kmsg`. Tous ses montages sont en
  lecture seule, mais c'est le conteneur le plus exposé de la pile : à relever dans l'audit #58.
- **Grafana est en clair sur la boucle locale**, sans TLS. Acceptable tant que l'accès distant
  passe par SSH, qui chiffre ; plus le jour où on le mettrait derrière le proxy.
- **Un seul service applicatif est mesuré, et sans tableau de bord.** Le service ML expose
  `/metrics` depuis #40, mais aucun panneau Grafana ne le restitue encore, c'est laissé à une
  itération suivante avec l'alerte. Le dashboard, lui, n'expose toujours rien : le tableau dit
  qu'il tourne et ce qu'il consomme, pas s'il répond correctement.

## À vérifier sur la machine

Validé sur un poste Windows le 21 septembre 2026 : quatre conteneurs `healthy`, trois cibles
`up`, tableau provisionné, tout revient après un redémarrage. Trois points demandent l'hôte
Linux.

1. **cAdvisor rattache-t-il les conteneurs ?** Sous Docker Desktop, non : ses séries n'ont pas
   d'étiquette `name`, et les quatre panneaux qui en dépendent restent vides, soit la moitié du
   tableau. Sur un moteur Docker ordinaire, c'est son cas nominal. À vérifier en premier :
   `curl -s 'http://127.0.0.1:9090/api/v1/query?query=container_last_seen' | grep -c '"name":'`
   doit rendre autre chose que zéro.
2. **Le disque des Parquet apparaît-il ?** `PARQUET_DIR_HOST` vaut `/data/output`, un répertoire
   de la racine : c'est donc `/` qu'on surveille. S'il manque, revoir le filtre
   `--collector.filesystem.mount-points-exclude` de la composition.
3. **cAdvisor démarre-t-il avec `/dev/kmsg` ?** Le périphérique existe sous Linux et le conteneur
   a démarré sous Docker Desktop : risque faible, mais c'est le point de panne le plus probable
   au premier lancement.
