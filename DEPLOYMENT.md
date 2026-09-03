# Deployment (systemd + Nginx)

Diese Anleitung deployt beide Komponenten direkt auf einem Linux-Server:

- **API** (`api/`) – Express, lauscht nur auf `127.0.0.1:3000`
- **Web/SSR** (`web/`) – Angular SSR, lauscht auf `127.0.0.1:4000`
- **Nginx** – terminiert TLS und proxyt von außen auf den SSR-Server
- **PostgreSQL** – wird als bereits vorhanden angenommen (lokal auf dem Server)

```
Internet ──► Nginx (:443, TLS) ──► Web/SSR (127.0.0.1:4000)
                                        │ server-seitig, injiziert API-Key
                                        ▼
                                   API (127.0.0.1:3000)  ← nicht öffentlich
                                        ▼
                                   PostgreSQL (127.0.0.1:5432)  ← nicht öffentlich
```

Nur Nginx ist von außen erreichbar. API und DB bleiben auf Loopback.

---

## 1. Voraussetzungen auf dem Server

```bash
# Node.js LTS (>= 20; das Projekt wurde mit Node 26 gebaut)
node --version

# Nginx
sudo apt-get update && sudo apt-get install -y nginx

# PostgreSQL läuft bereits und enthält die DB "driver_advisory_system".
```

## 2. Systemnutzer und Verzeichnisse

```bash
# Dedizierter, nicht privilegierter Nutzer ohne Login-Shell
sudo useradd --system --create-home --shell /usr/sbin/nologin bergportal

# Deploy-Verzeichnis
sudo mkdir -p /opt/bergportal
sudo chown bergportal:bergportal /opt/bergportal

# Verzeichnis für Environment-Files (außerhalb des Repos)
sudo mkdir -p /etc/bergportal
```

## 3. Code auf den Server bringen

Per Git-Clone oder rsync nach `/opt/bergportal` (Struktur: `/opt/bergportal/api`
und `/opt/bergportal/web`):

```bash
# Beispiel via rsync vom lokalen Rechner (ohne node_modules/dist):
rsync -av --exclude node_modules --exclude dist \
  ./ user@server:/opt/bergportal/
```

## 4. Bauen und Prod-Abhängigkeiten installieren

Auf dem Server:

```bash
cd /opt/bergportal
sudo -u bergportal bash deploy/build.sh
```

Das erzeugt:
- `api/node_modules` (nur Prod-Deps)
- `web/dist/web` (SSR-Bundle) + `web/node_modules` (nur Prod-Deps)

## 5. Environment-Files anlegen

```bash
# Vorlagen kopieren
sudo cp deploy/env/api.env.example /etc/bergportal/api.env
sudo cp deploy/env/web.env.example /etc/bergportal/web.env

# Werte anpassen: DB-Passwort, API_KEY, NG_ALLOWED_HOSTS (deine Domain)
sudo nano /etc/bergportal/api.env
sudo nano /etc/bergportal/web.env

# Rechte absichern (enthalten Secrets)
sudo chown bergportal:bergportal /etc/bergportal/*.env
sudo chmod 600 /etc/bergportal/*.env
```

Wichtige Werte:
- `api.env`: `HOST=127.0.0.1`, `DB_PASSWORD`, `API_KEY`
- `web.env`: `API_BASE_URL=http://127.0.0.1:3000`, `API_KEY` (gleich wie API),
  `PORT=4000`, `NG_ALLOWED_HOSTS=deine-domain.tld`

> Der `API_KEY` muss in beiden Files identisch sein, damit die server-seitige
> Anbindung akzeptiert wird.

## 6. (Einmalig) DB-Migration

Falls die Tabelle `company` noch nicht existiert:

```bash
cd /opt/bergportal/api
sudo -u bergportal env $(grep -v '^#' /etc/bergportal/api.env | xargs) node src/db/migrate.js
```

Existiert die Tabelle schon (wie bei euch), ist dieser Schritt unnötig –
`CREATE TABLE IF NOT EXISTS` überschreibt nichts.

## 7. systemd-Services installieren

```bash
sudo cp deploy/systemd/bergportal-api.service /etc/systemd/system/
sudo cp deploy/systemd/bergportal-web.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now bergportal-api.service
sudo systemctl enable --now bergportal-web.service

# Status prüfen
systemctl status bergportal-api.service
systemctl status bergportal-web.service

# Logs verfolgen
journalctl -u bergportal-api.service -f
journalctl -u bergportal-web.service -f
```

Lokaler Funktionstest auf dem Server:

```bash
curl -s http://127.0.0.1:3000/health                       # {"status":"ok"}
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4000/   # 200
```

## 8. Nginx einrichten

```bash
sudo cp deploy/nginx/bergportal.conf /etc/nginx/sites-available/bergportal
# server_name und Zertifikatspfade in der Datei anpassen!
sudo nano /etc/nginx/sites-available/bergportal

sudo ln -s /etc/nginx/sites-available/bergportal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 9. TLS-Zertifikat (Let's Encrypt)

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com -d www.example.com
```

Certbot trägt die Zertifikatspfade automatisch ein und richtet die Erneuerung
ein.

## 10. Firewall

Nur 80/443 nach außen öffnen; 3000/4000/5432 bleiben intern:

```bash
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Updates ausrollen

```bash
cd /opt/bergportal
# neuen Code holen (git pull / rsync), dann:
sudo -u bergportal bash deploy/build.sh
sudo systemctl restart bergportal-api.service bergportal-web.service
```

## Hinweise zur Sicherheit

- **API nur auf Loopback:** `HOST=127.0.0.1` in `api.env` sorgt dafür, dass die
  API nicht direkt aus dem Internet erreichbar ist. Der API-Key verlässt den
  Server nie über den regulären UI-Fluss.
- **Durchleitender `/api`-Proxy:** Der SSR-Server bietet unter `/api/*` einen
  transparenten Proxy ohne Key-Injection. Er ist über Nginx erreichbar. Wenn du
  das nicht möchtest, kommentiere den `location /api/`-Block in
  `deploy/nginx/bergportal.conf` ein (gibt dann `404` zurück).
- **Secrets:** Env-Files liegen unter `/etc/bergportal` mit `chmod 600` und
  gehören nicht ins Repo.
- **API-Key rotieren:** Nur `API_KEY` in beiden Env-Files ändern und beide
  Services neu starten.
