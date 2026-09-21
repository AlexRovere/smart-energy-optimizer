# Configuration de la machine

Déploie l'application de façon rejouable sur la VM déjà équipée de Docker,
Docker Compose, Git, SOPS et age. Le playbook reste volontairement limité aux
opérations réellement rejouées lors d'un déploiement.

Rôle porteur : Cloud / DevOps. Domaine : `domain:cloud`. Épreuve : EC04.

## Ansible, et pas Terraform

Terraform pilote des API de fournisseur pour créer des ressources. Ici il n'y a **aucune ressource à créer** : la machine est fournie. Ce qui reste à décrire, c'est sa configuration, et c'est le métier d'Ansible. Terraform est passé hors périmètre lors de la séance de cadrage du J1, avec sa raison.

Conséquence sur l'épreuve : l'attendu « déploiements reproductibles » est tenu par le playbook et par le pipeline, pas par un `terraform apply`. C'est le playbook qu'il faut pouvoir rejouer devant le jury.

## Attendus de l'épreuve

- **Configuration reproductible** : la machine se reconstruit depuis Git, pas depuis un historique de commandes.
- **Moindre privilège** : accès SSH par clé, aucun port de service publié sur l'hôte hormis le 443 du reverse proxy.
- **Secrets** chiffrés au repos (SOPS et age) : aucun fichier que nous posons sur la machine ne contient de valeur en clair, le déchiffrement a lieu à l'exécution, et la seule copie en clair est celle que le moteur de conteneurs tient pour son propre compte, sous `root`. La formulation compte : « jamais en clair sur la machine » serait plus courte et fausse, et le motif est écrit dans [`../../docs/secrets.md`](../../docs/secrets.md).
- **Monitoring actif** avec des indicateurs visibles.
- Scripts d'administration pour les tâches répétitives : sauvegarde, purge, rapport.
- Audit de sécurité documenté.

## Ce que la gestion des secrets attend du playbook

Le mécanisme de chiffrement au repos est posé par #52, mais il ne sert à rien tant que la machine ne sait pas s'en servir. Trois choses sont donc attendues du playbook de #47, et elles sont écrites ici pour ne pas se redécouvrir le jour du premier déploiement.

- **Le binaire `sops` installé** sur la machine, et `age` avec lui. Le déchiffrement a lieu sur place, au lancement de la pile : les valeurs ne transitent jamais en clair par GitHub Actions.
- **Un runner GitHub auto-hébergé**, enregistré sur le dépôt et lancé en service. Il appelle GitHub en HTTPS sortant et n'accepte aucune connexion entrante, ce qui est la seule forme possible ici : le réseau de l'école ne laisse rien joindre la machine depuis l'extérieur. Ses identifiants d'enregistrement restent au repos sur la machine, sur un compte mutualisé : à relever dans l'audit de #58.
- **Un `docker image prune` périodique**, les déploiements reconstruisant les images sur place faute de registre.

**Ni clé age de machine, ni clé SSH de déploiement.** La première serait lisible en permanence par les cinq, le compte étant mutualisé ; la seconde n'a plus d'objet, le pipeline ne se connectant pas à la machine. Le runner reçoit `SOPS_AGE_KEY` de GitHub le temps de chaque job, et rien ne reste au repos. Le motif est dans [`../../docs/secrets.md`](../../docs/secrets.md).

## Ce qui ne sort pas de la machine

Rien. Aucune donnée d'exploitation ne quitte le site, l'hybride ayant été écarté au J1. La seule exception admise est la **sauvegarde chiffrée hors site**, qui protège contre la perte de la machine et dont le contenu est chiffré avant de partir.

## Deux règles d'exploitation

**Rien n'est modifié à la main sur la machine.** Le pipeline est le seul chemin vers elle. L'exception admise est l'exploitation (lancer, lire des journaux, diagnostiquer), jamais l'édition de code ni du schéma de la base.

**Aucun commit depuis la machine.** Le compte y est mutualisé : un commit émis depuis la machine porterait une identité qui n'est celle de personne, alors que l'historique doit rester nominatif.

## Playbook de déploiement

[`playbook.yml`](./playbook.yml) automatise les opérations de déploiement sur
la VM déjà préparée :

- vérification de Docker, Docker Compose, SOPS et age ;
- création de `/home/apprenant/Projet`, `/data/output` et
  `/var/log/enervision` avec les droits attendus ;
- clonage ou mise à jour de `main` dans
  `/home/apprenant/Projet/enerVision` ;
- vérification de la clé age propre à la VM ;
- construction des images et démarrage de PostgreSQL ;
- migrations Drizzle et amorçage idempotent dans des conteneurs ponctuels ;
- démarrage de la pile complète avec les secrets déchiffrés en mémoire.

Node, npm et pnpm ne sont pas requis sur la VM. L'étape `build` du Dockerfile du
dashboard contient les outils nécessaires aux services Compose `migrate` et
`seed`. Ces services portent le profil `admin` : ils ne démarrent jamais avec
la pile normale et sont supprimés après chaque exécution.

Le playbook ne copie ni `.env`, ni fichier Parquet depuis le poste de contrôle.
Les Parquet sont des données d'exploitation : leur collecte par l'ETL ou leur
restauration depuis une sauvegarde est indépendante du déploiement applicatif.

### Prérequis du poste de contrôle

Ansible s'exécute depuis Linux ou WSL, à la racine d'une copie du dépôt. Cette
copie n'a besoin de contenir ni secret ni donnée d'exploitation.

```bash
sudo apt update
sudo apt install -y ansible sshpass
cd /mnt/d/enerVision
```

Sous Linux, remplacer `/mnt/d/enerVision` par le chemin local du dépôt.
`sshpass` est nécessaire tant que la VM utilise une authentification SSH par
mot de passe. Le mot de passe n'est jamais écrit dans l'inventaire : Ansible le
demande avec `--ask-pass` et demande séparément celui de `sudo` avec
`--ask-become-pass`.

Avant le premier passage, accepter explicitement l'empreinte SSH de la VM :

```bash
ssh apprenant@10.101.200.31
exit
```

### Prérequis de la VM

La VM doit disposer de Docker, du plugin Compose, de Git, de SOPS et de age.
Sa clé privée age doit avoir été générée sur place et rester dans :

```text
/home/apprenant/.config/sops/age/keys.txt
```

Sa clé publique est déjà déclarée comme destinataire dans `.sops.yaml`. Le
playbook refuse de continuer si la clé privée manque et force ses permissions à
`0600`. Il ne crée, ne copie et n'affiche jamais cette clé.

### Déployer

```bash
ansible-playbook \
  -i infra/ansible/inventory.ini \
  infra/ansible/playbook.yml \
  --ask-pass \
  --ask-become-pass
```

La même commande sert au premier passage et aux suivants. Le module Git clone
le dépôt s'il est absent et ne récupère que les nouveaux commits sinon. Une
modification locale d'un fichier suivi fait échouer le déploiement plutôt que
d'être écrasée.

L'amorçage peut être désactivé si seuls le code et les migrations doivent être
déployés :

```bash
ansible-playbook \
  -i infra/ansible/inventory.ini \
  infra/ansible/playbook.yml \
  --ask-pass \
  --ask-become-pass \
  -e run_database_seed=false
```

### Secrets

Chaque commande Compose est exécutée par `sops exec-env secrets.enc.yaml`. Les
valeurs sont déchiffrées en mémoire et l'environnement du processus les fournit
à Compose. Le playbook supprime un éventuel ancien `.env` de production laissé
sur la VM : aucun secret applicatif déchiffré n'est écrit par Ansible.

Docker conserve ensuite l'environnement des conteneurs sous `root`, limite
documentée dans [`../../docs/secrets.md`](../../docs/secrets.md).
