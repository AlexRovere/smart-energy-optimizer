# Configuration de la machine

Rend la machine sur site reconstructible : paquets, moteur Docker, utilisateurs, répertoires du volume de données et leurs droits, service de sauvegarde. Rejouable, et sans effet au second passage.

Rôle porteur : Cloud / DevOps. Domaine : `domain:cloud`. Épreuve : EC04.

## Ansible, et pas Terraform

Terraform pilote des API de fournisseur pour créer des ressources. Ici il n'y a **aucune ressource à créer** : la machine est fournie. Ce qui reste à décrire, c'est sa configuration, et c'est le métier d'Ansible. Terraform est passé hors périmètre lors de la séance de cadrage du J1, avec sa raison.

Conséquence sur l'épreuve : l'attendu « déploiements reproductibles » est tenu par le playbook et par le pipeline, pas par un `terraform apply`. C'est le playbook qu'il faut pouvoir rejouer devant le jury.

## Attendus de l'épreuve

- **Configuration reproductible** : la machine se reconstruit depuis Git, pas depuis un historique de commandes.
- **Moindre privilège** : accès SSH par clé, aucun port de service publié sur l'hôte hormis le 443 du reverse proxy.
- **Secrets** chiffrés au repos (SOPS et age), jamais en clair sur la machine.
- **Monitoring actif** avec des indicateurs visibles.
- Scripts d'administration pour les tâches répétitives : sauvegarde, purge, rapport.
- Audit de sécurité documenté.

## Ce qui ne sort pas de la machine

Rien. Aucune donnée d'exploitation ne quitte le site, l'hybride ayant été écarté au J1. La seule exception admise est la **sauvegarde chiffrée hors site**, qui protège contre la perte de la machine et dont le contenu est chiffré avant de partir.

## Deux règles d'exploitation

**Rien n'est modifié à la main sur la machine.** Le pipeline est le seul chemin vers elle. L'exception admise est l'exploitation (lancer, lire des journaux, diagnostiquer), jamais l'édition de code ni du schéma de la base.

**Aucun commit depuis la machine.** Le compte y est mutualisé : un commit émis depuis la machine porterait une identité qui n'est celle de personne, alors que l'historique doit rester nominatif.
