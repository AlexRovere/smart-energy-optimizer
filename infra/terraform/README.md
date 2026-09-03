# Infrastructure AWS

Provisionne la zone AWS de l'architecture hybride : bucket S3 chiffré servant de Data Lake pour les séries pseudonymisées, et le compute du service ML.

Rôle porteur : Cloud / DevOps. Domaine : `domain:cloud`. Épreuve : EC04.

## Attendus de l'épreuve

- **Déploiements reproductibles** : c'est Terraform qui crée la zone AWS pendant le sprint, pas une console.
- **IAM configuré** au moindre privilège, secrets gérés, accès réseau restreint.
- **Monitoring actif** avec des indicateurs visibles.
- Scripts d'administration (Bash ou Python) pour les tâches répétitives.
- Audit de sécurité documenté.

## Ce qui ne franchit pas la frontière

Les données à caractère personnel et la table de correspondance client restent on-premise. Seules les séries **pseudonymisées** partent vers AWS, la clé de réidentification étant conservée en zone souveraine. Voir le dossier de conception.

## Amorçage

```bash
cp terraform.tfvars.example terraform.tfvars   # jamais versionné
terraform init && terraform plan
```

L'état Terraform contient des données sensibles et n'est pas versionné.
