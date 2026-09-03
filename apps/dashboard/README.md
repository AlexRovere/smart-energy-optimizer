# Dashboard et API de restitution

Application Nuxt en Backend-For-Frontend : le même service sert l'interface et l'API de restitution.

Rôle porteur : Fullstack. Domaines : `domain:front`, `domain:api`.

## Sécurité

Le BFF agit comme Confidential Client : les jetons sensibles ne sortent jamais du serveur.

- JWT en cookie **`httpOnly`, `Secure`, `SameSite`** : aucun jeton lisible par un script client, protection native contre le XSS.
- Aucune clé d'API exposée au navigateur, les appels sortants passent par la couche serveur Nitro.
- Limitation des tentatives sur le login, hachage bcrypt.

## À afficher

Consommation par site et pour le parc, prédictions, recommandations d'actions, alertes, et **un avertissement explicite quand des données sont incomplètes** (des sites à `null` sont exclus des agrégats).
