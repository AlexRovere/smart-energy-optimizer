# Les secrets du projet

Les valeurs sensibles de la pile vivent chiffrées dans [`secrets.enc.yaml`](../secrets.enc.yaml) avec **SOPS** et **age** ; [`.sops.yaml`](../.sops.yaml) dit en clair qui peut les déchiffrer. Ce document existe pour que n'importe quel membre chiffre et déchiffre **sans demander d'aide** : un mécanisme qui ne marche que sur le poste de qui l'a posé ne protège rien, il déplace le problème sur une personne (issue #99, fermée en doublon avec #52).

Ce que ça protège : un accès en lecture au dépôt (clone, capture d'écran, dépôt passé public par erreur) ne rend que du chiffré. Ce que ça ne protège pas : le moteur Docker, qui garde les variables d'environnement en clair une fois le conteneur lancé, et, **depuis le 17 septembre 2026, une clé de déchiffrement dort sur la machine sur site**. Ce n'était pas le cas jusque là et ce n'est pas un détail : la décision, son motif et ce qu'elle coûte sont dans « Pour aller plus loin ».

## Installation

### Installer `sops` et `age`

Deux outils distincts. `age` fait le chiffrement et les clés, `sops` sait quoi chiffrer dans un fichier structuré et pour qui.

**Windows**, avec scoop, dans cet ordre (`age` n'est **pas** dans le bucket `main`, un `scoop install sops age` groupé échoue silencieusement sur le second nom) :

```powershell
scoop install sops
scoop bucket add extras
scoop install age
```

**macOS** : `brew install sops age`, le groupage fonctionne ici.

**Linux** : `age` est dans les dépôts (`apt install age` sur Debian 12 et Ubuntu 22.04 et suivantes). `sops` ne l'est pas partout ; les deux lignes ci-dessous sont celles que joue la CI, à poser aussi sur la machine sur site (remplacer `amd64` par `arm64` sur ARM) :

```bash
curl -sSfL https://github.com/getsops/sops/releases/download/v3.13.3/sops-v3.13.3.linux.amd64 -o /usr/local/bin/sops
chmod +x /usr/local/bin/sops
```

Vérifier avant d'aller plus loin : `sops --version` et `age --version` doivent répondre toutes les deux.

Versions de référence : `sops` 3.13.3, `age` 1.3.2. Si un fichier chiffré localement n'est plus lisible par le pipeline, l'écart de version est le premier endroit à regarder. `age-keygen`, utilisé juste après, est fourni par le paquet `age`.

### Générer sa clé

Une clé age est une paire. La partie **publique** finit dans `.sops.yaml`, lue par tout le monde : elle ne permet que de chiffrer **pour** vous. La partie **privée** déchiffre et **ne quitte jamais le poste** : ni message, ni dépôt, ni copie temporaire. Personne n'a jamais besoin de votre clé privée, pas même pour vous dépanner.

SOPS cherche la clé à un emplacement fixe, qu'il ne faut donc pas choisir :

| Système | Chemin |
|---|---|
| Linux, macOS | `~/.config/sops/age/keys.txt` |
| Windows | `%AppData%\sops\age\keys.txt`, soit `C:\Users\<vous>\AppData\Roaming\sops\age\keys.txt` |

**C'est le système qui décide, pas le shell.** Sous Windows, `sops` lit `%AppData%` même appelé depuis Git Bash ou WSL avec le binaire Windows. Une clé posée dans `~/.config/sops/age/keys.txt` parce qu'on tape des commandes bash n'y sera **jamais** cherchée : le déchiffrement échoue, et le message d'erreur (plus bas) ne cite pas cet emplacement, donc rien ne pointe vers la cause. C'est le piège le plus coûteux de cette page.

> **Sous WSL, ce n'est pas « grosso modo pareil ».** Même piège, moins visible : WSL hérite du `PATH` de Windows, donc taper `sops` peut lancer le binaire **Windows**, qui cherchera la clé dans `%AppData%`. Diagnostiquer avant de générer quoi que ce soit :
>
> ```bash
> command -v sops
> ```
>
> Un chemin sous `/mnt/c/` ou finissant par `.exe` : binaire Windows, clé dans `%AppData%`. Un chemin sous `/usr/`, `/usr/local/` ou votre répertoire personnel : binaire Linux, clé dans `~/.config`. Choisissez un environnement et restez-y : dans WSL, installez `sops`/`age` **dans** WSL et suivez la colonne Linux jusqu'au bout. Une clé générée dans WSL n'est pas celle générée côté Windows : il n'en faut qu'**une** par personne.

Créer le répertoire, puis générer, **Windows** dans PowerShell :

```powershell
New-Item -ItemType Directory -Force "$env:AppData\sops\age"
age-keygen -o "$env:AppData\sops\age\keys.txt"
```

**Linux, macOS** :

```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
```

`age-keygen` affiche la clé **publique** sur la sortie d'erreur (`Public key: age1...`) : c'est cette ligne, et elle seule, que vous transmettez ; elle reste aussi récupérable en commentaire dans le fichier de clé (`grep "public key" ...` ou `Select-String "public key" ...`).

Sous Windows, `age-keygen` répond en plus :

```
age-keygen: warning: writing secret key to a world-readable file
```

Sans conséquence dans un profil utilisateur normal, sauf poste réellement partagé (le sujet serait alors le poste, pas l'avertissement). Deux confusions à éviter : ce n'est **pas** une clé SSH, et `age-keygen -o` **écrase** le fichier de destination sans prévenir. Ne le rejouez pas par réflexe si vous êtes déjà destinataire, vous perdriez l'accès au fichier chiffré.

### Se faire ajouter comme destinataire

Aujourd'hui `.sops.yaml` porte **sept** destinataires : les postes d'Alex Rovere, d'Antoine Coulon, d'Hugo Mrnth, de Tanguy Raguenes et de Pierrick Anceaux, la CI, et la machine sur site depuis le 17 septembre 2026. L'équipe est donc au complet. Cette section reste utile pour une arrivée dans l'équipe : tant qu'une clé n'est pas dans la liste, `sops decrypt` échoue normalement :

```
Failed to get the data key required to decrypt the SOPS file.

Group 0: FAILED
  age1d9lz...: FAILED
    - | failed to create reader for decrypting sops data key with
      | age: identity did not match any of the recipients: incorrect
      | identity for recipient block. Did not find keys in locations
      | 'SOPS_AGE_SSH_PRIVATE_KEY_FILE', ... 'SOPS_AGE_KEY',
      | 'SOPS_AGE_KEY_FILE', and 'SOPS_AGE_KEY_CMD'.
```

Attention, ce message égare : la liste des emplacements qu'il énumère **ne cite pas** `%AppData%\sops\age\keys.txt` ni `~/.config/sops/age/keys.txt`, pourtant bien lus. Il dit donc la même chose dans deux cas différents, « vous n'êtes pas encore destinataire » et « votre clé n'est pas au bon endroit » : vérifiez d'abord l'emplacement pour votre système.

L'ajout se fait en **deux gestes, dans la même pull request** :

1. ajouter votre clé publique dans la liste `age:` de `.sops.yaml`, commentée à votre nom ;
2. rechiffrer avec `sops updatekeys secrets.enc.yaml`, joué par quelqu'un qui est **déjà** destinataire.

**Pourquoi les deux vont ensemble** : ajouter une ligne à `.sops.yaml` ne touche pas `secrets.enc.yaml`, qui garde ses anciens destinataires tant qu'il n'est pas rechiffré. Le job `secrets` de la CI attrape cette divergence sans aucune clé, en comparant les deux listes que SOPS laisse en clair :

```bash
grep -oE 'age1[0-9a-z]{58}' .sops.yaml       | sort -u > attendus.txt
grep -oE 'age1[0-9a-z]{58}' secrets.enc.yaml | sort -u > effectifs.txt
diff attendus.txt effectifs.txt
```

**Vous ne pouvez pas vous ajouter seul** : le rechiffrement demande une clé privée déjà destinataire. Ouvrez la pull request avec la seule ligne ajoutée, et demandez à un destinataire actuel de jouer `sops updatekeys` sur votre branche. `sops updatekeys -y` passe la confirmation, à réserver à un script : sans `-y`, relisez la liste affichée avant de répondre `y`.

Une clé publique mal recopiée est attrapée tout de suite, une clé age portant sa propre somme de contrôle : `failed to parse input as Bech32-encoded age public key: malformed recipient "age1...": invalid checksum`.

Une fois la pull request fusionnée, `sops decrypt secrets.enc.yaml` depuis `main` à jour confirme l'entrée, sans rien configurer d'autre.

### Activer le hook `pre-push`

Le hook [`.githooks/pre-push`](../.githooks/pre-push) refuse un push qui emporterait un secret, avant qu'il n'atteigne la forge (la CI, elle, ne fait que le constater après coup). Il ne s'installe pas tout seul :

```bash
git config core.hooksPath .githooks
```

Une commande par membre, une fois, locale à ce dépôt (pas `--global`). `git push --no-verify` le contourne volontairement : c'est la porte de secours, et c'est pourquoi la CI reste derrière, sans échappatoire. Détail de ce que le hook vérifie dans « Pour aller plus loin ».

## Utilisation courante

Se placer **à la racine du dépôt** : `sops` remonte jusqu'à `.sops.yaml` depuis le fichier visé, mais sa règle est écrite pour `secrets.enc.yaml` à la racine, et c'est là que les exemples ci-dessous sont joués.

### Lire un secret

```bash
sops decrypt secrets.enc.yaml
```

La sortie est en clair sur le terminal : ne la redirigez pas n'importe où. Les deux seuls noms de fichier temporaire prévus, déjà ignorés par `.gitignore`, sont `secrets.yaml` et `secrets.dec.yaml`.

### Modifier ou ajouter un secret

La forme courte, à connaître pour son défaut avant de s'en servir :

```bash
sops set secrets.enc.yaml '["POSTGRES_PASSWORD"]' '"la-nouvelle-valeur"'
```

Le deuxième argument est un **chemin JSON**, le troisième une **valeur JSON** (d'où les guillemets doubles internes). **Le défaut** : cette ligne écrit le secret en clair hors du dépôt, dans l'historique du shell (`ConsoleHost_history.txt` sous Windows, `~/.bash_history` ailleurs) et dans la liste des processus le temps de l'exécution. Ni gitleaks ni Trivy ne voient ces fichiers, et un secret qui fuit par là se remplace, il ne se récupère pas.

**Pour un vrai secret**, `--value-stdin` lit la valeur sur l'entrée standard, jamais sur la ligne de commande :

```bash
read -rs VALEUR
printf '"%s"' "$VALEUR" | sops set --value-stdin secrets.enc.yaml '["POSTGRES_PASSWORD"]'
unset VALEUR
```

```bash
printf '"%s"' "$(openssl rand -base64 24 | tr -d '\r\n')" | sops set --value-stdin secrets.enc.yaml '["SESSION_SECRET"]'
```

Trois détails, chacun trouvé en jouant ces commandes : l'entrée standard doit être du **JSON**, d'où le `printf '"%s"'` (une valeur nue est refusée par `Value for --set is not valid JSON`) ; `tr -d '\r\n'` et non `'\n'`, parce que sous Git Bash `openssl` termine sa sortie par un retour chariot qui suffit à faire refuser le JSON ; une valeur contenant `"` ou `\` casserait ce `printf` (une valeur aléatoire en base64 n'en contient pas).

**Sous PowerShell**, les deux formes échouent, autrement : `--value-stdin` ne fonctionne pas du tout (PowerShell place un BOM UTF-8 en tête de l'entrée standard, `sops` répond `Value for --set is not valid JSON` quel que soit `$OutputEncoding`) ; la forme courte échoue avec `Invalid set index format` si les guillemets internes ne sont pas protégés par un antislash (le jeton `--%` ne rattrape rien) :

```powershell
sops set secrets.enc.yaml '[\"MOCK_API_URL\"]' '\"https://exemple\"'
```

La forme courte reste légitime pour ce qui n'est pas un secret (URL, identifiant, nom d'hôte) : si la ligne restait lisible des mois dans un historique, est-ce que ça coûterait quelque chose ? Si oui, `--value-stdin`, et écrivez depuis Git Bash plutôt que PowerShell.

**L'éditeur** (`sops secrets.enc.yaml`) échoue le plus souvent sous Windows avant d'avoir rien montré :

```
Could not run editor: no editor available: sops attempts to use the editor
defined in the SOPS_EDITOR or EDITOR environment variables, and if that's
not set defaults to any of vim, nano, vi, but none of them could be found
```

Aucun de ces trois éditeurs n'est dans le `PATH` d'un Windows ordinaire ; `sops set` n'a aucun de ces modes de panne, c'est pourquoi il est préféré ici.

**L'état actuel du fichier**, trois clés :

| Clé | Usage |
|---|---|
| `POSTGRES_PASSWORD` | mot de passe du compte PostgreSQL de la pile |
| `SESSION_SECRET` | secret de session de l'applicatif, celui qui protège le cookie |
| `GRAFANA_PASSWORD` | mot de passe de l'administrateur Grafana |

`ETL_DB_PASSWORD` manque aussi, mais **pas volontairement** : `docker-compose.yml` l'exige par un `:?`, donc `sops exec-env` échouera dessus au premier déploiement tant qu'elle n'est pas posée. Repéré en travaillant #153, à traiter avec #107.

`MOCK_API_URL` **manque volontairement** : l'URL de l'API Mock n'est pas encore connue. Le jour où elle arrive : `sops set secrets.enc.yaml '["MOCK_API_URL"]' '"https://exemple"'`, puis `git add secrets.enc.yaml` et un commit qui dit quelle clé a bougé et pourquoi.

**Injecter au lancement**, sans jamais écrire les valeurs sur le disque :

```bash
sops exec-env secrets.enc.yaml 'docker compose up -d'
```

C'est la commande du déploiement, et elle sert aussi **sur un poste** : les variables qu'elle pose priment sur le `.env`, donc il suffit d'y laisser la section RÉGLAGES de `.env.example` et aucun secret. C'est la façon la plus proche de la machine de lancer la pile chez soi, et elle ne laisse rien en clair sur le disque. Elle s'exécute **sur** la machine sur site, lancée par le runner auto-hébergé, avec la clé de la CI que GitHub lui passe le temps du job. Sous Windows, la commande passée est confiée à `cmd`, pas à un interpréteur POSIX : `sops exec-env secrets.enc.yaml 'echo $POSTGRES_PASSWORD'` affiche la chaîne littérale, pas la valeur, sans que l'environnement soit vide pour autant. Un test de ce genre se fait sous Git Bash ou WSL.

### Ce qui ne va jamais dans ce fichier, et où cela va

`secrets.enc.yaml` porte les secrets **applicatifs**, ce dont la pile a besoin pour tourner. Le principe : le périmètre d'un secret doit être celui de son usage.

**La clé age de la CI** vit dans les secrets du dépôt GitHub (`SOPS_AGE_KEY`), pour une impossibilité pure : la clé qui déchiffre le fichier ne peut pas vivre dans le fichier qu'elle déchiffre.

**Il n'y a pas de clé SSH de déploiement.** Le réseau de l'école n'accepte aucune connexion entrante vers la machine : le pipeline ne s'y connecte pas, c'est un runner auto-hébergé qui appelle GitHub en sortant et exécute le travail sur place. Rien à ouvrir, donc rien à autoriser.

**Les identifiants d'un registre d'images**, le jour où il y en aura un, relèvent de la même logique (GitHub Secrets, pas ce fichier), tout comme **les valeurs de développement de chacun**, pour une autre raison : section suivante.

### Le développement local

Deux situations, et elles ne se mélangent pas.

**Lancer la composition sur son poste** : chacun garde son propre `.env`, ignoré par git, avec **ses** valeurs. `.env.example` liste les variables attendues.

```bash
cp .env.example .env      # renseigner les valeurs
docker compose up -d
```

On ne répand pas les mots de passe de la machine sur cinq postes : chaque copie est une occasion de fuite pour un gain nul, et une valeur locale distincte fait échouer plutôt que réussir une commande qui pointerait par erreur vers la machine.

**Développer** : c'est [`.env.dev`](../.env.dev) qui sert, versionné et en clair, et `pnpm dev:db` suffit à démarrer sans qu'on renseigne quoi que ce soit.

Versionner un fichier de valeurs ne contredit pas ce qui précède, parce qu'il n'y a **aucun secret dedans, par construction** : la base qu'il décrit n'écoute que `127.0.0.1`, ne contient que des comptes de démonstration et des données de test, et rien n'y ouvre quoi que ce soit hors du poste. Le critère n'est pas « est-ce que ça ressemble à un mot de passe », c'est « est-ce que cette chaîne donne accès à quelque chose ». Une valeur qui mériterait d'être chiffrée n'a donc rien à y faire, elle va dans `secrets.enc.yaml`.

Deux conséquences pratiques :

- Les valeurs de `.env.dev` sont **volontairement lisibles et sans hasard** (`enervision-dev-local`, `secret-de-session-local-sans-valeur-de-secret`). Ça dit au lecteur ce qu'elles sont, et ça évite que gitleaks les prenne pour de vraies clés à chaque push et dans le hook `pre-push`.
- `.env.dev` et `.env` n'ont **aucune variable en commun**, et les deux compositions n'ont ni le même port, ni le même nom de projet Docker. C'est ce qui remplace ici le garde-fou de la valeur distincte : une commande qui se trompe de contexte échoue, elle ne réussit pas ailleurs.

Le jour où quelqu'un ajoute une vraie valeur à `.env.dev`, c'est la revue qui l'attrape, et c'est précisément ce qu'un `.env` invisible sur cinq postes ne permet pas.

## Pour aller plus loin

### Les amorçages faits une fois

**La clé de la CI** ne suit pas la procédure ordinaire, parce qu'elle n'appartient à personne : écrite ici pour être **refaisable**, pas pour être rejouée. Elle a dû être générée sur un poste, puisque GitHub Actions ne garde pas de secret d'un job à l'autre sans qu'on le lui donne : partie privée collée dans `SOPS_AGE_KEY`, partie publique ajoutée à `.sops.yaml`, fichier temporaire du poste effacé. Exception assumée et bornée à cet usage, une rotation ne coûtant qu'un `updatekeys`. `SOPS_AGE_KEY` porte le **contenu** de la clé, `SOPS_AGE_KEY_FILE` un **chemin** ; la CI utilise le premier, et les postes n'ont besoin ni de l'un ni de l'autre, `sops` lisant `~/.config/sops/age/keys.txt` par défaut.

**Il y a une clé de machine depuis le 17 septembre 2026**, et c'est un renversement de la décision du 16, qui disait exactement l'inverse. Le motif du renversement : le runner auto-hébergé ne tient pas ses promesses, le déploiement se fait donc à la main depuis la VM, et la seule alternative écrite était qu'un membre déchiffre sur son poste puis recopie les valeurs dans un `.env` temporaire sur la machine. Entre une clé assumée et des secrets recopiés à la main dans un fichier qu'on espère supprimer, la clé est le moindre mal.

Ce que ça coûte, et qui n'a pas disparu : le compte `apprenant` est partagé par les cinq, donc cette clé privée est lisible par tout le monde sur la VM, et elle ouvre aussi **les versions passées** du fichier chiffré, que git conserve. Deux conséquences à tenir : la clé est générée **sur** la VM et n'en sort jamais, et le jour où le déploiement automatisé fonctionne, la retirer ne suffit pas, il faut **changer les valeurs** (voir « Rotation et révocation » plus bas).

### Rotation et révocation

**Retirer un destinataire** : supprimer sa ligne de `.sops.yaml`, `sops updatekeys`, commiter les deux fichiers, puis **redéployer**. Tant que la pile tourne avec les valeurs du dernier lancement, rien n'a changé pour elle.

**La chose désagréable** : retirer une clé n'efface pas ce qui a déjà été lu. Git conserve les anciennes versions chiffrées, déchiffrables par les clés de l'époque. D'où deux réponses différentes :

- **Départ prévu d'un membre** : retirer la clé suffit, on remet la liste en accord avec l'équipe réelle.
- **Incident réel** (clé fuitée, poste perdu, valeur affichée) : le vrai travail est de **changer les valeurs** (nouveau mot de passe Postgres, nouveau secret de session qui déconnecte tout le monde volontairement, nouveau mot de passe Grafana, chacun via `--value-stdin`), redéployer, et **ensuite** retirer la clé. La révocation est le geste d'hygiène, pas la réponse à l'incident.

Pas de rotation de routine au MVP, la pile ne vivant que le temps de la piscine ; une exploitation réelle poserait une échéance et un responsable.

### Limites connues

**Une coupure ne demande pas de clé, un `docker compose up` complet si.** Les conteneurs redémarrent seuls avec l'environnement que Docker a gardé à leur création, et `docker restart`, `docker logs` ou `docker inspect` n'en ont pas besoin non plus. Recréer la pile entière demande en revanche les valeurs déchiffrées, donc la clé de la machine, désormais présente sur place.

**Les ports de la supervision sont ouverts trop largement** : `docker-compose.yml` publie Prometheus sur `9090:9090` et Grafana sur `3001:3000` sur toutes les interfaces, contrairement à `postgres` lié à la boucle locale ; `GRAFANA_PASSWORD` garde donc une interface d'administration joignable depuis le réseau. Le rayon est borné au réseau de l'école, aucune entité extérieure ne pouvant joindre la machine : c'est un défaut, pas une exposition publique. Corriger `docker-compose.yml` relève de #47, signalé ici pour ne pas laisser croire le contraire.

**Le moteur Docker garde les variables d'environnement en clair**, quelle que soit la méthode d'injection : `/var/lib/docker/containers/<id>/config.v2.json`, lisible par `root`, et `docker inspect` les rend aussi. Le chiffrement au repos protège le dépôt, pas la mémoire de l'hôte. S'en affranchir demanderait de monter les secrets en fichiers (variantes `_FILE` des images officielles), ce qui changerait le contrat de [`api.md`](./api.md) pour ne déplacer la frontière que d'un cran : écarté au MVP, écrit ici comme évolution.

**Le fichier chiffré révèle sa structure** : SOPS ne chiffre que les valeurs, noms de clés et destinataires se lisent sans rien déchiffrer. Voulu, c'est ce qui permet au job `secrets` de vérifier sans détenir de clé ; en conséquence, aucune information sensible dans un **nom** de clé. Et l'historique garde les versions passées : une valeur compromise se change, elle ne se rattrape pas.

### Les garde-fous de la CI, et leur sortie de secours

Dans [`security.yml`](../.github/workflows/security.yml), sur chaque pull request vers `main` et chaque push, quelle que soit la branche (le reste du pipeline, dans [`ci.yml`](../.github/workflows/ci.yml), reste lié aux pull requests, pour le coût sur une offre gratuite plafonnée).

| Contrôle | Ce qu'il refuse |
|---|---|
| Job `secrets`, destinataires | Une divergence entre `.sops.yaml` et `secrets.enc.yaml`, un `sops updatekeys` oublié |
| Job `secrets`, déchiffrement | Un fichier que la clé de la CI ne peut plus ouvrir |
| Job `security`, Trivy et gitleaks | Un secret en clair dans l'arbre de travail (Trivy) ou **n'importe où dans l'historique** (gitleaks, fusions comprises). Bloquant |

Le dernier surprend : un secret commité puis retiré au commit suivant fait quand même échouer le pipeline, l'historique le contenant toujours ; le rattrapage est alors une réécriture d'historique, pas un commit de plus. D'où `.env`, `secrets.yaml`, `secrets.dec.yaml`, `*.key` et `keys.txt` ignorés par [`.gitignore`](../.gitignore), et un `git status` avant chaque commit plutôt qu'un `git add .` confiant.

**Sortie de secours d'un faux positif** (gitleaks se trompe déjà : une clé publique age classée `generic-api-key`, vérifié sur ce projet) : un commentaire `gitleaks:allow` sur la ligne (préféré pour une valeur documentée à l'avance), ou une entrée dans `.gitleaksignore` à la racine (à créer le jour du premier cas, format `<commit>:<chemin>:<règle>:<ligne>` tel que gitleaks le rend). Légitime pour un faux positif vérifié un par un, jamais pour faire taire un vrai secret : la différence se voit en revue, pas dans la syntaxe.

**Sortie de secours du déploiement** : depuis que la machine est destinataire, elle se recrée sur place, `sops exec-env secrets.enc.yaml 'docker compose up -d'`, sans dépendre de GitHub ni recopier une valeur à la main. C'est aussi ce qui a motivé la clé. Un `workflow_dispatch` sur le workflow de déploiement reste le chemin propre quand le runner répond, sans pousser de commit et en laissant une trace.

### Le détail du hook `pre-push`

Deux contrôles indépendants, qui n'attrapent pas la même chose :

**1. Un scan gitleaks** sur les commits qui partent (ou tout l'historique local au premier push d'une branche), pour des motifs connus (préfixes de jetons, formes de clés). Même moteur que la CI, plus rapide car limité à ce qui n'est pas encore poussé.

**2. Un contrôle déterministe sur `secrets.enc.yaml`** : gitleaks cherche des motifs, pas l'absence de chiffrement, et une valeur déchiffrée en place (`sops decrypt --in-place`, une redirection malheureuse) peut n'en porter aucun. **Vérifié sur ce projet** : une copie du fichier avec des valeurs courtes et peu aléatoires n'a déclenché **aucune** détection gitleaks, quand des valeurs aléatoires de forme réaliste, elles, ont été attrapées par sa règle générique : les deux contrôles ne se recouvrent donc pas. Il vérifie, sans rien déchiffrer, que le fichier porte son bloc `sops:`, que chaque valeur porte le marqueur `ENC[AES256_GCM`, et que leur nombre correspond au nombre de clés (pour attraper une seule valeur déchiffrée à côté des autres).

Ce qu'il n'attrape pas : un secret en clair ailleurs (rôle du scan gitleaks), ou une valeur chiffrée mais fausse ou périmée (rôle du job `secrets` de la CI). Un contrôle de **forme**, pas de contenu.

**Un fichier, un sujet** : ce hook ne fait que le scan de secrets, le lint étant laissé à un `pre-commit` distinct posé par un autre ticket. Mélanger un contrôle de confort à un contrôle de sécurité finit par faire désactiver les deux ensemble le jour où le premier gêne.
