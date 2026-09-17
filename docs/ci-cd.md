# Le pipeline

Deux workflows GitHub Actions gardent la branche principale. Ce document dit ce qu'ils font, dans quel ordre, ce que chaque étape bloque, et **ce qu'ils ne font pas**, parce qu'une chaîne verte dont personne ne connaît les angles morts rassure sans protéger.

Il couvre le pipeline entier, y compris ce qui n'est pas encore en place : chaque partie à venir porte le numéro de l'issue qui la pose et son état. Un lecteur qui n'a pas écrit ces fichiers doit pouvoir rejouer une étape sur son poste et diagnostiquer un échec sans demander d'aide.

## Les deux workflows

| Fichier | Nom affiché | Déclencheur | Ce qu'il vérifie |
|---|---|---|---|
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | CI | pull request vers `main`, et push sur `main` | Lint, types, tests, validation de la composition, construction **et scan** des images |
| [`.github/workflows/security.yml`](../.github/workflows/security.yml) | Sécurité | **tout** push, sur n'importe quelle branche | Vulnérabilités, secrets dans l'arbre et dans l'historique, cohérence du chiffrement SOPS |

La séparation n'est pas cosmétique. Un secret poussé par erreur ne doit pas attendre l'ouverture d'une pull request pour être détecté : le workflow `Sécurité` tourne donc dès le premier push de la branche. Le reste coûte des minutes de runner et reste attaché aux pull requests.

`Sécurité` n'a **pas** de déclencheur `pull_request`, et c'est délibéré. Les checks s'attachent au commit, pas à l'événement qui les a lancés : un run déclenché par push apparaît déjà sur la pull request. Ajouter `pull_request` produirait deux runs sur le même commit, dont le bloc `concurrency` annulerait l'un ; le check annulé resterait affiché en échec sur la pull request, indéfiniment.

## Le filtrage par chemin

Le premier job de `ci.yml`, `changes`, compare les fichiers modifiés à quatre ensembles avec [`dorny/paths-filter`](https://github.com/dorny/paths-filter). Les autres jobs s'y conditionnent : un correctif sur l'applicatif ne relance ni l'ETL ni le service ML.

| Domaine | Chemins écoutés | Jobs déclenchés |
|---|---|---|
| `etl` | `apps/etl/**` | `etl`, `image-etl` |
| `ml` | `apps/ml/**` | `ml`, `image-ml` |
| `dashboard` | `apps/dashboard/**` | `dashboard`, `image-dashboard` |
| `infra` | `infra/**`, `docker-compose.yml` | `infra` |

Les quatre écoutent en plus `.github/workflows/ci.yml` lui-même : une modification du pipeline rejoue tout. Sans cette ligne, une pull request qui ne touche que la CI ne déclencherait aucun job et ne prouverait donc rien, ce qui est exactement le moment où l'on aimerait une preuve.

Le job `changes` interroge l'API des fichiers modifiés, d'où `pull-requests: read` dans le bloc `permissions`. Sans cette permission il échoue en « Resource not accessible by integration », et comme il conditionne tous les autres, c'est le pipeline entier qui ne tourne pas.

## Les étapes, dans l'ordre, et ce que chacune bloque

L'enchaînement est **par domaine** : lint, puis tests, puis construction de l'image. Chaque étape échoue le job, et un job en échec bloque la fusion.

| Ordre | Étape | Où | Ce qu'elle bloque | État |
|---|---|---|---|---|
| 1 | Lint | `eslint` (dashboard), `ruff` (ETL, ML) | Une violation de règle | En place. **Non bloquant sur l'ETL** le temps de #140 |
| 1 bis | Formatage | `ruff format --check` | Un fichier Python non formaté | En place pour le Python. Différé côté TypeScript |
| 2 | Types | `dashboard` : `vue-tsc` | Une erreur de typage | En place |
| 3 | Tests | `dashboard` : `vitest` | Un test rouge | En place pour l'applicatif, #51 pour le reste |
| 4 | Composition | `infra` : `docker compose config` | Un `docker-compose.yml` invalide | En place |
| 5 | Images | `image-*` : `docker build`, puis Trivy | Un Dockerfile cassé, une vulnérabilité **critique** dans l'image | En place |
| 6 | Scan du code | `security.yml` : Trivy, gitleaks, SOPS | Une vulnérabilité critique **ou élevée**, un secret, un destinataire oublié | En place, hors chaîne (voir plus bas) |
| 7 | Déploiement | à venir | Ne s'exécute que si tout ce qui précède est vert | #107 |

L'ordre du ticket #50 plaçait la construction des images avant les tests. Elle vient après, ici : les tests ne tournent pas dans l'image, donc la construire avant de savoir si le lint passe achète des minutes de runner contre rien. L'enchaînement, lui, est bien celui demandé.

`nuxt.config.ts` pose `typeCheck: false`, donc ni `nuxt build` ni `eslint` ne regardent les types. L'étape 2 est la seule à le faire ; la retirer ferait une CI qui couvre moins qu'elle n'en a l'air.

Les tests de l'applicatif démarrent eux-mêmes un conteneur `postgres:16-alpine` par Testcontainers. Le démon Docker du runner suffit, aucun service n'est déclaré dans le workflow.

## Les linters et le rapport qualité

Un jeu de règles par langage, versionné, et le pipeline échoue sur une violation.

| Langage | Outil | Configuration | Bloquant |
|---|---|---|---|
| Python | `ruff` 0.16.8 | [`ruff.toml`](../ruff.toml), à la racine, commun aux deux applications | Oui pour `apps/ml`, **non pour `apps/etl`** |
| TypeScript, Vue | `eslint` via `@nuxt/eslint` | [`apps/dashboard/eslint.config.ts`](../apps/dashboard/eslint.config.ts) | Oui |

La version de `ruff` est épinglée dans le workflow. Son jeu de règles par défaut change d'une version à l'autre : une CI qui devient rouge parce qu'un outil s'est mis à jour tout seul n'apprend rien à personne, elle apprend à être désactivée.

`--output-format github` annote les lignes fautives directement dans l'onglet « Files changed » de la pull request, plutôt que d'obliger à ouvrir le log pour savoir où regarder.

### Les règles désactivées, et pourquoi

`ruff.toml` ne désactive **aucune** règle globalement. Une seule exception existe, bornée aux répertoires de tests : `DTZ001`, qui exige un fuseau sur tout `datetime`.

La règle vise le code qui écrit ou compare des horodatages réels, où un décalage passe inaperçu jusqu'au changement d'heure. Un jeu d'essai est autre chose : `datetime(2025, 1, 1, 12)` dans un test dit « midi », pas « midi à Paris ». Elle reste active sur tout le code qui tourne, l'ETL compris, qui écrit les horodatages que le modèle relit.

Le motif est écrit dans `ruff.toml` à côté de l'exception, pas ici : une règle désactivée se lit là où elle l'est.

### Le formatage

`ruff format` pour le Python, vérifié en CI par `ruff format --check`. Sur un poste, `ruff format apps/ml apps/etl` avant de commiter suffit ; le lint et le formatage ne se discutent pas en revue.

**Côté TypeScript, le formatage n'est pas encore automatisé.** Activer les règles stylistiques de `@nuxt/eslint` reformaterait l'ensemble du dashboard, ce qui entrerait en collision avec les branches en cours sur ce répertoire. À faire dans une pull request dédiée, quand elles auront atterri.

### Le rapport

Chaque job de lint produit deux choses, dont aucune ne demande de relancer le pipeline :

- un **résumé lisible sur la page du run**, écrit dans `$GITHUB_STEP_SUMMARY`, avec le décompte par règle ;
- un **artefact** `rapport-qualite-<domaine>` contenant la sortie JSON, téléchargeable et exploitable.

Les deux sont produits en `if: always()`, donc surtout quand le lint a échoué, qui est précisément le moment où on a besoin de les lire.

## Les images sont construites, jamais publiées

Les trois jobs `image-etl`, `image-ml` et `image-dashboard` lancent un `docker build` et s'arrêtent là. Pas de `login`, pas de `push`, pas de registre.

Ce n'est pas un oubli. L'organisation est en offre gratuite : le quota de stockage des paquets privés est de 500 Mo, et l'image du service ML le dépasse à elle seule (`pandas`, `scikit-learn`, `prophet`, `statsmodels`). Les publier en paquets publics exposerait le code d'un dépôt privé. Le déploiement (#107) reconstruit donc **sur la machine** à partir du code récupéré.

Construire ici ne sert qu'à une chose, mais elle compte : savoir qu'un Dockerfile tient avant de fusionner, et non le soir du déploiement.

Chaque image construite est scannée sur place, dans le même job : elle est déjà dans le démon local, la scanner ailleurs obligerait à la reconstruire ou à la publier quelque part, c'est-à-dire à faire exactement ce que le paragraphe précédent explique qu'on ne fait pas.

Conséquence assumée : l'applicatif est construit deux fois sur une pull request qui le touche, une fois par `pnpm build` dans le job `dashboard`, une fois dans l'image. Environ deux minutes. C'est le prix d'un Dockerfile réellement vérifié.

## Le scan de sécurité

Trois garde-fous, dans `security.yml`.

**Trivy** couvre trois surfaces en un passage sur l'arbre de travail : vulnérabilités des dépendances, secrets versionnés, mauvaises configurations (Dockerfile, Compose). Il est réglé sur `CRITICAL,HIGH`, avec `exit-code: 1`, donc bloquant, et `ignore-unfixed: true` : une faille sans correctif publié ne sert qu'à rendre la CI rouge en permanence, ce qui apprend à l'équipe à ignorer le rouge.

**gitleaks** couvre ce que Trivy ne voit pas : l'historique. L'option `-m` compare aussi chaque fusion à ses parents, sans quoi un secret introduit en résolvant un conflit passerait au travers. C'est le binaire qui est utilisé, sous licence MIT ; seule l'action officielle exige une licence payante pour les organisations.

**Le job `secrets`** vérifie que les destinataires déclarés dans `.sops.yaml` sont exactement ceux du fichier chiffré, puis que la CI sait le déchiffrer. Le risque n'est pas le chiffrement mais l'oubli : un rechiffrement qui perd un destinataire reste invisible jusqu'au déploiement. La procédure complète est dans [`secrets.md`](./secrets.md).

Les binaires `sops` et `gitleaks` sont téléchargés puis **vérifiés par somme SHA-256** avant exécution. Épingler une version ne dit rien du contenu servi.

### Accepter une vulnérabilité

Une vulnérabilité détectée est corrigée, ou acceptée explicitement. Jamais contournée en silence, et jamais en retirant `exit-code: 1`.

1. Corriger d'abord : monter la dépendance, ou l'image de base.
2. Si aucun correctif n'existe, ajouter l'identifiant (CVE ou GHSA) dans un fichier `.trivyignore` à la racine, **avec un commentaire** disant pourquoi elle est acceptable ici et ce qui la rouvrira.
3. L'acceptation passe par une pull request comme le reste. `.github/CODEOWNERS` route la revue vers les propriétaires de la chaîne de build.

Le fichier [`.trivyignore`](../.trivyignore) existe et ne contient aucune exception : rien n'a eu besoin d'être accepté à ce jour. Il porte la procédure en commentaire, le jour où une faille bloquera une fusion urgente étant exactement celui où l'on créerait ce fichier mal.

### Le scan des images

Les jobs `image-*` de `ci.yml` passent Trivy sur l'image qu'ils viennent de construire, en deux fois : un passage affiche les vulnérabilités `CRITICAL` et `HIGH` sans bloquer, un second échoue sur une `CRITICAL`. L'image n'est jamais reconstruite pour ça, elle est déjà dans le démon local du runner.

Scanner l'image plutôt que le code voit en plus les paquets du système de base, que la couche `FROM` apporte sans qu'aucun fichier du dépôt ne les mentionne.

**Le seuil bloquant y est plus permissif que celui du scan de code**, qui bloque dès `HIGH`. Ce n'est pas un relâchement. `security.yml` scanne nos dépendances : on les choisit, et on peut les monter le jour même. Une image porte en plus les paquets de la base Debian, dont le rythme de correction ne nous appartient pas. Bloquer dessus rendrait la CI rouge pendant des jours sans que personne ne puisse rien y faire, et une CI rouge en permanence apprend à l'équipe à ignorer le rouge. Les `HIGH` restent affichés, pour qu'aucun ne se découvre le jour où il devient critique.

Un scan dynamique de l'application déployée (OWASP ZAP ou équivalent) reste un plus, pas un attendu.

### Ce que le premier scan a trouvé

Le premier run bloquant a échoué sur les trois images ([run 35203374182](https://github.com/EADL-2026/enerVision/actions/runs/35203374182)). C'est ce qui a vérifié le garde-fou : il n'a pas fallu introduire un défaut, il y en avait déjà.

| Image | Vulnérabilité | Origine | Traitement |
|---|---|---|---|
| ETL, ML | 3 CVE `CRITICAL` dans `perl-base` | Base `python:3.12-slim`, pas encore reconstruite avec le correctif publié par Debian | `apt-get upgrade` à la construction |
| Dashboard | `CVE-2026-59873` dans `tar` 7.5.11 | Le `npm` embarqué dans `node:22-bookworm-slim`, et non nos dépendances : `pnpm-lock.yaml` résout `tar` en 7.5.22 | `npm`, `npx` et `corepack` retirés de l'image d'exécution |

Aucune des deux n'est passée par `.trivyignore`. C'est l'ordre que la procédure impose : on corrige tant qu'un correctif existe, et les deux en avaient un.

**Le second cas est celui qui justifie tout ce chapitre.** Le scan de fichiers de `security.yml` était vert sur ce même commit : il lit `pnpm-lock.yaml`, où `tar` est déjà en 7.5.22, et n'a aucun moyen de voir la copie que `npm` transporte dans l'image de base. Une faille critique était donc dans l'image livrable sans qu'aucun fichier du dépôt ne la mentionne. C'est exactement ce que le premier critère de #57 demandait de couvrir, démontré sans l'avoir cherché.

## Le déploiement (#107)

Non implémenté à ce jour. La cible, pour que la lecture du pipeline soit complète :

- Il n'a lieu que si tout ce qui précède est vert, et **seulement depuis `main`**.
- Il est déclenché explicitement, jamais à chaque fusion.
- Le réseau de l'école n'autorise aucune connexion entrante vers la machine : il n'y a donc pas de clé d'accès à distribuer. C'est un **runner auto-hébergé** posé sur la machine (#47) qui appelle GitHub en sortant et exécute le job localement.
- Il récupère le code de `main`, **construit les images sur place** (pas de registre, voir plus haut) et redémarre la composition.
- Rien n'est modifié à la main sur la machine. Le pipeline est le seul chemin, et c'est vérifié une fois.

**Un déploiement qui échoue laisse la version précédente en place.** Les images sont construites avant que la composition ne redémarre : une construction ratée n'atteint jamais les conteneurs qui tournent. Si le redémarrage lui-même échoue, l'image précédente est encore présente localement et reste ce que la composition relance.

## Rejouer et diagnostiquer

### Reproduire une étape sur son poste

Chaque étape de la CI a un équivalent local. C'est volontaire : un échec qu'on ne peut reproduire qu'en poussant coûte un aller-retour de cinq minutes par tentative.

| Étape | Commande |
|---|---|
| Lint de l'applicatif | `pnpm --dir apps/dashboard lint` |
| Types | `pnpm --dir apps/dashboard typecheck` |
| Tests | `pnpm --dir apps/dashboard test` (Docker requis, Testcontainers démarre un Postgres) |
| Construction de l'applicatif | `pnpm --dir apps/dashboard build` |
| Validation de la composition | `docker compose config --quiet` |
| Images | `docker build apps/etl`, puis `apps/ml` et `apps/dashboard` |
| Trivy | `docker run --rm -v "$PWD:/src" aquasec/trivy fs --scanners vuln,secret,misconfig --severity CRITICAL,HIGH --ignore-unfixed /src` |
| gitleaks | `gitleaks git . --log-opts="--all -m --full-history" --redact` |
| Scan d'une image | `trivy image --scanners vuln --severity CRITICAL --ignore-unfixed --exit-code 1 enervision-etl:ci`, l'image ayant été construite juste avant |

Le scan de fichiers lancé sur un poste voit des répertoires que la CI ne voit pas, `.claude/` en tête : un worktree local d'une autre branche y apparaît comme une seconde copie du dépôt, avec ses propres fichiers de verrouillage. Les résultats sont donc en double, et ce n'est pas un bug. Ajouter `--skip-dirs .claude` pour retrouver la vue de la CI.

La validation de la composition lit le `.env` du poste. En CI il n'y en a pas, et `docker-compose.yml` déclare plusieurs variables en `${VAR:?message}` : le job leur donne des valeurs bidon, parce que `:?` refuse une variable vide autant qu'absente et que la validation porte sur la structure du fichier, jamais sur ce que les variables contiennent.

### Relancer ou suivre un run

```bash
gh run list --limit 10              # les derniers runs et leur état
gh run view <id> --log-failed       # seulement ce qui a échoué
gh run rerun <id> --failed          # relancer les jobs en échec
gh run watch <id>                   # suivre en direct
```

Le bloc `concurrency` annule le run précédent de la même branche quand un nouveau push arrive. Un run marqué « cancelled » sans raison apparente est presque toujours ça, pas une panne.

### Pannes déjà rencontrées

| Symptôme | Cause |
|---|---|
| `Resource not accessible by integration` sur le job `changes` | `pull-requests: read` absent du bloc `permissions` |
| `ERR_PNPM_IGNORED_BUILDS` à la construction de l'image de l'applicatif | pnpm 12 bloque les scripts de build non listés dans `allowBuilds` ; le Dockerfile épingle pnpm 10 |
| Le cache d'une action échoue avant la première commande | L'action calcule sa clé sur un fichier de verrouillage absent |
| Un check reste en échec sur une pull request sans job correspondant | Doublon push et pull request annulé par `concurrency` ; le check annulé ne se met plus à jour |
| **Plus aucun job ne se déclenche sur une pull request**, alors qu'elle en déclenchait avant | La pull request est en conflit avec `main`. GitHub fait tourner les workflows `pull_request` sur la fusion théorique, qu'il ne sait pas calculer tant que le conflit dure : il n'annonce rien, il ne lance simplement plus rien. Fusionner `main` dans la branche rétablit tout |

## Écarts assumés

Ce qui suit est connu, décidé, et non corrigé. C'est ce qui distingue une documentation d'une capture d'écran verte.

| Écart | Pourquoi |
|---|---|
| **Pas de registre d'images** | Quota de 500 Mo pour les paquets privés en offre gratuite, dépassé par la seule image du service ML. Le public exposerait le code. Décidé le 15 septembre 2026 (#50, #107) |
| **`main` n'est pas protégée par règle** | Les règles de protection de branche ne sont pas activables sur un dépôt privé d'une organisation en offre gratuite. La règle est donc écrite dans [`CLAUDE.md`](../CLAUDE.md) et tenue à la main : rien ne refusera un push direct. Le jour où elle le devient, il faudra déclarer **deux** checks obligatoires, `CI` et `Sécurité`, et non un seul : c'est le prix du découpage en deux workflows |
| **Un `HIGH` dans une image ne bloque pas** | Seule une `CRITICAL` bloque, là où le scan de code bloque dès `HIGH`. Les paquets de la base Debian ne se corrigent pas à notre rythme. Ils restent affichés dans le log du job |
| **Pas de cache de dépendances côté Python** | `actions/setup-python` calcule sa clé sur `requirements.txt`, que le projet n'a pas : l'ETL et le ML sont sous `uv` avec un `uv.lock`. Le cache viendra avec `astral-sh/setup-uv`, quand ces jobs feront autre chose qu'un `echo`. Le cache `pnpm`, lui, est actif |
| **Pas de seuil de couverture bloquant** | Retiré le 16 septembre 2026 (#51). Sur dix jours, un seuil non tenu est une CI rouge qui empêche de fusionner : un coût sans contrepartie |
| **Les jobs `etl` et `ml` ne lancent pas de tests** | Ils lintent et formatent depuis #90, mais leur étape de tests reste un `echo`. Elle arrive avec #51 |
| **`ansible-lint` est commenté** | `infra/ansible/` ne contient qu'un README. Le playbook arrive avec #47 |
| **Le scan n'est pas dans le graphe de `ci.yml`** | Il tourne sur tout push, donc plus tôt et plus souvent que s'il attendait une pull request. Le chaîner le rendrait plus tardif, pas plus sûr |
| **L'applicatif est construit deux fois** | Une fois par `pnpm build`, une fois dans l'image. Environ deux minutes, contre un Dockerfile réellement vérifié |
| **Le lint de l'ETL n'est pas bloquant** | #140 réécrit ses seize fichiers Python. Rendre le lint bloquant avant sa fusion ferait partir cette pull request au rouge sur du code jamais linté. Les 16 violations restent visibles dans le rapport. `continue-on-error` à retirer dès que #140 est fusionnée et son code passé par `ruff check --fix` |
| **Le formatage TypeScript n'est pas automatisé** | Les règles stylistiques de `@nuxt/eslint` reformateraient tout le dashboard, en collision avec les branches en cours dessus. Pull request dédiée quand elles auront atterri |
| **Le notebook d'exploration n'est pas linté** | `apps/ml/notebooks` est exclu. Un notebook garde des cellules dans le désordre et des variables d'essai, qui sont la trace du raisonnement. Le code qui en sort est repris dans `apps/ml/src`, lui bien linté |
| **Les images ETL et ML mettent à jour leurs paquets à la construction** | Un `apt-get upgrade` applique les correctifs Debian sans attendre la reconstruction du tag amont. Deux images construites à deux jours d'intervalle peuvent donc différer, ce qui affaiblit la reproductibilité. Assumé : un correctif publié doit entrer le jour où il paraît |
| **L'image du dashboard n'a plus `npm`** | Volontaire. Un conteneur d'exécution n'installe pas de paquets, et le `npm` de la base transportait une CVE critique. Conséquence à connaître : aucun `npm` ni `npx` dans ce conteneur pour diagnostiquer, `node` seul |
