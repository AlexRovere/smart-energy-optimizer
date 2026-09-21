# Supervision

Ce que la pile mesure, ce qu'on en lit, et pourquoi ces indicateurs-là. L'objectif
tient en une phrase : **diagnostiquer sans se connecter aux conteneurs**. Tant qu'il
faut ouvrir une session sur la machine et enchaîner `docker stats`, `df -h` et
`docker logs` pour savoir ce qui se passe, il n'y a pas de supervision, il y a une
habitude.

Rôle porteur : Cloud / DevOps. Épreuve : EC04. Issue : #55.

## Quatre conteneurs, deux sources de mesure

| Conteneur | Ce qu'il apporte |
|---|---|
| `prometheus` | Collecte toutes les 15 secondes et conserve les séries. Interface sur `127.0.0.1:9090` pour interroger à la main ce qu'un panneau n'explique pas. |
| `node-exporter` | Mesure la **machine** : processeur, mémoire, disques, réseau. |
| `cadvisor` | Mesure les **conteneurs** : consommation, redémarrages, dernière apparition. |
| `grafana` | Lit Prometheus et sert le tableau. Interface sur `127.0.0.1:3001`. |

**Les deux sources ne se remplacent pas**, et c'est le point à retenir. Une machine
parfaitement saine peut héberger un conteneur qui redémarre toutes les deux minutes :
le node exporter n'en verra rien, la charge d'un service qui meurt vite étant
négligeable. À l'inverse, des conteneurs sobres ne disent rien d'un disque qui se
remplit à cause des sauvegardes ou des journaux, qui ne sont dans aucun conteneur.

Les **cibles applicatives** s'ajoutent à cette base au fur et à mesure que les
services exposent `/metrics`. Aucun ne le fait aujourd'hui ; la dérive du modèle est
la première attendue (#40). Leurs entrées sont déjà écrites, commentées, dans
[`../infra/prometheus.yml`](../infra/prometheus.yml).

## Les indicateurs retenus

Un panneau, une question. Un indicateur qui ne répond à aucune question qu'on se pose
vraiment n'est pas de la supervision, c'est de la décoration, et il coûte plus cher
qu'il ne rapporte : il occupe l'écran où on cherchera l'information utile le jour de
l'incident.

### La pile répond-elle ?

| Indicateur | La question | Seuil |
|---|---|---|
| Cibles de collecte (`up`) | Est-ce que la collecte elle-même tient ? Une cible tombée rend tout le reste du tableau muet, sans prévenir : les courbes s'arrêtent, elles ne deviennent pas rouges. | hors ligne = rouge |
| Redémarrages de conteneurs sur 24 h | Est-ce qu'une brique redémarre en boucle ? La politique `unless-stopped` relance un service qui tombe : la pile paraît saine alors qu'un conteneur meurt sans arrêt. C'est le seul endroit où ça se voit. | 3 = orange, 10 = rouge |
| Temps depuis le dernier passage de l'ETL | Le cron a-t-il tourné cette nuit ? L'ETL est le seul service sans politique de redémarrage : il est lancé, il finit, il disparaît. Son absence est **normale**, donc son oubli est invisible partout ailleurs, et l'historique Parquet prend un trou que personne ne remarque avant d'en avoir besoin. | 26 h = orange, 48 h = rouge |
| Part libre la plus faible sur un système de fichiers | Combien de temps avant que le disque ne bloque l'ETL ? Les fichiers Parquet grossissent à chaque exécution et rien ne les purge aujourd'hui. En part libre et non en octets restants : la petite partition de démarrage gagnerait sinon le classement en permanence, sans rien dire de l'espace qui manque vraiment. | 20 % = orange, 10 % = rouge |

### La machine

| Indicateur | La question |
|---|---|
| Processeur | La machine tient-elle la charge, ou faut-il du matériel ? Se lit pendant une exécution de l'ETL et un entraînement du modèle, les deux seuls moments qui la sollicitent vraiment. |
| Mémoire | Reste-t-il de la place pour une brique de plus ? La question se pose à chaque ajout de service, et cette story en ajoute quatre. |
| Espace libre par système de fichiers | À quelle vitesse le disque se remplit-il ? La valeur seule ne dit rien, c'est la **pente** qui donne la date de saturation. Le point de montage des Parquet est celui à surveiller. |

### Les conteneurs

| Indicateur | La question |
|---|---|
| Processeur par conteneur | Quelle brique consomme ? Sans cette vue, une machine à 90 % ne désigne aucun coupable et le diagnostic repart d'un `docker stats` à la main, ce que la supervision est là pour éviter. |
| Mémoire par conteneur | Une brique fuit-elle ? Une consommation qui monte sans jamais redescendre sur plusieurs jours est le signe qu'on cherche, et une valeur instantanée le cache. |

## Ce qui a été écarté, et pourquoi

**Les tableaux communautaires** (Node Exporter Full, cAdvisor) : quelques centaines
d'indicateurs, aucun choisi. Ils sont excellents pour fouiller quand on sait déjà ce
qu'on cherche, et inutilisables comme tableau de garde : le critère du ticket demande
des indicateurs justifiés, pas un mur de courbes. Rien n'empêche d'en importer un le
jour d'un diagnostic pointu, ils s'ajoutent en une entrée de provisionnement.

**Le détail réseau et les entrées/sorties disque** : on ne sait pas quelle question
ils répondraient ici. Sept sites et quelques dizaines de mégaoctets par jour ne
saturent ni une carte réseau ni un disque en débit. Le jour où une lenteur inexpliquée
apparaît, ils s'ajoutent avec la question qui les motive.

**Les alertes** : c'est #56. Les seuils du tableau colorent une valeur, ils n'envoient
rien. La différence compte : un tableau se regarde, une alerte se reçoit.

## Mise en service

### Sur un poste

```bash
cp .env.example .env                                  # renseigner au moins les RÉGLAGES
sops exec-env secrets.enc.yaml 'docker compose up -d' # ou docker compose up -d avec un .env complet
```

Puis Grafana sur <http://127.0.0.1:3001>, compte `admin` et le mot de passe de
`GRAFANA_ADMIN_PASSWORD`. Le tableau **Pile enerVision** est déjà là : la source de
données et les tableaux sont provisionnés depuis [`../infra/grafana/`](../infra/grafana/),
rien à cliquer.

Pour vérifier que la collecte tourne avant même d'ouvrir Grafana :

```bash
curl -s http://127.0.0.1:9090/api/v1/targets | grep -o '"health":"[a-z]*"'
```

Trois `"health":"up"` attendus : `prometheus`, `node`, `cadvisor`.

### Sur la machine sur site

Rien de spécifique : les quatre conteneurs font partie de `docker-compose.yml` et
partent avec le reste de la pile. Ils portent tous `restart: unless-stopped`, donc ils
reviennent après un redémarrage de la machine sans que personne n'intervienne.

Tant que #107 n'est pas faite, la mise en service se joue **à la main sur la machine**,
comme pour toute la pile aujourd'hui :

```bash
git pull
sops exec-env secrets.enc.yaml 'docker compose up -d'
```

C'est une exception à la règle « le pipeline est le seul chemin vers la machine »
([`../infra/ansible/README.md`](../infra/ansible/README.md)), et elle n'est pas propre
à la supervision.

**L'accès à Grafana passe par un tunnel SSH**, depuis son poste :

```bash
ssh -L 3001:127.0.0.1:3001 apprenant@<machine>
```

Puis <http://127.0.0.1:3001> sur son poste. Aucun port de supervision n'est publié sur
le réseau : le seul point d'entrée prévu est le 443 du reverse proxy (#39), et la
supervision n'a pas à y figurer.

## Le secret

`GRAFANA_ADMIN_PASSWORD` est un secret, il vit dans `secrets.enc.yaml`
([`secrets.md`](./secrets.md)), posé le 21 septembre 2026 avec cette story. La
composition l'exige par un `:?` : sans valeur, la pile refuse de démarrer plutôt que
de laisser Grafana sur le mot de passe par défaut de son image, qui est public.

Pour le poser ailleurs, ou le refaire :

```bash
printf '"%s"' "$(openssl rand -base64 24 | tr -d '\r\n')" | sops set --value-stdin secrets.enc.yaml '["GRAFANA_ADMIN_PASSWORD"]'
```

Puis `git add secrets.enc.yaml` et un commit qui dit quelle clé a bougé et pourquoi.

**Changer cette valeur plus tard ne suffit pas.** Grafana ne lit
`GF_SECURITY_ADMIN_PASSWORD` qu'au tout premier démarrage, quand il crée sa base
interne ; ensuite le mot de passe vit dans le volume `grafana_data` et la variable est
ignorée. Une rotation se joue donc dans le conteneur :

```bash
docker compose exec grafana grafana cli admin reset-admin-password '<la-nouvelle-valeur>'
```

Relevé en montant la pile : la variable avait bien la bonne valeur, et la connexion
échouait quand même, sur un volume laissé par un lancement précédent.

## Limites connues

**La rétention est celle de Prometheus par défaut, quinze jours.** Suffisant pour un
MVP de dix jours, et c'est déjà plus que l'historique dont on dispose. Au-delà, les
séries les plus anciennes sont effacées : la supervision ne conserve pas d'historique
long, ce n'est pas son rôle, les mesures métier vivent dans les Parquet.

**cAdvisor tourne en mode privilégié.** Sous Linux il lui faut `/dev/kmsg`. Tous ses
montages sont en lecture seule, il observe et n'écrit nulle part, mais c'est le
conteneur le plus exposé de la pile et il doit figurer dans l'audit de sécurité (#58).

**Grafana est en clair sur la boucle locale**, sans TLS. C'est acceptable parce que
rien n'est publié sur le réseau et que l'accès distant passe par un tunnel SSH, qui
chiffre. Ça cesserait de l'être le jour où on le mettrait derrière le proxy.

**Aucun service applicatif n'est mesuré.** Le tableau dit que le dashboard tourne et
ce qu'il consomme, pas s'il répond correctement ni en combien de temps. Il faut pour
ça un `/metrics` dans chaque service, et ça commence avec #40.

## Ce qui reste à vérifier sur la machine

Le tableau a été monté et vérifié sur un poste Windows, sous Docker Desktop, le
21 septembre 2026 : les quatre conteneurs démarrent, les trois cibles sont `up`, le
tableau et la source de données sont provisionnés, et tout revient après un
`docker compose restart`. Trois points ne s'y vérifient pas et demandent l'hôte Linux.

**1. cAdvisor ne rattache aucun conteneur sous Docker Desktop.** Il démarre, il
collecte, mais ses séries n'ont pas d'étiquette `name` : le moteur ne lui rend pas les
métadonnées des conteneurs. Les quatre panneaux qui en dépendent (redémarrages,
dernier passage de l'ETL, processeur et mémoire par conteneur) restent donc vides sur
un poste, et **c'est la moitié du tableau**. Sur une machine Linux avec un moteur
Docker ordinaire, c'est le cas nominal de cAdvisor. À vérifier en premier :

```bash
curl -s 'http://127.0.0.1:9090/api/v1/query?query=container_last_seen' | grep -c '"name":'
```

Autre chose que zéro, et les quatre panneaux se remplissent.

**2. Le node exporter mesure la bonne machine.** Sous Docker Desktop, il mesure la VM
WSL : les valeurs sont réelles, mais ce n'est pas la machine sur site, et les vingt et
un systèmes de fichiers qu'il y voit sont des artefacts de WSL. Sur la VM, le panneau
« Espace libre par système de fichiers » doit montrer une poignée de points de montage
réels, dont **celui des fichiers Parquet**. S'il manque, revoir le filtre
`--collector.filesystem.mount-points-exclude` de la composition.

**3. cAdvisor démarre avec `/dev/kmsg`.** Le périphérique existe sous Linux, et il a
démarré sous Docker Desktop, donc le risque est faible. Il reste le point de panne le
plus probable au premier lancement, la composition le déclarant explicitement.
