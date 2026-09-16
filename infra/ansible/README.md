# Configuration de la machine

Rend la machine sur site reconstructible : paquets, moteur Docker, utilisateurs, répertoires du volume de données et leurs droits, service de sauvegarde. Rejouable, et sans effet au second passage.

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

- **Un compte de service `enervision`**, propriétaire de `/etc/enervision/age.key` en `0400`, et membre du groupe `docker`. C'est ce compte qui déchiffre, et lui seul : un fichier de clé lisible par tout le monde annulerait la distinction entre « entrer sur la machine » et « lire les secrets », qui est exactement ce que le moindre privilège cherche à tenir.
- **Le binaire `sops` installé** sur la machine. C'est elle qui déchiffre au lancement de la pile, pas le pipeline : les valeurs ne transitent donc jamais en clair par GitHub Actions.
- **La clé publique de déploiement autorisée** sur ce compte, depuis [`files/deploy_key.pub`](./files/deploy_key.pub) qui est versionné. L'accès du pipeline vient ainsi de Git, rejouable et relisible en pull request, et non d'un `ssh-copy-id` joué une fois sur un terminal dont personne ne garde la trace.

La clé age de la machine, elle, est **générée sur la machine** et sa partie privée n'en sort jamais. Seule la partie publique remonte dans `.sops.yaml`, par pull request. La procédure est dans [`../../docs/secrets.md`](../../docs/secrets.md).

## Ce qui ne sort pas de la machine

Rien. Aucune donnée d'exploitation ne quitte le site, l'hybride ayant été écarté au J1. La seule exception admise est la **sauvegarde chiffrée hors site**, qui protège contre la perte de la machine et dont le contenu est chiffré avant de partir.

## Deux règles d'exploitation

**Rien n'est modifié à la main sur la machine.** Le pipeline est le seul chemin vers elle. L'exception admise est l'exploitation (lancer, lire des journaux, diagnostiquer), jamais l'édition de code ni du schéma de la base.

**Aucun commit depuis la machine.** Le compte y est mutualisé : un commit émis depuis la machine porterait une identité qui n'est celle de personne, alors que l'historique doit rester nominatif.
