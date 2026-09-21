# Intégration de 'Caddy' dans l'infrastructure

## Comment fonctionne un reverse proxy

Un reverse proxy est un serveur qui se place **devant** les services applicatifs. Le client (navigateur) ne communique qu'avec lui ; il ne sait pas que derrière se trouvent Nuxt, PostgreSQL ou le service ML.

```
Navigateur  ──HTTPS 443──▶  Caddy  ──HTTP──▶  dashboard:3000
                              │
                              ✗ ne voit pas postgres:5432
                              ✗ ne voit pas ml:8000
```

Avantages pour nous :
- **Surface d'exposition** : un seul port ouvert sur la VM au lieu de 3, 4, 5.
- **TLS centralisé** : le chiffrement est géré une seule fois, en un seul endroit, même si on ajoute des services derrière.
- **En-têtes de sécurité** : posés une fois pour toutes dans Caddy, sans toucher le code applicatif.

## `Caddyfile`

**Pourquoi `tls internal` :** Caddy dispose de sa propre autorité de certification (CA). Avec `tls internal`, il génère un certificat signé par cette CA sans avoir besoin d'un nom de domaine public ni d'une connexion internet. C'est le mode adapté à une VM école ou à un test local. Pour passer à Let's Encrypt (prod avec vrai domaine), il suffit de retirer cette ligne — Caddy contacte alors Let's Encrypt automatiquement.

**HTTP → HTTPS :** Caddy redirige le port 80 vers 443 par défaut, sans ligne de config supplémentaire.

**En-têtes de sécurité — ce qu'ils font :**
| En-tête | Ce qu'il fait |
|---|---|
| `Strict-Transport-Security` (HSTS) | Indique au navigateur de ne jamais utiliser HTTP pour ce domaine pendant 1 an. Empêche le downgrade vers HTTP. |
| `X-Content-Type-Options: nosniff` | Interdit au navigateur de « deviner » le type d'un fichier. Empêche des attaques où un fichier uploadé est exécuté comme du HTML/JS. |
| `X-Frame-Options: DENY` | Interdit d'afficher le site dans une `<iframe>`. Empêche le clickjacking. |
| `Referrer-Policy` | Limite les informations d'URL envoyées au site suivant quand l'utilisateur clique un lien. |
| `-Server` | Supprime l'en-tête `Server: Caddy` que le serveur enverrait sinon. Moins d'infos pour un attaquant qui scanne. |

## `docker-compose.yml`

Pourquoi deux réseaux Docker ? Par défaut, tous les services d'un même Compose se voient. En déclarant deux réseaux séparés, on reproduit en réseau virtuel la séparation physique qu'on aurait dans une vraie infra :

```text
frontend : caddy ←→ dashboard
data     : dashboard ←→ postgres, ml, etl
```

Caddy n'est pas sur le réseau data → il ne peut pas atteindre postgres ni ml, même en connaissant leur nom. C'est une isolation par construction, vérifiable.

## `.env.example`

Pourquoi **TRUST_PROXY** ? Sans proxy, l'IP du client est connue directement. Avec un proxy, Nuxt reçoit l'IP de Caddy, pas celle du navigateur. Caddy transmet la vraie IP dans l'en-tête X-Forwarded-For. TRUST_PROXY=true dit à Nuxt de faire confiance à cet en-tête — mais seulement si un vrai proxy est là. Si on met true sans proxy, n'importe qui peut forger l'en-tête et contourner le rate limiting.

## Comportement par environnement

| Environnement | DOMAIN | TLS | Remarque |
|---|---|---|---|
| Poste local (dev Nuxt) | — | — | `docker-compose.dev.yml` ne lance que PostgreSQL ; Nuxt tourne via `npm run dev` sur `localhost:3000`. Pas de proxy nécessaire pour développer. |
| Stack Docker complète en local | `localhost` | `tls internal` (Caddy PKI) | `docker compose up -d` avec le compose principal. Avertissement navigateur normal (CA Caddy non reconnue par le système). |
| VM école | IP ou hostname de la VM | `tls internal` | Même config. Pour supprimer l'avertissement : exporter la CA du volume `caddy_data` et la faire reconnaître par le navigateur. |
| VM de prod avec domaine | `enervision.xxx` | Auto-TLS Let's Encrypt | Retirer `tls internal` du Caddyfile. Ports 80 et 443 ouverts publiquement requis pour la vérification ACME. |

## Tests effectués

Test 1 — Logs Caddy - `docker compose logs caddy`

```powershell
PS C:\eni\enerVision> docker compose logs caddy
[...]
caddy-1  | {"level":"info","ts":1789982868.0786734,"msg":"certificate installed properly in linux trusts"}
caddy-1  | {"level":"info","ts":1789982868.0788498,"msg":"autosaved config (load with --resume flag)","file":"/config/caddy/autosave.json"}
caddy-1  | {"level":"info","ts":1789982868.0788786,"msg":"serving initial configuration"}
```

---

Test 2 — Le proxy répond `curl.exe -k -v https://localhost/`

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

Test 3 — HTTP redirige vers HTTPS - `curl.exe -I http://localhost/`

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

Test 4 — En-têtes de sécurité - `curl.exe -k -I https://localhost/`

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

Test 5 — Dashboard non joignable directement - `curl.exe http://localhost:3000/`

```powershell
PS C:\eni\enerVision> curl.exe http://localhost:3000/
curl: (7) Failed to connect to localhost port 3000 after 2258 ms: Could not connect to server
```

---

Test 6 — Isolation réseau (Caddy ne voit pas ml) - `docker compose exec caddy wget -qO- http://ml:8000/ 2>&1`

```powershell
PS C:\eni\enerVision> docker compose exec caddy wget -qO- http://ml:8000/ 2>&1
wget: bad address 'ml:8000'
```