# Synthèse des erreurs Sonar

L'analyse Sonar initiale avait remonté **105 issues**. Parmi elles, **9 étaient des faux positifs** liés à l'analyse de migrations PostgreSQL comme du code Oracle PL/SQL.

## Bilan

| Domaine | Issues initiales | Traitement |
|---|---:|---|
| GitHub Actions | 26 | Corrections dans les workflows |
| Dashboard | 28 | 19 corrections dans le code et 9 faux positifs SQL |
| Service ML | 26 | Corrections dans le code, les tests, Docker et les notebooks |
| ETL | 10 | Corrections dans le code, les tests et Docker |
| Scripts Bash | 15 | Corrections dans les scripts de sauvegarde et restauration |
| **Total** | **105** | **96 corrections et 9 faux positifs** |

Les 96 issues réelles ont reçu une correction dans le dépôt. Leur fermeture dans Sonar doit encore être confirmée par une nouvelle analyse de la branche.

## Principales erreurs rencontrées

### Python et FastAPI

- Littéraux répétés au lieu d'utiliser une constante.
- Variables créées mais jamais utilisées.
- Constructions inutilement complexes ou non idiomatiques.
- Exceptions HTTP non documentées dans les réponses des routes FastAPI.
- Tests d'exception contenant plusieurs appels susceptibles de lever une erreur.
- Fonction ETL légèrement trop complexe.
- Serveur de développement configuré pour écouter toutes les interfaces réseau.

### TypeScript et Vue

- Paramètres de `catch` ne respectant pas la convention de nommage.
- Utilisation d'un tableau au lieu d'un `Set` pour tester fréquemment la présence d'une route.
- Chaînes de caractères avec des templates imbriqués difficiles à lire.
- Tests similaires dupliqués au lieu d'être paramétrés.
- Expression régulière pouvant devenir très lente sur une longue entrée.

### Accessibilité

- Éléments cliquables à la souris sans action clavier équivalente.
- Fenêtre modale construite avec un rôle ARIA au lieu d'un élément HTML adapté.
- Libellé de formulaire non associé correctement à son champ.

### CI/CD et sécurité

- Actions GitHub référencées par un tag au lieu d'un SHA complet.
- Permissions GitHub Actions trop générales.
- Installations Python pouvant exécuter des scripts de construction tiers.
- Téléchargements autorisant des redirections vers un protocole non sécurisé.
- Workflow de déploiement nécessitant une protection explicite contre le code provenant d'un fork.
- Commentaires `TODO` laissés dans des workflows ou des composants.

### Docker

- Instructions `RUN` consécutives qui pouvaient être fusionnées.
- Dépendances insuffisamment verrouillées pendant la construction des images.
- Paquets système non triés dans une commande d'installation.

### Scripts Bash

- Utilisation de `[ ... ]` au lieu de `[[ ... ]]` dans des scripts déjà spécifiques à Bash.

### Notebooks ML

- Noms de colonnes répétés au lieu d'utiliser des constantes.
- Nom de variable ne respectant pas la convention Python.
- Fusion Pandas sans paramètre `validate` pour vérifier la cardinalité attendue.

## Exemples avant et après correction

### Éviter les chaînes répétées

Avant :

```python
raise HTTPException(status_code=503, detail="Aucun modèle champion disponible")
```

La même chaîne était écrite à plusieurs endroits. Après :

```python
MODEL_UNAVAILABLE_DETAIL = "Aucun modèle champion disponible"

raise HTTPException(status_code=503, detail=MODEL_UNAVAILABLE_DETAIL)
```

### Documenter les erreurs FastAPI

Avant :

```python
@app.get("/model")
def get_model_info() -> dict[str, object]:
    ...
```

La route pouvait retourner une erreur `503`, mais cette réponse n'apparaissait pas dans le contrat OpenAPI. Après :

```python
SERVICE_UNAVAILABLE_RESPONSE = {
    503: {"description": "Service temporairement indisponible"}
}

@app.get("/model", responses=SERVICE_UNAVAILABLE_RESPONSE)
def get_model_info() -> dict[str, object]:
    ...
```

### Utiliser une construction Python adaptée

Avant :

```python
counts = {site_id: 0 for site_id in site_ids}
```

Après :

```python
counts = dict.fromkeys(site_ids, 0)
```

### Isoler l'appel testé dans une exception

Avant :

```python
with pytest.raises(ValueError):
    service.predict([PredictionTarget("SITE001", start)])
```

La création de la cible et la prédiction pouvaient toutes les deux lever une exception. Après :

```python
targets = [PredictionTarget("SITE001", start)]

with pytest.raises(ValueError):
    service.predict(targets)
```

Le test vérifie maintenant sans ambiguïté que l'exception vient de `predict`.

### Utiliser un Set pour les recherches

Avant :

```typescript
const PUBLIC_ROUTES = ['/login']

if (PUBLIC_ROUTES.includes(to.path)) return
```

Après :

```typescript
const PUBLIC_ROUTES = new Set(['/login'])

if (PUBLIC_ROUTES.has(to.path)) return
```

Le type de collection exprime directement que le code teste une appartenance.

### Paramétrer les tests répétitifs

Avant :

```typescript
it('affiche le site', () => { /* ... */ })
it('affiche la sévérité', () => { /* ... */ })
it('affiche la recommandation', () => { /* ... */ })
```

Après :

```typescript
it.each([
  ['le site', 'Bureau Paris'],
  ['la sévérité', 'HIGH'],
  ['la recommandation', 'Lisser le pic de consommation'],
])('affiche %s', async (_description, texteAttendu) => {
  expect(wrapper.text()).toContain(texteAttendu)
})
```

La préparation et l'assertion communes ne sont plus dupliquées.

### Limiter l'écoute du serveur local

Avant :

```python
uvicorn.run("api.main:app", host="0.0.0.0", port=8000)
```

Après :

```python
uvicorn.run(
    "api.main:app",
    host=os.getenv("ML_API_HOST", "127.0.0.1"),
    port=8000,
)
```

Le serveur lancé localement n'est plus exposé sur toutes les interfaces par défaut. Le conteneur conserve explicitement `0.0.0.0`, car cette écoute est nécessaire à son fonctionnement.

### Épingler une GitHub Action

Avant :

```yaml
- uses: actions/checkout@v7
```

Après :

```yaml
- uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
  with:
    persist-credentials: false
```

Le SHA rend la dépendance immuable. Le commentaire conserve la version lisible.

### Bloquer les builds de dépendances tierces

Avant :

```bash
uv run --directory apps/ml pytest
```

Après :

```bash
uv run --directory apps/ml --frozen --no-build pytest
```

`--frozen` impose le lock existant et `--no-build` interdit la construction de dépendances tierces depuis leurs sources. Le projet local de l'espace de travail reste installable par `uv`.

### Forcer les téléchargements à rester en HTTPS

Avant :

```bash
curl -sSfL https://example.org/archive.tar.gz -o archive.tar.gz
```

Après :

```bash
curl --proto '=https' --proto-redir '=https' -sSfL \
  https://example.org/archive.tar.gz -o archive.tar.gz
```

Une redirection ne peut ainsi pas faire basculer silencieusement le téléchargement vers HTTP.

### Utiliser la syntaxe Bash cohérente

Avant :

```bash
if [ ! -f .sops.yaml ] || [ ! -f secrets.enc.yaml ]; then
```

Après :

```bash
if [[ ! -f .sops.yaml || ! -f secrets.enc.yaml ]]; then
```

Les scripts utilisent déjà Bash. `[[ ... ]]` évite certains problèmes d'interprétation et permet de regrouper proprement les conditions.

### Fusionner les couches Docker consécutives

Avant :

```dockerfile
RUN apt-get update && apt-get upgrade -y
RUN groupadd --system app
```

Après :

```dockerfile
RUN apt-get update \
    && apt-get upgrade -y \
    && groupadd --system app
```

La construction crée moins de couches intermédiaires et les opérations liées restent regroupées.

### Vérifier la cardinalité d'une fusion Pandas

Avant :

```python
result = sites.merge(site_types, on="site_id", how="left")
```

Après :

```python
result = sites.merge(
    site_types,
    on="site_id",
    how="left",
    validate="one_to_one",
)
```

Si un site apparaît plusieurs fois de façon inattendue, Pandas échoue immédiatement au lieu de produire silencieusement des lignes dupliquées.

### Ajouter un équivalent clavier

Avant :

```vue
<div role="button" @click="openDetails">
  Voir le détail
</div>
```

Après :

```vue
<div
  role="button"
  tabindex="0"
  @click="openDetails"
  @keydown.enter="openDetails"
  @keydown.space.prevent="openDetails"
>
  Voir le détail
</div>
```

L'action devient utilisable sans souris. Quand c'est possible, un véritable élément `<button>` reste préférable.

## Faux positifs identifiés

Sonar recommandait de remplacer `VARCHAR` par `VARCHAR2` dans neuf lignes des migrations SQL. Cette recommandation concerne Oracle, alors que le projet utilise PostgreSQL. Modifier les migrations aurait introduit du SQL inadapté.

Ces neuf issues ont donc été classées comme faux positifs dans Sonar, sans modifier les migrations.

Exemple de recommandation à ne pas appliquer :

```sql
-- PostgreSQL, correct dans ce projet
"name" varchar(50) NOT NULL

-- VARCHAR2 est spécifique à Oracle et ne convient pas ici
"name" varchar2(50) NOT NULL
```

## Enseignements

- Configurer les analyseurs avec le bon langage et le bon dialecte.
- Épingler les dépendances et les actions utilisées par la CI.
- Documenter les erreurs prévues dans les contrats d'API.
- Tester l'accessibilité au clavier dès la création des composants.
- Paramétrer les tests répétitifs au lieu de les dupliquer.
- Rendre explicites les hypothèses sur les données, notamment la cardinalité des jointures.
- Distinguer une vraie vulnérabilité d'un choix nécessaire au déploiement en conteneur.

## Vérifications réalisées

- Ruff sur `apps/ml` et `apps/etl` : réussi.
- Tests ML : **57 réussis**, couverture **92,60 %**.
- Tests ETL : **132 réussis**.
- ESLint dashboard : réussi.
- Vérification TypeScript/Vue : réussie.
- Tests dashboard sans base de données : **413 réussis**.
- Tests dashboard nécessitant Docker : **113 ignorés**, car aucun moteur Docker n'était disponible.
- Syntaxe des scripts Bash : valide.
- Locks `uv` ML et ETL : valides.
- JSON et syntaxe Python des notebooks : valides.
- `git diff --check` : réussi.

Les images Docker n'ont pas pu être construites localement, car le démon Docker n'était pas disponible. La commande `ansible-playbook` n'était pas installée sur le poste, donc la vérification syntaxique Ansible devra être exécutée par la CI ou depuis le runner de déploiement.

Le workflow de déploiement basé sur `workflow_run` a été durci pour refuser les dépôts externes et déployer exactement le SHA validé par la CI. Comme ce déclencheur reste sensible par nature, il doit conserver ces protections lors de futures modifications.

Une nouvelle analyse Sonar est nécessaire après intégration des corrections pour confirmer la fermeture effective des 96 issues corrigées dans le code.
