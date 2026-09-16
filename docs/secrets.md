# Les secrets du projet

Ce document sert à une chose : permettre à n'importe quel membre de l'équipe de chiffrer et de déchiffrer les secrets du projet **sans demander d'aide**. C'est un critère du ticket #52, et son motif tient en une phrase : un mécanisme de secrets qui ne fonctionne que sur le poste de celui qui l'a posé ne protège rien, il déplace le problème sur une personne. C'était déjà l'objet de l'issue #99, fermée en doublon.

Le mécanisme, en une ligne : les valeurs sensibles de la pile vivent chiffrées dans [`secrets.enc.yaml`](../secrets.enc.yaml), à la racine du dépôt, avec **SOPS** et **age**. Le fichier [`.sops.yaml`](../.sops.yaml) dit en clair **qui** peut les déchiffrer.

## Ce que ce mécanisme protège, et ce qu'il ne protège pas

Il rend un **accès en lecture au dépôt sans valeur**. Un clone, une capture d'écran d'un fichier, un dépôt passé public par erreur, une sauvegarde de poste qui traîne : dans tous ces cas, ce qui est lu est un bloc chiffré. C'est la seule promesse, et elle est tenue.

Il ne protège **pas la machine sur site**. Celle-ci détient forcément de quoi déchiffrer, sinon elle ne pourrait pas redémarrer seule après une coupure de courant. Ce qui la protège est ailleurs, et c'est écrit dans [`../infra/ansible/README.md`](../infra/ansible/README.md) : accès SSH par clé, aucun port de service publié sur l'hôte hormis le 443 du reverse proxy, et le fichier de clé en `0400` appartenant au seul compte de service.

Confondre ces deux frontières mène à chercher un mécanisme qui n'existe pas. « Comment empêcher la machine de lire les secrets qu'elle doit utiliser » n'a pas de réponse : un service qui démarre sans intervention humaine a besoin de ses identifiants, point. La question utile n'est pas celle-là, c'est « qui peut entrer sur la machine ».

## Installer `sops` et `age`

Deux outils distincts. `age` fait le chiffrement et les clés, `sops` sait quoi chiffrer dans un fichier structuré et pour qui.

**Windows**, avec scoop :

```powershell
scoop install sops
scoop bucket add extras
scoop install age
```

Les trois commandes, dans cet ordre. `age` n'est **pas** dans le bucket `main`, il est dans `extras` : une installation groupée `scoop install sops age` échoue sur le second nom, et laisse un poste avec `sops` installé et `age` absent, ce qui se découvre trois commandes plus loin par un message qui ne dit pas cela.

**macOS** : `brew install sops age`, le groupage fonctionne ici.

**Linux** : `age` est dans les dépôts (`apt install age` sur Debian 12 et Ubuntu 22.04 et suivantes). `sops` ne l'est pas partout : le plus sûr est le binaire des releases, comme le fait la CI dans [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml).

Vérifier avant d'aller plus loin, les deux commandes doivent répondre :

```bash
sops --version
age --version
```

Les versions de référence du projet sont `sops` 3.13.3 et `age` 1.3.2. La CI installe explicitement `sops` 3.13.3 : si un jour un fichier chiffré localement n'est plus lisible par le pipeline, l'écart de version est le premier endroit à regarder. `sops --version` accompagne sa réponse d'un avertissement sur la vérification automatique des mises à jour : c'est un message de dépréciation de l'outil, pas un problème de configuration.

`age-keygen`, utilisé juste après, est fourni par le paquet `age`.

## Générer sa clé

Une clé age est une paire. La partie **publique** finit dans `.sops.yaml`, lue par tout le monde, et ce n'est pas un secret : elle ne permet que de chiffrer **pour** vous. La partie **privée** est ce qui déchiffre, et elle **ne quitte jamais le poste** : ni message, ni courriel, ni dépôt, ni copie temporaire sur la machine. Il n'y a aucune situation légitime où quelqu'un a besoin de votre clé privée, pas même pour vous dépanner.

SOPS cherche la clé à un emplacement fixe, qu'il ne faut donc pas choisir :

| Système | Chemin |
|---|---|
| Linux, macOS | `~/.config/sops/age/keys.txt` |
| Windows | `%AppData%\sops\age\keys.txt`, soit `C:\Users\<vous>\AppData\Roaming\sops\age\keys.txt` |

**C'est le système qui décide, pas le shell.** Sous Windows, `sops` lit `%AppData%` même quand vous l'appelez depuis Git Bash ou depuis WSL avec le binaire Windows. Une clé posée dans `~/.config/sops/age/keys.txt` parce qu'on tape des commandes bash n'y sera **jamais** cherchée : le déchiffrement échoue, et le message d'erreur (voir plus bas) ne cite pas cet emplacement, donc rien ne pointe vers la cause. C'est le piège le plus coûteux de cette page.

Créer le répertoire, puis générer.

**Windows**, dans PowerShell :

```powershell
New-Item -ItemType Directory -Force "$env:AppData\sops\age"
age-keygen -o "$env:AppData\sops\age\keys.txt"
```

**Linux, macOS** :

```bash
mkdir -p ~/.config/sops/age
age-keygen -o ~/.config/sops/age/keys.txt
```

`age-keygen` affiche la clé **publique** sur la sortie d'erreur, sous la forme `Public key: age1...`. C'est cette ligne, et elle seule, que vous transmettez. Elle est aussi recopiée en commentaire dans le fichier, donc récupérable plus tard sans régénérer quoi que ce soit :

```bash
grep "public key" ~/.config/sops/age/keys.txt
```

```powershell
Select-String "public key" "$env:AppData\sops\age\keys.txt"
```

Sous Windows, `age-keygen` répond en plus :

```
age-keygen: warning: writing secret key to a world-readable file
```

Il ne ment pas et il ne sait pas mieux : `age` lit des droits de type Unix, que Windows n'expose pas de la même façon, et se rabat sur l'avertissement le plus prudent. Sans conséquence ici parce que le fichier est dans votre profil utilisateur, dont les autres comptes locaux n'ont pas la lecture par défaut. Cela cesserait d'être vrai sur un poste réellement partagé entre plusieurs comptes : dans ce cas, le sujet n'est pas l'avertissement, c'est le poste.

Deux confusions à éviter. Ce n'est **pas** une clé SSH, elle ne sert pas à se connecter à la machine. Et `age-keygen -o` **écrase** le fichier de destination s'il existe : ne le rejouez pas par réflexe si vous êtes déjà destinataire, vous perdriez l'accès au fichier chiffré.

## Se faire ajouter comme destinataire

**C'est le passage qui compte.** Aujourd'hui `.sops.yaml` ne porte que **deux** destinataires : le poste d'Alex Rovere et la CI. Les quatre autres membres et la machine sur site n'y sont pas encore. Tant que votre clé n'est pas dans la liste, `sops decrypt` échoue, et c'est le comportement normal, pas une panne :

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

Une mise en garde sur ce message, parce qu'il égare : la liste des emplacements qu'il énumère **ne cite pas** `%AppData%\sops\age\keys.txt` ni `~/.config/sops/age/keys.txt`, qui sont pourtant bien lus. Ce message dit donc la même chose dans deux cas très différents, « vous n'êtes pas encore destinataire » et « votre clé n'est pas là où SOPS la cherche ». Avant de demander un ajout, vérifiez que votre fichier de clé est au bon endroit pour votre **système**.

L'ajout se fait en **deux gestes, dans la même pull request** :

1. ajouter votre clé publique dans la liste `age:` de `.sops.yaml`, commentée à votre nom ;
2. rechiffrer le fichier existant pour la nouvelle liste, avec `sops updatekeys secrets.enc.yaml`, joué par quelqu'un qui est **déjà** destinataire.

**Pourquoi les deux vont ensemble.** Ajouter une ligne à `.sops.yaml` ne touche pas `secrets.enc.yaml` : la règle ne vaut que pour les chiffrements à venir. Le fichier existant garde donc ses anciens destinataires, votre clé est déclarée mais ne déchiffre rien, et la liste et le fichier divergent. Le job `secrets` de la CI existe précisément pour attraper cela, et il le fait sans aucune clé, en comparant les deux listes que SOPS laisse en clair :

```bash
grep -oE 'age1[0-9a-z]{58}' .sops.yaml       | sort -u > attendus.txt
grep -oE 'age1[0-9a-z]{58}' secrets.enc.yaml | sort -u > effectifs.txt
diff attendus.txt effectifs.txt
```

Ce refus est le service rendu. Sans lui, la divergence ne se verrait qu'au déploiement, sur site, au pire moment.

**Vous ne pouvez pas vous ajouter seul**, et c'est voulu : le rechiffrement demande une clé privée déjà destinataire. En pratique, ouvrez la pull request avec la seule ligne ajoutée à `.sops.yaml`, et demandez à un destinataire actuel de jouer `sops updatekeys secrets.enc.yaml` sur votre branche et de pousser le fichier rechiffré dans la même PR.

`sops updatekeys` affiche les destinataires ajoutés et retirés, puis demande confirmation :

```
The following changes will be made to the file's groups:
Group 1
    age1...
+++ age1...
Is this okay? (y/n):
```

Lisez cette liste avant de répondre `y` : c'est le dernier moment où un ajout involontaire se voit facilement. `sops updatekeys -y` passe la question, à réserver à un script.

Une clé publique mal recopiée, elle, est attrapée plus tôt et sans ambiguïté, une clé age portant sa propre somme de contrôle : `failed to parse input as Bech32-encoded age public key: malformed recipient "age1...": invalid checksum`. Recopiez la ligne entière rendue par `age-keygen`, sans espace ajouté.

Une fois la pull request fusionnée, vérifiez depuis `main` à jour :

```bash
sops decrypt secrets.enc.yaml
```

Si les valeurs s'affichent, vous êtes entré. Rien d'autre à configurer : aucune variable d'environnement n'est nécessaire, SOPS trouve la clé à l'emplacement fixe décrit plus haut.

## Lire, modifier, ajouter un secret

Le plus simple est de se placer **à la racine du dépôt** : `sops` retrouve `.sops.yaml` en remontant depuis le fichier visé, donc un chemin relatif depuis un sous-répertoire fonctionne aussi, mais la règle de `.sops.yaml` est écrite pour le nom `secrets.enc.yaml` à la racine et c'est là que les exemples ci-dessous sont joués.

**Lire**, sans rien modifier :

```bash
sops decrypt secrets.enc.yaml
```

La sortie est en clair sur le terminal. Ne la redirigez pas n'importe où : si vous avez besoin d'un fichier temporaire, les deux seuls noms prévus, et déjà ignorés par `.gitignore`, sont `secrets.yaml` et `secrets.dec.yaml`.

**Modifier une valeur, ou en ajouter une**, sans ouvrir d'éditeur :

```bash
sops set secrets.enc.yaml '["POSTGRES_PASSWORD"]' '"la-nouvelle-valeur"'
```

Les guillemets ne sont pas décoratifs : le deuxième argument est un **chemin JSON** vers la clé, le troisième une **valeur JSON**, d'où les guillemets doubles à l'intérieur des simples pour une chaîne.

**Sous PowerShell, cette commande échoue.** PowerShell retire les guillemets doubles internes avant de passer les arguments, et `sops` répond `Invalid set index format` sans rien changer au fichier. Il faut les protéger par un antislash :

```powershell
sops set secrets.enc.yaml '[\"POSTGRES_PASSWORD\"]' '\"la-nouvelle-valeur\"'
```

Le jeton d'arrêt d'analyse `--%` ne rattrape pas le problème : il échoue de la même façon. Au moindre doute sur les guillemets, jouez ces commandes depuis Git Bash, où la forme simple fonctionne telle quelle.

`sops set` écrit le fichier rechiffré directement, pour les seuls destinataires déclarés. C'est la voie recommandée sur ce projet : scriptable, et sans éditeur.

**L'éditeur, et sa mise en garde.** `sops secrets.enc.yaml` ouvre le contenu déchiffré dans un éditeur et rechiffre à la fermeture. Sous Windows, la commande échoue le plus souvent avant d'avoir rien montré :

```
Could not run editor: no editor available: sops attempts to use the editor
defined in the SOPS_EDITOR or EDITOR environment variables, and if that's
not set defaults to any of vim, nano, vi, but none of them could be found
```

Aucun de ces trois éditeurs n'est dans le `PATH` d'un Windows ordinaire. Si vous tenez au mode édition, posez `SOPS_EDITOR` (ou `EDITOR`) explicitement, et gardez en tête que SOPS attend la **fermeture** de l'éditeur pour rechiffrer : un éditeur qui rend la main aussitôt lancé lui fait conclure à une édition vide. `sops set` n'a aucun de ces deux modes de panne, c'est pourquoi il est préféré ici.

**L'état actuel du fichier.** `secrets.enc.yaml` porte **trois** clés :

| Clé | Usage |
|---|---|
| `POSTGRES_PASSWORD` | mot de passe du compte PostgreSQL de la pile |
| `SESSION_SECRET` | secret de session de l'applicatif, celui qui protège le cookie |
| `GRAFANA_PASSWORD` | mot de passe de l'administrateur Grafana |

`MOCK_API_URL` **manque**, et ce n'est pas un oubli : l'URL de l'API Mock est fournie par le formateur et n'est pas connue au moment où ce document est écrit. `.env.example` la liste déjà comme variable attendue. Le jour où elle arrive, une seule commande, avec la vraie URL à la place de l'exemple :

```bash
sops set secrets.enc.yaml '["MOCK_API_URL"]' '"https://exemple"'
```

Puis `git add secrets.enc.yaml` et un commit : **c'est le fichier chiffré qui se commite**, et lui seul. Une modification de secret se relit en pull request comme le reste, même si le diff ne montre que du chiffré ; ce qui se relit alors, c'est **quelle** clé a bougé et **pourquoi**, ce que le message de commit doit dire.

**Injecter au lancement**, sans jamais écrire les valeurs sur le disque :

```bash
sops exec-env secrets.enc.yaml 'docker compose up -d'
```

SOPS déchiffre en mémoire, peuple l'environnement du processus enfant, et aucun fichier en clair n'existe à aucun moment. C'est le chemin prévu pour la machine sur site. Sous Windows, la commande passée est confiée à `cmd` et non à un interpréteur POSIX : `sops exec-env secrets.enc.yaml 'echo $POSTGRES_PASSWORD'` affichera donc la chaîne littérale et non la valeur, sans que cela signifie que l'environnement est vide. Un test de ce genre se fait sous Git Bash ou WSL.

## Ce qui ne va jamais dans ce fichier, et où cela va

`secrets.enc.yaml` porte les secrets **applicatifs** : ce dont la pile a besoin pour tourner. Deux familles n'y ont pas leur place, et la raison est la même dans les deux cas, **le périmètre d'un secret doit être celui de son usage**.

**La clé SSH de déploiement et la clé age de la CI** vivent dans les secrets du dépôt GitHub, sous les noms `DEPLOY_SSH_KEY` et `SOPS_AGE_KEY`. La clé qui ouvre la machine ne doit pas s'ouvrir avec les clés des membres : la mettre dans `secrets.enc.yaml`, ce serait donner à cinq postes un accès à l'hôte, et transformer la perte d'un seul portable en compromission de la machine. La partie **publique** de la paire de déploiement, elle, est versionnée dans [`../infra/ansible/files/deploy_key.pub`](../infra/ansible/files/deploy_key.pub), pour qu'Ansible autorise le compte de service depuis Git plutôt que par un `ssh-copy-id` fait une fois et oublié.

Pour `SOPS_AGE_KEY` s'ajoute une impossibilité pure : la clé qui déchiffre le fichier ne peut pas vivre dans le fichier qu'elle déchiffre.

**Les identifiants d'un registre d'images**, le jour où il y en aura un, relèvent de la même logique : ils servent au pipeline, pas à l'application. GitHub Secrets.

**Les valeurs de développement de chacun** n'y vont pas non plus, pour une autre raison : section suivante.

## Le développement local

Chacun garde son propre `.env`, ignoré par git, avec **ses** valeurs. `.env.example` liste les variables attendues, et le démarrage décrit dans le [`README.md`](../README.md) ne demande rien de plus :

```bash
cp .env.example .env      # renseigner les valeurs
docker compose up -d
```

On ne répand pas les mots de passe de la machine sur cinq postes pour faire tourner un PostgreSQL de développement qui ne contient que des données de test. Le mot de passe de la base de production n'a aucune raison d'exister sur un portable, et chaque copie supplémentaire est une occasion de fuite de plus pour un gain nul.

Une valeur locale distincte a même un effet secondaire utile : le jour où une commande pointe par erreur vers la machine, elle échoue au lieu de réussir.

## Les deux amorçages, faits une fois

Deux clés ne suivent pas la procédure ordinaire, parce qu'elles n'appartiennent à personne. Elles sont écrites ici pour être **refaisables** si quelqu'un doit y revenir, pas pour être rejouées.

**La clé de la machine sur site.** Elle est générée **sur la machine**, jamais ailleurs, et sa partie privée n'en sort jamais : fichier `/etc/enervision/age.key`, en `0400`, propriété du compte de service `enervision`. Seule la partie publique remonte, par pull request dans `.sops.yaml`, suivie du `sops updatekeys` habituel. Cela reste à faire : la machine ouvre au J2, et l'exigence est portée par #47.

Générer cette clé sur un poste puis la copier serait plus simple, et la ferait transiter par un presse-papiers, un terminal et probablement une messagerie. La copie qui reste quelque part est celle qu'on oublie.

**La clé de la CI.** GitHub Actions ne peut pas générer une clé et en garder la partie privée d'un job à l'autre : il faut la lui donner. Elle a donc été générée sur un poste, sa partie privée collée dans le secret `SOPS_AGE_KEY` du dépôt, sa partie publique ajoutée à `.sops.yaml` sous « CI GitHub Actions », et le fichier temporaire du poste effacé. C'est l'exception assumée à la règle « la clé privée ne bouge pas », et elle est bornée : cette clé ne sert qu'à la CI, et sa rotation ne coûte qu'un `updatekeys`.

Au passage, deux variables font le même travail : `SOPS_AGE_KEY` porte le **contenu** de la clé, `SOPS_AGE_KEY_FILE` un **chemin**. La CI utilise la première, n'ayant pas de fichier à pointer ; la machine utilisera la seconde.

## Rotation et révocation

**Retirer un destinataire** : supprimer sa ligne de `.sops.yaml`, jouer `sops updatekeys secrets.enc.yaml`, commiter les deux fichiers, puis **redéployer**. Le redéploiement n'est pas une formalité : tant que la pile tourne avec les valeurs injectées au dernier lancement, rien n'a changé pour elle.

**Et maintenant la chose désagréable.** Retirer une clé n'efface pas ce qui a déjà été lu. Quelqu'un qui a déchiffré le fichier une fois connaît les valeurs ; après révocation il ne lira pas les versions futures, mais il connaît toujours la version en cours. Git conserve d'ailleurs les anciennes versions chiffrées, qui restent déchiffrables par les clés de l'époque.

D'où deux cas qui n'appellent pas la même réponse :

- **Départ prévu d'un membre.** Retirer la clé suffit. On ne se protège pas d'un collègue, on remet la liste en accord avec l'équipe réelle.
- **Incident réel** : clé privée fuitée, poste perdu, valeur affichée dans un journal ou une capture. Là, le vrai travail est de **changer les valeurs elles-mêmes**. Nouveau mot de passe PostgreSQL, nouveau secret de session (ce qui déconnecte tout le monde, et c'est l'effet recherché), nouveau mot de passe Grafana, un `sops set` par valeur, commit, redéploiement, et **ensuite** le retrait de la clé. La révocation est le geste d'hygiène, pas la réponse à l'incident.

**Rotation de routine** : il n'y en a pas au MVP, la pile ne vivant que le temps de la piscine. C'est écrit pour que cela ne passe pas pour une décision implicite : une exploitation réelle poserait une échéance et un responsable.

## Limites connues

**Le moteur Docker garde les variables d'environnement en clair.** Quelle que soit la méthode d'injection, `sops exec-env`, `--env-file` ou un bloc `environment:`, le moteur écrit la configuration du conteneur dans son état interne, sous `/var/lib/docker/containers/<id>/config.v2.json`, lisible par `root` ; `docker inspect` les rend également. Le chiffrement au repos protège le dépôt, pas la mémoire de l'hôte, et c'est pourquoi la phrase « jamais en clair sur la machine » serait fausse si on l'écrivait.

S'en affranchir demanderait de monter les secrets en **fichiers** et d'utiliser les variantes `_FILE` des images officielles (`POSTGRES_PASSWORD_FILE` et consorts). Cela change le contrat de variables figé dans [`api.md`](./api.md), ajoute un montage par secret, et ne déplace la frontière que d'un cran : qui est `root` sur la machine lit les fichiers montés aussi bien que la configuration du moteur. Écarté au MVP, écrit ici comme **évolution**, pas caché.

**Le fichier chiffré révèle sa structure.** SOPS ne chiffre que les **valeurs** : les noms de clés et la liste des destinataires se lisent sans rien déchiffrer. C'est voulu, c'est ce qui permet au job `secrets` de vérifier les destinataires sans détenir de clé. Conséquence pratique : ne mettez jamais d'information sensible dans un **nom** de clé.

**L'historique garde les versions passées.** Voir la section précédente : une valeur compromise se change, elle ne se rattrape pas.

## Les trois garde-fous de la CI

Ils sont dans [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) et tournent sur chaque pull request. Les connaître évite de les prendre pour des pannes.

| Contrôle | Ce qu'il refuse |
|---|---|
| Job `secrets`, destinataires | Une divergence entre la liste de `.sops.yaml` et celle de `secrets.enc.yaml`, c'est-à-dire un `sops updatekeys` oublié |
| Job `secrets`, déchiffrement | Un fichier que la clé de la CI ne peut plus ouvrir, donc un déploiement qui échouerait sur site |
| Job `security`, Trivy et gitleaks | Un secret en clair dans l'arbre de travail (Trivy) ou **n'importe où dans l'historique** (gitleaks, fusions comprises). Bloquant |

Le dernier mérite une précision, parce qu'il surprend : un secret commité puis retiré au commit suivant fait quand même échouer le pipeline, l'historique le contenant toujours. Le rattrapage n'est alors pas un commit de plus, c'est une réécriture d'historique, coûteuse et partagée. Autant ne pas avoir à le faire : `.env`, `secrets.yaml`, `secrets.dec.yaml`, `*.key` et `keys.txt` sont ignorés par [`.gitignore`](../.gitignore) pour cette raison, et un `git status` avant chaque commit vaut mieux qu'un `git add .` confiant.
