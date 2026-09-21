# Rapport de sécurisation

Épreuve EC04. Chaque contrôle porte la commande qui le rejoue et le résultat obtenu. Tout a été
rejoué le **19 septembre 2026** sur la pointe de `main`.

Périmètre : le produit livré (ETL, service de prévision, tableau de bord, base) et son déploiement.
L'outil de pilotage interne de l'équipe n'en fait pas partie.

Un seul contrôle ne se rejoue pas sur un poste, le scan des images, qui demande un démon Docker. Il
tourne dans la chaîne d'intégration à chaque modification.

> ⚠️ **À rejouer et à redater avant le dépôt.** Le produit est gelé le vendredi 25 septembre à
> 09h00 ; les preuves se refont la veille au soir. Ce qui bouge : le compte de commits (§3), la
> liste des destinataires (§1), et le tableau des limites (§8). La structure ne bouge pas.

## 1. Secrets

Chiffrés au repos dans `secrets.enc.yaml`, avec SOPS et age. **Sept destinataires** : les cinq
postes, la chaîne d'intégration, la machine. SOPS ne chiffre que les valeurs, donc noms de clés et
destinataires se lisent sans clé : c'est ce qui permet de contrôler la cohérence sans secret, et la
contrepartie est qu'aucune information sensible ne va dans un **nom** de clé.

Deux contrôles bloquants sur chaque push, dans [`security.yml`](../.github/workflows/security.yml) :
les destinataires déclarés dans `.sops.yaml` doivent être ceux du fichier chiffré (un
`sops updatekeys` oublié ne se verrait qu'au déploiement), et la chaîne doit encore savoir
déchiffrer.

Dans `docker-compose.yml`, les variables sensibles sont en `${VAR:?}` et non `${VAR:-valeur}` : la
composition **refuse de se résoudre** si le secret manque, au lieu de démarrer avec une valeur de
repli. Les variables non sensibles, elles, ont des défauts.

```bash
grep -oE 'age1[0-9a-z]{58}' .sops.yaml       | sort -u > attendus.txt
grep -oE 'age1[0-9a-z]{58}' secrets.enc.yaml | sort -u > effectifs.txt
diff attendus.txt effectifs.txt
sops decrypt secrets.enc.yaml > /dev/null                        # sortie jetée
docker compose config --quiet                                    # doit ECHOUER
sops exec-env secrets.enc.yaml 'docker compose config --quiet'   # doit REUSSIR
docker compose -f docker-compose.dev.yml config --quiet          # REUSSIT sans aucune variable
```

**Résultat.** Sept contre sept, listes identiques. Déchiffrement réussi. Sans secret, la résolution
échoue sur `required variable POSTGRES_PASSWORD is missing a value` ; avec `sops exec-env`, elle
aboutit sans écrire de fichier en clair.

Procédure complète, rotation et révocation : [`secrets.md`](./secrets.md).

## 2. Historique

Trivy lit l'arbre de travail, gitleaks lit **tout l'historique**, avec `-m` pour comparer chaque
fusion à ses parents : sans lui, un secret introduit en résolvant un conflit passerait au travers.
Bloquant. Conséquence assumée : un secret commité puis retiré au commit suivant fait quand même
échouer la chaîne, et le rattrapage est une réécriture d'historique.

```bash
gitleaks git . --log-opts="--all -m --full-history" --redact --exit-code 1
```

**Résultat**, gitleaks 8.30.1 : `279 commits scanned`, `25.77 MB`, **`no leaks found`**.

Réserve : gitleaks se trompe, une clé publique age a déjà été classée `generic-api-key` ici. La
sortie de secours est un `gitleaks:allow` vérifié un par un, jamais pour faire taire un vrai secret.

## 3. Vulnérabilités et configuration

Trivy passe sur les dépendances, les secrets et les mauvaises configurations à chaque push, seuil
bloquant **HIGH**, avec `ignore-unfixed`. Un second scan tourne **par image** dans
[`ci.yml`](../.github/workflows/ci.yml) : un passage qui affiche, un passage qui bloque.

**Le seuil est CRITICAL sur les images et HIGH sur le reste, et c'est un arbitrage.** `security.yml`
scanne nos dépendances, qu'on choisit et qu'on peut monter le jour même. Une image scanne en plus
les paquets système de la base Debian, dont le rythme de correction ne nous appartient pas. Bloquer
dessus rendrait la chaîne rouge pendant des jours, et une chaîne rouge en permanence apprend à une
équipe à ignorer le rouge. Les HIGH restent affichés.

Sorties réelles : `gh run list --workflow=security.yml`, puis `gh run view <id> --log`.

**Résultat du 21 septembre 2026**, relevé automatiquement depuis le journal du job `security` de la
dernière exécution terminée sur `main` : **0 critique, 0 haute**.

## 4. Authentification

**Argon2id**, `m=19456, t=2, p=1`, via `@node-rs/argon2`. Le ticket spécifiait bcrypt ; la lecture de
l'OWASP Password Storage Cheat Sheet l'a fait changer, avec une note datée : bcrypt y est réservé
aux systèmes hérités, tronque à 72 octets, et ses 4 Ko de mémoire le rendent parallélisable sur
carte graphique.

Trois défenses dans `server/api/auth/login.post.ts`, qu'une démonstration ne montrerait pas :

| Contre quoi | Comment |
|---|---|
| Énumération par le temps de réponse | Si le compte n'existe pas, la vérification tourne quand même contre une empreinte leurre. Sinon une adresse inconnue répondrait en une microseconde et une connue en cent millisecondes |
| Énumération par le message | Le même `401 Identifiants invalides` dans les deux cas |
| Balayage | Limitation de débit indexée sur l'IP **et** l'adresse, `429` avec `retry-after`. Une réussite remet le compteur à zéro |

`TRUST_PROXY` vaut `false` par défaut et `X-Forwarded-For` n'est lu que derrière un proxy de
confiance : activé sans proxy, l'en-tête se forge et l'attaquant se donne une adresse neuve à chaque
essai ; désactivé derrière un proxy, le premier balayage verrouille tout le monde. Les deux erreurs
sont silencieuses.

Session : cookie `httpOnly`, `secure`, `sameSite: lax`, deux heures. Secret de session issu de
`sops`. Sessions expirées purgées à chaque connexion, compte désactivé refusé.

## 5. Moindre privilège

| Mesure | Ce que ça borne |
|---|---|
| Rôle `etl` en base, et non le propriétaire | `SELECT` et `INSERT` sur la seule table `sites`, `UPDATE` sur sept colonnes. Il ne peut lire **ni les comptes, ni les sessions, ni les périmètres** |
| `user: "1000:1000"` sur l'ETL | Le conteneur ne tourne pas en `root` |
| Volume monté `:ro` sur `ml` et `dashboard` | Les deux services qui exposent les données ne peuvent pas les altérer |
| `profiles: ["cron"]` sur l'ETL | Il ne tourne pas en permanence |

Le premier est le plus utile : **le service qui écrit dans la base n'utilise pas le compte qui l'a
créée**, donc une injection dans l'ETL ne rend ni comptes ni sessions.

```bash
grep -n -B6 -A2 "POSTGRES_USER: etl" docker-compose.yml
grep -n ":/data:ro" docker-compose.yml
```

## 6. Réseau

La machine peut sortir vers internet, **rien ne peut la joindre depuis l'extérieur**. C'est la règle
de l'infrastructure fournie, et elle a dicté la conception du déploiement : aucun port à ouvrir,
aucune clé d'accès à distribuer.

| Service | Port publié |
|---|---|
| `postgres` | `127.0.0.1:5432`, boucle locale seulement |
| `ml` | aucun |
| `dashboard` | aucun |

```bash
sops exec-env secrets.enc.yaml 'docker compose config --services'
grep -n -A2 "ports:" docker-compose.yml
```

**Résultat.** Trois services actifs, un seul port publié, lié à la boucle locale. Prometheus et
Grafana sont **commentés** : la limite signalée dans [`secrets.md`](./secrets.md) sur des ports
ouverts trop largement ne s'applique plus, et redeviendra vraie le jour où ces services seront
activés.

## 7. Accès au dépôt et à la machine

**Dépôt** : [`CODEOWNERS`](../.github/CODEOWNERS), revue obligatoire, pas de poussée directe sur
`main`. **Écart assumé** : la protection de branche n'existe pas sur un dépôt privé en offre
gratuite, elle est donc tenue par la discipline, ce qui est plus faible qu'une règle technique. Le
jeu de règles est prêt si le dépôt passe en public.

**Machine** : le compte est **partagé par les cinq**, et depuis le **17 septembre 2026** une clé de
déchiffrement y est posée. C'est un renversement explicite de la décision de la veille, motivé dans
[`secrets.md`](./secrets.md) : l'exécuteur auto-hébergé ne tient pas ses promesses, le déploiement
se fait à la main depuis la machine, et l'alternative était de recopier les valeurs dans un `.env`
temporaire. Entre une clé assumée et des secrets recopiés à la main, la clé est le moindre mal.

Le prix, et il n'a pas disparu : la clé est lisible par les cinq, et elle ouvre les **versions
passées** du fichier chiffré. D'où deux règles : elle est générée **sur** la machine et n'en sort
jamais, et le jour où le déploiement automatisé fonctionnera, la retirer ne suffira pas, il faudra
**changer les valeurs**.

Plus généralement, sur un incident réel : changer les valeurs, redéployer, **puis** retirer la clé.
La révocation est le geste d'hygiène, pas la réponse à l'incident.

## 8. Limites connues et risques acceptés

| Limite | Statut |
|---|---|
| Docker garde les variables d'environnement en clair sur l'hôte | **Accepté.** Monter les secrets en fichiers changerait le contrat de [`api.md`](./api.md) pour déplacer la frontière d'un cran |
| Clé de déchiffrement sur un compte partagé | **Accepté et daté**, avec sa condition de sortie (§7) |
| Le fichier chiffré révèle sa structure | **Voulu** : c'est ce qui permet le contrôle sans clé |
| Protection de branche indisponible | **Écart d'offre**, compensé par `CODEOWNERS` et la revue |
| Pas de playbook Ansible, `infra/ansible/` n'a qu'un README | **Trou reconnu**, signalé jusque dans un `TODO` de la CI. La configuration de la machine **n'est pas rejouable** |
| Aucun test d'intrusion, aucun scan dynamique | **Hors périmètre** d'un projet de dix jours |
| Pas de politique de mise à jour des dépendances | **Hors périmètre** |
| Pas de rotation de routine des secrets | **Accepté**, la pile ne vit que le temps du projet |
| Pas de sauvegarde | **Risque connu, consigné, non traité** faute de temps |

Les quatre dernières lignes sont volontairement inconfortables. Un risque accepté et consigné est un
acte de pilotage ; un risque passé sous silence est une négligence.

---

**Preuves rejouées le 19 septembre 2026, sur la pointe de `main`**

| Contrôle | Résultat |
|---|---|
| gitleaks, historique complet et fusions | 279 commits, 25,77 Mo, **aucune fuite** |
| Destinataires SOPS, déclarés contre effectifs | 7 contre 7, **identiques** |
| Déchiffrement du fichier de secrets | **réussi** |
| Composition de production sans secret | **échoue**, aucune valeur de repli |
| Composition de production avec `sops exec-env` | **se résout**, sans fichier en clair |
| Composition de développement sans variable | **se résout** |
| Ports publiés | **un seul**, `postgres` sur la boucle locale |
| Vulnérabilités Trivy sur `main` (relevé du 21 septembre) | **0 critique, 0 haute** |
| Scans Trivy d'image | dans la CI, non rejouables sans démon Docker |
