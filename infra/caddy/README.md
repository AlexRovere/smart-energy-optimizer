# Intégration de 'Caddy' dans l'infrastructure

## Comment fonctionne un reverse proxy

Un reverse proxy est un serveur qui se place **devant** les services applicatifs. Le client (navigateur) ne communique qu'avec lui ; il ne sait pas que derrière se trouvent Nuxt, PostgreSQL ou le service ML.

```
Navigateur  ──HTTPS 443───▶  Caddy  ──HTTP──▶  dashboard:3000
            ──HTTPS 3001──▶    │    ──HTTP──▶  grafana:3000
                               │
                               ✗ ne voit pas postgres:5432
                               ✗ ne voit pas ml:8000
                               ✗ ne voit pas prometheus:9090
```

Avantages pour nous :
- **Surface d'exposition** : deux ports servis sur la VM, plus le 80 qui ne fait que rediriger, tous tenus par Caddy, au lieu d'un par service.
- **TLS centralisé** : le chiffrement est géré une seule fois, en un seul endroit, même si on ajoute des services derrière.
- **En-têtes de sécurité** : posés une fois pour toutes dans Caddy, sans toucher le code applicatif.

## `Caddyfile`

**Deux adresses, un seul bloc d'en-têtes.** Le dashboard est servi sur 443, Grafana sur `GRAFANA_PORT`. Les en-têtes de sécurité vivent dans un extrait `(securite)` importé par les deux : ajouter un en-tête se fait une fois, pas deux.

**Pourquoi un port dédié pour Grafana** plutôt qu'un sous-chemin `/grafana` : `DOMAIN` vaut une adresse IP, donc `grafana.<domaine>` n'existe pas, et un service sous-chemin obligerait à déclarer sa racine à Grafana et à faire correspondre les chemins de ses ressources. Le port ne lui demande rien et se referme seul, sans toucher au site principal.

**L'autorité de certification vit dans le volume `caddy_data`.** Le détruire en forge une nouvelle, et tous les navigateurs qui avaient accepté l'ancienne doivent recommencer.

**Pourquoi `tls internal` :** Caddy dispose de sa propre autorité de certification (CA). Avec `tls internal`, il génère un certificat signé par cette CA sans avoir besoin d'un nom de domaine public ni d'une connexion internet. Ici ce n'est pas un pis-aller : le nom Active Directory de la machine ne résout pas depuis les postes, `DOMAIN` vaut son IP, et Let's Encrypt ne pourra jamais valider une adresse IP privée. Le jour où un vrai domaine existe, retirer cette ligne suffit.

**HTTP vers HTTPS :** Caddy redirige le port 80 vers 443 par défaut, sans ligne de configuration supplémentaire.

**Le site de repli `:443`** répond `421` à une requête dont l'en-tête `Host` ne vaut pas `DOMAIN`. Sans lui, Caddy casse la poignée de main TLS et le navigateur rend `ERR_SSL_PROTOCOL_ERROR`, sans rien dire de la cause. Quelqu'un essaiera le nom AD de la machine, qui ne résout pas.

**HTTP/3 est coupé** par le bloc global. La composition ne publie pas l'UDP, et un navigateur mémorise l'annonce `Alt-Svc` pendant trente jours : il tenterait QUIC dans le vide à chaque session, pour une première requête lente sans trace côté serveur.

**Pourquoi il n'y a pas de `trusted_proxies`, et pourquoi il ne faut pas en ajouter à la légère.** Sans cette directive, Caddy ne fait confiance à personne et **remplace** `X-Forwarded-For` par l'adresse réelle du pair, au lieu de compléter celui qu'un client aurait posé. C'est ce qui rend `TRUST_PROXY=true` honnête côté applicatif. Vérifié sur Caddy 2.11 avec une liste forgée, un en-tête répété et un `X-Real-IP` : tous écrasés. En revanche `h3` lit le **premier** élément de la liste : le jour où on déclare un proxy de confiance ou qu'on en chaîne un second, la limitation des tentatives de #29 redevient forgeable dans la seconde.

**En-têtes de sécurité, ce qu'ils font :**
| En-tête | Ce qu'il fait |
|---|---|
| `Strict-Transport-Security` (HSTS) | Indique au navigateur de ne jamais utiliser HTTP pour ce domaine pendant 1 an. Empêche le downgrade vers HTTP. **Sans effet tant que `DOMAIN` est une IP** : les navigateurs n'appliquent pas HSTS à une adresse. L'en-tête est là pour le jour où un vrai nom existe. |
| `X-Content-Type-Options: nosniff` | Interdit au navigateur de « deviner » le type d'un fichier. Empêche des attaques où un fichier uploadé est exécuté comme du HTML/JS. |
| `X-Frame-Options: DENY` | Interdit d'afficher le site dans une `<iframe>`. Empêche le clickjacking. |
| `Referrer-Policy` | Limite les informations d'URL envoyées au site suivant quand l'utilisateur clique un lien. |
| `-Server` et `-Via` | Suppriment `Server: Caddy` et `Via: 1.1 Caddy`, que Caddy pose sinon sur les réponses mandatées. Moins d'infos pour un attaquant qui scanne. |

## `docker-compose.yml`

Par défaut, tous les services d'un même Compose se voient. En déclarant des réseaux séparés, on reproduit en réseau virtuel la séparation qu'on aurait dans une vraie infra :

```text
frontend    : caddy ←→ dashboard, grafana
data        : dashboard ←→ postgres, ml, etl, migrate, seed
supervision : prometheus ←→ node-exporter, cadvisor, grafana
```

Caddy n'est pas sur `data` : il ne peut pas atteindre postgres ni ml, même en connaissant leur nom. Grafana est le seul service sur deux réseaux avec le dashboard, parce qu'il est vu de l'extérieur et lit Prometheus.

**Le piège :** déclarer des réseaux nommés sort du réseau implicite **tous** les services qui n'en nomment aucun. `migrate` et `seed` perdaient ainsi l'accès à postgres, et le playbook les lance avant la pile. Un service sans clé `networks` dans cette composition est un oubli, pas un choix.

## `.env.example`

Pourquoi **TRUST_PROXY** ? Sans proxy, l'IP du client est connue directement. Avec un proxy, Nuxt reçoit l'IP de Caddy, pas celle du navigateur, et la vraie arrive dans `X-Forwarded-For`. `TRUST_PROXY=true` dit à Nuxt de croire cet en-tête, et cela n'est vrai que si le proxy est le **seul** chemin : le dashboard ne publie donc plus de port. Sinon l'en-tête se forge et la limitation des tentatives de #29 ne limite plus rien.

Le fichier d'exemple laisse `true`, et ce n'est pas une inattention : il ne sert que la composition, où le dashboard est derrière Caddy y compris sur un poste. La boucle de développement lit `.env.dev`, tourne sans proxy, et garde le défaut `false` de `nuxt.config.ts`. Sur la machine, `DOMAIN` et `TRUST_PROXY` sont posés par le playbook dans le `.env` : ce sont des réglages, pas des secrets, et #197 a sorti les réglages de `secrets.enc.yaml`. `DOMAIN` garde un défaut `localhost`, pour qu'un `.env` antérieur à cette branche ne bloque pas le lancement.

## Comportement par environnement

| Environnement | DOMAIN | TLS | Remarque |
|---|---|---|---|
| Poste local (dev Nuxt) | sans objet | sans objet | `docker-compose.dev.yml` ne lance que PostgreSQL ; Nuxt tourne via `corepack pnpm --dir apps/dashboard dev` sur `localhost:3000`. Pas de proxy nécessaire pour développer. |
| Stack Docker complète en local | `localhost` | `tls internal` (Caddy PKI) | `docker compose up -d` avec le compose principal. Avertissement navigateur normal (CA Caddy non reconnue par le système). **Attention**, HSTS s'applique bien à `localhost` : après une visite, le navigateur refusera `http://localhost` pendant un an, pour tous vos projets. Se défait dans `chrome://net-internals/#hsts`. |
| VM école | l'IP de la machine, posée par le playbook | `tls internal` | Le nom `eadl-2025-nantes-g1.ad.campus-eni.fr` ne résout pas depuis les postes, seule l'adresse répond. Pour supprimer l'avertissement : exporter la CA du volume `caddy_data` et la faire reconnaître par le navigateur. |
| VM de prod avec domaine | `enervision.xxx` | Auto-TLS Let's Encrypt | Retirer `tls internal` du Caddyfile. Ports 80 et 443 ouverts publiquement requis pour la vérification ACME. |

## Tests effectués

> Menés sur un poste, avec `DOMAIN=localhost`, avant l'ajout de Grafana. Sur la machine, `DOMAIN` vaut une IP : les mêmes commandes s'y rejouent en remplaçant `localhost` par l'adresse, et `https://<ip>:3001/` doit rendre la page de connexion de Grafana.

Test 1 : Logs Caddy, `docker compose logs caddy`

```powershell
PS C:\eni\enerVision> docker compose logs caddy
[...]
caddy-1  | {"level":"info","ts":1789982868.0786734,"msg":"certificate installed properly in linux trusts"}
caddy-1  | {"level":"info","ts":1789982868.0788498,"msg":"autosaved config (load with --resume flag)","file":"/config/caddy/autosave.json"}
caddy-1  | {"level":"info","ts":1789982868.0788786,"msg":"serving initial configuration"}
```

---

Test 2 : Le proxy répond `curl.exe -k -v https://localhost/`

```powershell
PS C:\eni\enerVision> curl.exe -k -v https://localhost/
* Host localhost:443 was resolved.
* IPv6: ::1
* IPv4: 127.0.0.1
*   Trying [::1]:443...
* schannel: disabled automatic use of client certificate
* ALPN: curl offers http/1.1
* ALPN: server accepted http/1.1
* Established connection to localhost (::1 port 443) from ::1 port 61595
* using HTTP/1.x
> GET / HTTP/1.1
> Host: localhost
> User-Agent: curl/8.16.0
> Accept: */*
>
* schannel: remote party requests renegotiation
* schannel: renegotiating SSL/TLS connection
* schannel: SSL/TLS connection renegotiated
* Request completely sent off
< HTTP/1.1 302 Found
< Alt-Svc: h3=":443"; ma=2592000
< Content-Length: 92
< Content-Type: text/html
< Date: Mon, 21 Sep 2026 09:44:12 GMT
< Location: /login
< Referrer-Policy: strict-origin-when-cross-origin
< Strict-Transport-Security: max-age=31536000; includeSubDomains
< Via: 1.1 Caddy
< X-Content-Type-Options: nosniff
< X-Frame-Options: DENY
<
<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/login"></head></html>* Connection #0 to host localhost:443 left intact
```

> Caddy reçoit la requête, la transmet au dashboard, qui répond 302 → /login (comportement normal pour un utilisateur non connecté). Les en-têtes de sécurité sont déjà visibles dans cette réponse.

---

Test 3 : HTTP redirige vers HTTPS, `curl.exe -I http://localhost/`

```powershell
PS C:\eni\enerVision> curl.exe -I http://localhost/
HTTP/1.1 308 Permanent Redirect
Connection: close
Location: https://localhost/
Server: Caddy
Date: Mon, 21 Sep 2026 09:46:05 GMT
```

> 308 Permanent Redirect vers https://localhost/. Caddy redirige tout le HTTP vers HTTPS.

---

Test 4 : En-têtes de sécurité, `curl.exe -k -I https://localhost/`

```powershell
PS C:\eni\enerVision> curl.exe -k -I https://localhost/
HTTP/1.1 302 Found
Alt-Svc: h3=":443"; ma=2592000
Content-Type: text/html
Date: Mon, 21 Sep 2026 09:47:24 GMT
Location: /login
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
Via: 1.1 Caddy
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
```

> Tous les en-têtes attendus sont présents :
> - Strict-Transport-Security ✓
> - X-Content-Type-Options: nosniff ✓
> - X-Frame-Options: DENY ✓
> - Referrer-Policy: strict-origin-when-cross-origin ✓
> - Pas de Server: Caddy ✓ (la directive -Server fonctionne)

---

Test 5 : Dashboard non joignable directement, `curl.exe http://localhost:3000/`

```powershell
PS C:\eni\enerVision> curl.exe http://localhost:3000/
curl: (7) Failed to connect to localhost port 3000 after 2258 ms: Could not connect to server
```

---

Test 6 : Isolation réseau (Caddy ne voit pas ml), `docker compose exec caddy wget -qO- http://ml:8000/ 2>&1`

```powershell
PS C:\eni\enerVision> docker compose exec caddy wget -qO- http://ml:8000/ 2>&1
wget: bad address 'ml:8000'
```