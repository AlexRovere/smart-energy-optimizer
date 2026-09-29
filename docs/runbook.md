# Runbook d'exploitation

Quoi faire selon la situation. Chaque geste renvoie vers la doc qui le détaille. Épreuve EC06, issue #254.

Sur la VM : utilisateur `apprenant`, depuis `/home/apprenant/Projet/enerVision`. `<adresse-machine>`
est l'`ansible_host` de [`inventory.ini`](../infra/ansible/inventory.ini). Aucune commande n'a été
rejouée sur la VM pour écrire ce document. Les procédures qui n'existent qu'ici sont marquées
*non rejouée*.

## Démarrer

### Poste de développement

```bash
node scripts/dev-stack.mjs up      # toute la pile, données fictives, http://localhost:3000
node scripts/dev-stack.mjs reset   # repart de zéro
```

Connexion : `admin@enervision.local` et le `SEED_PASSWORD` de `dev.env`. Dashboard avec
rechargement à chaud : [`README.md`](../README.md#développer). Port 55432 déjà pris :
`POSTGRES_PUBLISHED_PORT` et `NUXT_DATABASE_URL` dans `.env.local`. Pile de production sur le
poste : [`README.md`](../README.md#déployer), port 5432 déjà pris : `POSTGRES_PUBLISHED_PORT=15432`
dans `.env`.

### VM, première fois

1. Préparation `root` (répertoires, clé age) : [`DEPLOIEMENT.md`](../DEPLOIEMENT.md#préparation-unique-de-la-vm).
2. Déploiement, attendu `failed=0` :
   ```bash
   export GH_REPOSITORY_TOKEN=$(gh auth token)
   ansible-playbook -i infra/ansible/inventory.ini --connection local infra/ansible/playbook.yml
   ```
   [`DEPLOIEMENT.md`](../DEPLOIEMENT.md#premier-déploiement-manuel-avec-ansible)
3. Historique Parquet : copie ou [rattrapage](#rattraper-lhistorique), propriétaire `1000:1000`.
   [`DEPLOIEMENT.md`](../DEPLOIEMENT.md#données-parquet)
4. Runner GitHub en service, label `enervision` : [`DEPLOIEMENT.md`](../DEPLOIEMENT.md#installer-le-runner-github).

## Exploiter

Sur la VM, toute commande `docker compose` passe par les secrets. Dans la suite, `SOPS` vaut :

```bash
SOPS='sops exec-env secrets.enc.yaml'   # clé : ~/.config/sops/age/keys.txt
```

### Vérifier la pile

```bash
docker ps                                            # tout healthy
curl --fail -k https://<adresse-machine>/            # dashboard
curl --fail -k https://<adresse-machine>:3001/api/health   # Grafana
$SOPS 'docker compose logs --tail=100 postgres ml dashboard'
```

[`DEPLOIEMENT.md`](../DEPLOIEMENT.md#vérifier-le-déploiement)

### Déployer

Automatique après une CI verte sur `main`. Sinon : Actions, CD, Run workflow. Sans runner : le
`ansible-playbook` ci-dessus depuis la VM. [`DEPLOIEMENT.md`](../DEPLOIEMENT.md#déploiement-automatique)

### L'ETL a-t-il tourné ?

```bash
jq -r 'select(.phase == "run") | [.run, .status, .rows] | @tsv' /var/log/enervision/etl.jsonl | tail
tail -n 50 /var/log/enervision/etl.err               # erreurs Compose, SOPS, tracebacks
```

Attendu : une ligne `ok` par heure. Passage immédiat :

```bash
ETL_METRICS_DIR=/var/lib/enervision/metrics ./etl_cron.sh >> /var/log/enervision/etl.jsonl 2>> /var/log/enervision/etl.err
```

[`DEPLOIEMENT.md`](../DEPLOIEMENT.md#passage-horaire-de-letl),
[`apps/etl/README.md`](../apps/etl/README.md#journal-dexécution)

### Rattraper l'historique

`periods` saute tout jour qui a déjà une partition : un jour auquel il manque quelques heures
compte comme couvert. Deux cas.

**Heures manquantes dans des jours existants** (rejouée sur la VM le 24 septembre). Les
trouver, puis relire 8 jours en forçant, comme `hour` :

```bash
docker exec $(docker ps -qf name=enervision-ml) python -c "
import pandas as pd
df = pd.read_parquet('/data', columns=['site_id','timestamp'])
df['timestamp'] = pd.to_datetime(df['timestamp'])
for s, g in df.groupby('site_id'):
    t = g['timestamp'].sort_values()
    manque = pd.date_range(t.max() - pd.Timedelta(hours=167), t.max(), freq='h').difference(pd.DatetimeIndex(t))
    print(s, 'manquantes:', len(manque))
"
$SOPS 'docker compose run --rm -T etl python -c "from datetime import datetime, timedelta, timezone; from main import run_periods; n = datetime.now(timezone.utc); run_periods(start_time=n - timedelta(days=8), end_time=n, skip_coverage_check=True)"' >> /var/log/enervision/etl.jsonl
```

Attendu : `manquantes: 0` pour chaque site au second passage de la première commande.

**Jours entiers manquants** (*non rejouée*) : `etl_ensure_history.sh` relit deux ans. Il appelle
`docker compose` sans les secrets, il faut donc l'envelopper. Long, à lancer dans `tmux`.

```bash
$SOPS './etl_ensure_history.sh' >> /var/log/enervision/etl.jsonl
```

Période précise : [`apps/etl/README.md`](../apps/etl/README.md#commandes).

### Sauvegarder et restaurer

*Non rejouée.* Une archive chiffrée age : dump PostgreSQL et Parquet. Les scripts ne lisent pas
le `.env` de la machine : sans `PARQUET_DIR_HOST`, la sauvegarde échoue après le dump. `./backups`
n'est pas ignoré par git, d'où `BACKUP_DIR`.

```bash
PARQUET_DIR_HOST=/data/output BACKUP_DIR="$HOME/backups" ./postgre_backup.sh
PARQUET_DIR_HOST=/data/output ./postgre_restore.sh "$HOME/backups/enervision-backup-<horodatage>.tar.age"
```

La restauration refuse une base ou un `/data/output` non vides. `--force` écrase la base et
extrait par-dessus les Parquet existants : arrêter la pile avant.

### Faire tourner une clé

| Situation | Geste |
|---|---|
| Départ d'un membre | Retirer sa clé de `.sops.yaml`, `sops updatekeys`, commiter, redéployer |
| Clé fuitée | **Changer les valeurs**, redéployer, puis retirer la clé |
| Mot de passe Grafana | `$SOPS "docker compose exec grafana grafana cli admin reset-admin-password '<valeur>'"` (*non rejouée*) |

[`secrets.md`](./secrets.md#rotation-et-révocation), [`supervision.md`](./supervision.md#le-secret)

### Lire Grafana

`https://<adresse-machine>:3001`, compte `admin`, tableau « Pile enerVision ». Dans l'ordre :
cibles de collecte (une cible tombée rend tout muet), redémarrages sur 24 h, dernier passage de
l'ETL (rouge à 26 h), part libre du disque (rouge à 10 %), puis machine et conteneurs.
[`supervision.md`](./supervision.md#les-indicateurs-et-la-question-de-chacun)

## Incidents connus

| Symptôme | Cause | Réparation | Issue |
|---|---|---|---|
| Vue historique en 503 dès qu'il y a des Parquet | Colonne `consumption_kw_raw` inexistante, lots DuckDB lus comme des lignes | Corrigé dans `parquetReader.ts` | #167 |
| 503 et `Hive partition mismatch ... key "day"` | Le glob lisait `sites.parquet`, hors partition | Glob restreint à `site_id=*/**/*.parquet` | #207 |
| Dernier passage ETL orange ou rouge, trous dans l'historique | `hour` ne relit que la dernière heure : un passage manqué est perdu | [Rattraper l'historique](#rattraper-lhistorique). Fenêtre de 24 h en cours (#246) | #243 |
| Prédiction en 503 dans le dashboard, `422 Unprocessable Entity` dans son journal | Le ML refuse : `history must contain consecutive hours`. Le dashboard rend tout échec du ML en 503 et ne journalise pas le `detail` | Lire le `detail` avec `curl -X POST http://127.0.0.1:8000/predictions`, puis [rattraper les heures manquantes](#rattraper-lhistorique) | #243 |
| Panneaux par conteneur vides | Label `name` absent des séries cAdvisor, cause non établie | Diagnostic dans l'issue. En attendant : `docker stats --no-stream` | #229, ouverte |
| Job CD bloqué en `Queued` | Runner arrêté (lancé par `run.sh`) ou label `enervision` absent | `sudo ./svc.sh start` dans `~/actions-runner`, vérifier le label | [`DEPLOIEMENT.md`](../DEPLOIEMENT.md#dépannage-rapide) |
| Runner incapable de déployer, secrets à recopier en clair (16 septembre) | Aucune clé pour déchiffrer sur place | Clé age de machine depuis le 17. Lisible par tout le compte `apprenant` : la retirer impose de changer les valeurs | [`secrets.md`](./secrets.md#les-amorçages-faits-une-fois) |
| SOPS refuse de déchiffrer | Clé absente, mauvais propriétaire ou mauvais destinataire | `ls -l ~/.config/sops/age/keys.txt` : `apprenant`, `600`. Jamais de `.env` en clair | [`DEPLOIEMENT.md`](../DEPLOIEMENT.md#dépannage-rapide) |
