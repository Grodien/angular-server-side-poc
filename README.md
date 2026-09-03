# Driver Advisory System

Zwei Projekte:

- `api/` – Node.js/Express REST-API mit CRUD für die Tabelle `company`, geschützt per API-Key, mit PostgreSQL-Anbindung.
- `web/` – Angular-App mit Server-Side Rendering (SSR). Die API wird server-seitig angebunden, damit der API-Key nie im Browser landet.

## Architektur

```
Browser
  │  GET /            (Seitenaufruf)
  │  POST /companies/create | /:id/update | /:id/delete   (native HTML-Forms)
  ▼
Angular SSR Server (Express)
  │  - Lesen: im Resolver während des Server-Side-Renderings
  │  - Schreiben: Form-Handler (Post/Redirect/Get)
  │  fügt x-api-key: DUMMY123 hinzu  ── nur server-seitig
  ▼
Node.js API (127.0.0.1:3000, prüft API-Key)
  ▼
PostgreSQL (driver_advisory_system)
```

Wichtig: Es gibt **keinen** öffentlichen JSON-Proxy mehr. Die Backend-API wird
ausschließlich innerhalb des SSR-Prozesses angesprochen:

- **Lesen** passiert im Route-Resolver (`company.resolver.ts`) während des
  Renderings. Die Daten werden als hydrierter State an den Browser übergeben –
  kein Client-seitiger API-Aufruf.
- **Schreiben** (Anlegen/Bearbeiten/Löschen) erfolgt über native HTML-Formulare,
  die per POST an server-seitige Endpunkte gehen. Diese führen die Aktion mit dem
  API-Key aus und leiten anschließend auf `/` zurück (Post/Redirect/Get).

Damit hat für den regulären UI-Fluss nur der Server Zugriff auf die API; der
API-Key verlässt den Server nie.

### Durchleitender `/api`-Proxy (ohne Key-Injection)

Zusätzlich stellt der Web-Server unter `/api/*` einen transparenten Proxy zur
Backend-API bereit. Dieser fügt **keinen** API-Key hinzu – der Aufrufer muss den
Key selbst mitgeben (Header `x-api-key` oder Query-Parameter `?apiKey=`). Alles
(Methode, Header, Query, Body) wird unverändert an die API weitergeleitet.

```bash
# ohne Key -> 401 (der Proxy ergänzt nichts)
curl http://localhost:4000/api/companies

# mit Query-Key
curl "http://localhost:4000/api/companies?apiKey=DUMMY123"

# mit Header-Key
curl -H "x-api-key: DUMMY123" http://localhost:4000/api/companies
```

Abgrenzung: Die Form-Handler (`/companies/create` usw.) injizieren den Key
server-seitig für die UI. Der `/api`-Proxy reicht hingegen nur durch und
verlangt, dass der Client den Key selbst liefert.

## 1. API starten

```bash
cd api
npm install
# .env ist bereits vorbereitet (nicht eingecheckt). Werte bei Bedarf anpassen.
npm run migrate   # legt die Tabelle "company" an
npm start         # startet die API auf http://localhost:3000
```

### Endpoints (alle erfordern Header `x-api-key: DUMMY123`)

| Methode | Pfad              | Beschreibung          |
|---------|-------------------|-----------------------|
| GET     | `/companies`      | Alle Firmen           |
| GET     | `/companies/:id`  | Eine Firma            |
| POST    | `/companies`      | Firma anlegen         |
| PUT     | `/companies/:id`  | Firma aktualisieren   |
| DELETE  | `/companies/:id`  | Firma löschen         |
| GET     | `/health`         | Health-Check (offen)  |

Der API-Key kann auf zwei Arten übergeben werden:

```bash
# Bevorzugt: als Header
curl -H "x-api-key: DUMMY123" http://localhost:3000/companies

# Alternativ: als URL-Query-Parameter
curl "http://localhost:3000/companies?apiKey=DUMMY123"
```

Hinweis: Der Key in der URL ist weniger sicher (landet in Logs, Browser-History,
Referrer). Für Produktivbetrieb ist der Header vorzuziehen.

## 2. Web (Angular SSR) starten

```bash
cd web
npm install
npm run build
# API_BASE_URL und API_KEY werden server-seitig gelesen (Defaults: localhost:3000 / DUMMY123)
API_KEY=DUMMY123 API_BASE_URL=http://localhost:3000 npm run serve:ssr:web
# App unter http://localhost:4000
```

Für die lokale Entwicklung mit Live-Reload:

```bash
cd web
npm start   # http://localhost:4000, proxyt /api serverseitig
```

## Sicherheit / .env

- `api/.env` enthält die DB-Zugangsdaten und den API-Key und ist per `.gitignore`
  ausgeschlossen. `api/.env.example` dient als Vorlage.
- Der API-Key ist zu Beginn statisch `DUMMY123`. Später leicht austauschbar über
  die Umgebungsvariable `API_KEY`.
- Die JDBC-URL `jdbc:postgresql://localhost:5432/driver_advisory_system` wurde in
  Host/Port/DB-Name aufgeteilt, da der Node-`pg`-Treiber keine JDBC-URLs nutzt.

## Tabelle `company`

Die API ist an das bestehende Schema angepasst:

| Spalte       | Typ     | Hinweis            |
|--------------|---------|--------------------|
| `id`         | integer | Primary Key        |
| `code`       | text    | erforderlich       |
| `short_name` | text    | optional           |
| `tenant_id`  | integer | optional           |

Beim Anlegen wird die neue `id` als `MAX(id)+1` ermittelt, da die Tabelle keine
Sequence auf `id` besitzt.
