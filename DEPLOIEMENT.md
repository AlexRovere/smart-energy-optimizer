# Déployer EnerVision sur la VM

Ce guide décrit le déploiement réellement utilisé pour EnerVision. Il part
d'une VM Linux déjà fournie et conduit jusqu'au déploiement automatique après
une CI réussie sur `main`.

La préparation système se fait une seule fois. Les déploiements suivants sont
exécutés sans privilège par Ansible, puis automatiquement par un runner GitHub
installé sur la VM.

## Vue d'ensemble

```text
Push ou fusion sur main
        |
        v
GitHub Actions : CI
        |
        | CI réussie
        v
GitHub Actions : CD
        |
        v
Runner auto-hébergé sur la VM, utilisateur apprenant
        |
        v
Ansible en connexion locale
        |
        +--> mise à jour de /home/apprenant/Projet/enerVision
        +--> déchiffrement SOPS en mémoire
        +--> construction des images
        +--> migrations et amorçage PostgreSQL
        +--> démarrage de Docker Compose
```

Deux copies du dépôt coexistent sur la VM :

**Copie temporaire du runner** :
`/home/apprenant/actions-runner/_work/enerVision/enerVision`. Elle est créée
automatiquement par `actions/checkout` pour exécuter le workflow et le dernier
playbook.

**Copie persistante de l'application** :
`/home/apprenant/Projet/enerVision`. Elle est mise à jour par Ansible, puis
utilisée pour construire et lancer la composition.

Le programme du runner reste dans `/home/apprenant/actions-runner`. Il ne doit
pas être installé dans le dépôt applicatif.

## Prérequis

La VM doit disposer de :

- Docker Engine ;
- le plugin Docker Compose ;
- Git ;
- Ansible ;
- SOPS ;
- age ;
- un accès sortant à GitHub ;
- l'utilisateur `apprenant`, UID et GID `1000` ;
- un accès de `apprenant` au moteur Docker.

Vérifier comme `apprenant` :

```bash
docker --version
docker compose version
docker info
git --version
ansible-playbook --version
sops --version
age --version
id apprenant
```

`docker info` doit réussir sans `sudo`. L'identité doit contenir
`uid=1000(apprenant)` et `gid=1000(apprenant)`, car l'ETL écrit les Parquet avec
ces identifiants.

## Préparation unique de la VM

Cette section est la seule qui nécessite `root`. Elle n'est pas rejouée par la
CD et ne donne pas d'accès sudo permanent à `apprenant`.

### 1. Créer les répertoires

Depuis un terminal `root` :

```bash
install -d -o apprenant -g apprenant -m 0755 /home/apprenant/Projet
install -d -o apprenant -g apprenant -m 0755 /data/output
install -d -o apprenant -g apprenant -m 0750 /var/log/enervision
install -d -o apprenant -g apprenant -m 0700 /home/apprenant/.config/sops/age
```

Rôle des répertoires :

**`/home/apprenant/Projet/enerVision`** : dépôt persistant de l'application.

**`/data/output`** : historique Parquet partagé entre l'ETL, le dashboard et le
ML.

**`/var/log/enervision`** : journaux des tâches d'exploitation.

**`/home/apprenant/.config/sops/age`** : clé privée age de la VM.

PostgreSQL, les modèles ML, Prometheus et Grafana utilisent des volumes Docker
nommés. Aucun répertoire hôte supplémentaire n'est créé pour eux.

### 2. Installer la clé age de la VM

La clé a été générée sur la VM et sa clé publique est déclarée comme
destinataire `Machine sur site` dans `.sops.yaml`. Elle ne doit jamais sortir de
la VM.

Si la clé privée se trouve initialement sous `/root` :

```bash
install \
  -o apprenant \
  -g apprenant \
  -m 0600 \
  /root/.config/sops/age/keys.txt \
  /home/apprenant/.config/sops/age/keys.txt
```

Ne pas afficher le contenu du fichier. Vérifier uniquement ses métadonnées :

```bash
ls -l /home/apprenant/.config/sops/age/keys.txt
```

Le résultat attendu appartient à `apprenant:apprenant` avec le mode `600`.

## Première récupération du dépôt

Cette étape permet le premier test manuel. Elle est exécutée comme
`apprenant`, pas comme `root` :

```bash
git clone \
  https://github.com/EADL-2026/enerVision.git \
  /home/apprenant/Projet/enerVision

cd /home/apprenant/Projet/enerVision
```

Le dépôt étant privé, vérifier que la mise à jour fonctionne sans interaction :

```bash
git ls-remote origin HEAD
```

Le playbook utilise ensuite `ansible.builtin.git` pour cloner le dépôt s'il est
absent ou récupérer les nouveaux commits de `main`. Avec `force: false`, une
modification locale d'un fichier suivi bloque le déploiement au lieu d'être
écrasée.

## Secrets avec SOPS et age

Il n'existe pas de `.env` de production sur la VM. Les valeurs sont versionnées
chiffrées dans `secrets.enc.yaml`, puis injectées en mémoire dans chaque commande
Compose avec `sops exec-env`.

Tester comme `apprenant` :

```bash
cd /home/apprenant/Projet/enerVision

SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt" \
  sops decrypt secrets.enc.yaml > /dev/null \
  && echo "Déchiffrement OK"
```

Puis valider la composition sans afficher les valeurs :

```bash
SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt" \
  sops exec-env secrets.enc.yaml \
  'docker compose config --quiet'
```

Une clé absente ou qui ne correspond pas au destinataire de la machine doit
bloquer le déploiement. Ne jamais contourner ce contrôle avec un `.env` en clair.

## Données Parquet

Le playbook vérifie le point de montage `/data/output`, mais ne copie et ne
supprime aucune donnée. Sa création initiale par `root` reste un prérequis. Les
Parquet sont des données d'exploitation, pas un artefact applicatif.

Pour la première initialisation, deux possibilités existent :

- reconstruire l'historique avec l'ETL ;
- restaurer une sauvegarde ou effectuer une copie initiale explicite.

Exemple de copie initiale depuis WSL :

```bash
rsync -av \
  /mnt/d/enerVision/data/output/ \
  apprenant@10.101.200.31:/data/output/
```

Vérifier sur la VM :

```bash
find /data/output -type f -name '*.parquet' | wc -l
du -sh /data/output
```

Les redéploiements conservent ce répertoire.

## Premier déploiement manuel avec Ansible

Le test est exécuté directement sur la VM comme `apprenant`. L'inventaire
temporaire `enervision,` désigne la machine locale : aucun SSH et aucun sudo ne
sont nécessaires.

Depuis la racine du dépôt :

```bash
cd /home/apprenant/Projet/enerVision

ansible-playbook \
  -i 'enervision,' \
  --connection local \
  infra/ansible/playbook.yml \
  --syntax-check

ansible-playbook \
  -i 'enervision,' \
  --connection local \
  infra/ansible/playbook.yml
```

Le récapitulatif attendu contient :

```text
unreachable=0
failed=0
```

Le playbook exécute dans cet ordre :

1. vérification de Docker, Compose, SOPS et age ;
2. vérification des répertoires ;
3. mise à jour de la copie persistante sur `main` ;
4. vérification de la clé age ;
5. validation de la composition avec les secrets déchiffrés en mémoire ;
6. construction des images ;
7. démarrage de PostgreSQL ;
8. exécution du conteneur temporaire `migrate` ;
9. exécution optionnelle du conteneur temporaire `seed` ;
10. démarrage de la pile complète.

`migrate` et `seed` sont des services du profil Compose `admin`. Ils sont lancés
avec `docker compose run --rm`, puis leurs conteneurs sont supprimés. Leurs
images restent disponibles.

## Vérifier le déploiement

Afficher les services Compose :

```bash
cd /home/apprenant/Projet/enerVision

SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt" \
  sops exec-env secrets.enc.yaml \
  'docker compose ps'
```

Pour une vérification rapide sans charger la configuration Compose :

```bash
docker ps
```

Tester les services depuis la VM :

```bash
curl --fail http://127.0.0.1:3000/
curl --fail http://127.0.0.1:8000/health
curl --fail http://127.0.0.1:3001/api/health
curl --fail http://127.0.0.1:9090/-/healthy
```

Les ports sont liés à `127.0.0.1`. Pour tester depuis un poste, ouvrir un tunnel
SSH :

```bash
ssh \
  -L 3000:127.0.0.1:3000 \
  -L 8000:127.0.0.1:8000 \
  -L 3001:127.0.0.1:3001 \
  -L 9090:127.0.0.1:9090 \
  apprenant@10.101.200.31
```

Puis ouvrir `http://localhost:3000`, `http://localhost:8000/health`,
`http://localhost:3001` ou `http://localhost:9090`.

## Installer le runner GitHub

Le runner est nécessaire parce que la VM possède une adresse privée et n'est
pas joignable depuis les runners hébergés par GitHub. Il appelle GitHub en HTTPS
sortant et reçoit les jobs de déploiement.

Dans le dépôt GitHub :

```text
Settings > Actions > Runners > New self-hosted runner
```

Choisir Linux x64 et exécuter sous `apprenant` les commandes de téléchargement
et de configuration affichées par GitHub. Utiliser :

```text
Nom du runner : enervision-vm
Dossier de travail : _work
```

Le programme est installé dans :

```text
/home/apprenant/actions-runner
```

`./run.sh` permet un premier test au premier plan. Il s'arrête avec la session
SSH. Pour l'exploitation, arrêter `run.sh`, puis installer le runner comme
service depuis un terminal `root` :

```bash
cd /home/apprenant/actions-runner
./svc.sh install apprenant
./svc.sh start
./svc.sh status
```

Dans GitHub, le runner doit apparaître `Idle` avec les labels demandés par
`.github/workflows/deploy.yml` :

```text
self-hosted, Linux, X64
```

Le fichier `.env` présent dans `actions-runner` appartient au fonctionnement
interne du runner. Ce n'est pas un fichier de secrets EnerVision et il ne doit
pas être supprimé.

## Déploiement automatique

Le workflow `.github/workflows/deploy.yml` possède deux déclencheurs :

- automatique après une exécution réussie de `CI` sur `main` ;
- manuel avec `Actions > CD > Run workflow`.

Le runner reçoit le nom du dépôt et crée automatiquement :

```text
/home/apprenant/actions-runner/_work/enerVision/enerVision
```

L'étape `actions/checkout` y récupère tous les fichiers suivis de `main`, dont le
dernier playbook. Le job lance ensuite :

```bash
ansible-playbook \
  -i 'enervision,' \
  --connection local \
  infra/ansible/playbook.yml
```

Le workflow n'a besoin ni de clé SSH de déploiement, ni de mot de passe sudo,
ni de secret applicatif GitHub. Il utilise la clé age qui reste sur la VM.

Le groupe de concurrence `production` garantit qu'un second déploiement attend
la fin du premier au lieu de l'interrompre pendant une migration.

## Exploitation courante

Afficher l'état :

```bash
docker ps
```

Afficher les journaux avec les variables Compose :

```bash
cd /home/apprenant/Projet/enerVision

SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt" \
  sops exec-env secrets.enc.yaml \
  'docker compose logs --tail=100 postgres ml dashboard'
```

Rejouer manuellement le déploiement :

```text
GitHub > Actions > CD > Run workflow
```

Les conteneurs existants conservent leur environnement après un redémarrage du
moteur Docker. Une reconstruction complète exige en revanche la clé age pour
réinjecter les variables.

## Dépannage rapide

**Le job CD reste en attente** : vérifier que le runner est `Idle` et possède
les labels `self-hosted`, `Linux` et `X64`.

**Le runner disparaît après la fermeture SSH** : il tourne avec `run.sh` au
lieu d'être installé comme service avec `svc.sh`.

**SOPS refuse de déchiffrer** : vérifier que la clé existe sous
`/home/apprenant/.config/sops/age/keys.txt`, appartient à `apprenant` et
correspond au destinataire de la machine.

**`docker compose ps` réclame une variable** : utiliser
`sops exec-env secrets.enc.yaml 'docker compose ps'`, ou `docker ps` pour une
vue simple.

**Git refuse la mise à jour** : le dépôt persistant contient une modification
locale, ou l'accès non interactif au dépôt privé n'est pas configuré.

**Ansible échoue sur `/data/output` ou les logs** : rejouer la préparation
unique des répertoires comme `root`.

**Les migrations n'apparaissent pas dans `docker ps`** : c'est normal. Leurs
conteneurs sont lancés avec `run --rm`, puis supprimés.

## Ce qui n'est pas automatisé

Les opérations suivantes restent volontaires et séparées du déploiement :

- installation initiale des paquets système ;
- création initiale des répertoires par `root` ;
- génération et installation de la clé age de la VM ;
- restauration ou reconstruction initiale des Parquet ;
- enregistrement du runner GitHub et installation de son service ;
- sauvegarde et restauration de PostgreSQL et des données d'exploitation.

Ces opérations modifient l'hôte ou les données. Le playbook applicatif reste
rejouable, sans privilège et sans copie de secret en clair.
