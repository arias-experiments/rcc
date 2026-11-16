# RCC

Node 22 / Express application with PostgreSQL-backed authentication sessions
and a buildless HTML/CSS/browser JavaScript frontend.

Set `DATABASE_URL` in `.env` (see `.env.example`), install dependencies with
`npm ci`, and start the API with `npm start`. The default port is 3000.
`NODE_ENV=production` enables Secure session cookies and requires HTTPS.

For an existing Phase 1 database, apply the session migration once:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/002_auth_sessions.sql
```

For an existing Phase 2 database, apply the records constraints once:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/003_record_constraints.sql
```

For a fresh database, apply migrations `001`, `002`, and `003` in order.
The `psql` command requires `DATABASE_URL` in your shell environment; it does not
read `.env` automatically. Existing Docker volumes need the migration applied
explicitly.

Authentication endpoints:

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/api/auth/register` | Accepts `username`, `displayName`, `password`; returns safe user and session cookie (201). |
| POST | `/api/auth/login` | Accepts `username`, `password`; returns safe user and a new session cookie (200). |
| POST | `/api/auth/logout` | Revokes the supplied session and clears its cookie (204). |
| GET | `/api/auth/me` | Returns the authenticated user (200), or 401. |

User responses contain only `id`, `username`, and `displayName`. IDs are strings
to preserve PostgreSQL BIGINT precision. Usernames are normalized to lowercase.
Passwords use bcrypt cost 12. Seven-day sessions store only a SHA-256 hash of a
32-byte random token; the raw token is held in the HttpOnly `rcc_session` cookie.
Registration creates the user and session in one transaction.

Records endpoints all require the session cookie:

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/records` | Lists only owned records, ordered by `recordedAt` and then ID descending. |
| GET | `/api/records/:id` | Returns an owned record. |
| POST | `/api/records` | Creates an owned record (201); omitted `recordedAt` defaults to database time. |
| PATCH | `/api/records/:id` | Updates a non-empty subset of editable fields. |
| PUT | `/api/records/:id` | Replaces all editable fields; every field must be present. |
| DELETE | `/api/records/:id` | Deletes an owned record (204). |

Editable fields are `recordedAt`, `glicemia`, `cetonemia`, `horasAyuno`, `dolor`,
`anergia`, `fatiga`, `inatencion`, `estres`, `somnolencia`, `insomnio`, and
`comentario`. Unknown fields and client-supplied ownership or metadata are rejected
with 400. Record responses use camelCase, string BIGINT IDs, JSON numbers for
measurements, and UTC timestamps. Ownership and authentication data are excluded.
Missing and unowned records both return the same 404 response.

`recordedAt` must be an ISO calendar date/time with `T` and an explicit `Z` or
`+/-HH:mm` timezone; invalid calendar dates are rejected. All other editable fields
accept null. Non-null glicemia must be positive, cetonemia and horasAyuno must be
nonnegative, gauges must be integers 1–5, and comments allow up to 500 Unicode
characters. PostgreSQL stores measurements to two decimal places (maximum
9999.99 for glicemia/cetonemia and 999.99 for horasAyuno); overflow and values that
round outside the database constraints return 400.

Run `npm test` against a writable PostgreSQL database with all migrations applied.
Tests start the app on a temporary local port and exercise real HTTP requests and
database state, including isolation between two users. They create unique test
users and remove them and their sessions/records afterward. To use a
dedicated test database, set `DATABASE_URL` when running `npm test`.

## Phase 4 frontend

Open `/login` or `/register` after `npm start`. `/` serves the application shell;
it checks `/api/auth/me` and redirects unauthenticated browsers to `/login`.
Authenticated visitors to either authentication page are redirected to `/`.
Registration creates a session automatically. Logout revokes the session before
redirecting to `/login`. The shell displays the user's name and navigation. Phase 5 adds the daily record
form; Phase 6 adds Historial and Phase 7 adds Gráficas. Ajustes remains a placeholder.

The modular frontend lives in `public/`. There is no frontend build step or
external UI dependency. Assets and API calls use the same origin, and the browser
manages the existing HttpOnly cookie. No authentication data is stored in browser
storage. The API continues to enforce authentication and record ownership.

For a Vercel deployment, retain the Node/Express backend and PostgreSQL connection,
include `public/` with the server files, and route UI and API requests through the
Express application. Use HTTPS and `NODE_ENV=production` for Secure cookies.
Do not deploy `public/` alone as a separate authentication backend. No deployment
configuration or hosting resources are created by this phase.

Manual browser checklist (with PostgreSQL running):

- Open `/` without a session and confirm redirection to `/login`.
- Register at `/register`; check mismatched passwords and duplicate usernames,
  then create an account and confirm `/` displays its name.
- Refresh `/` and visit `/login` and `/register` while signed in; all should keep
  you in the application.
- Log out and confirm `/login` appears. Try incorrect credentials, then log in.
- In browser developer tools, confirm local/session storage contain no auth data
  and `document.cookie` cannot access `rcc_session`.
- Check both narrow mobile and desktop layouts. Simulate a network failure and
  confirm an error and a retry path appear.

## Phase 5: Registro diario

The authenticated `/` page now provides three optional measurements, seven
optional 1–5 indicators, a comment, and a local date/time control. Each indicator
has an explicit “Sin seleccionar” option and supports native radio-button
keyboard navigation. Comment input is limited to 500 Unicode characters,
matching the API, including pasted emoji.

`public/js/records.js` validates inputs, converts the local timestamp to UTC ISO,
and posts only the editable fields to `/api/records`. Empty optional fields are
sent as `null`. Glicemia must be positive; cetonemia and horasAyuno must be
nonnegative. No medical maximum is imposed by the UI. Storage precision errors
from the existing API receive a Spanish validation message.

Only HTTP 201 confirms a save. Success clears all fields and indicators, restores
the current local time, and announces “Registro guardado correctamente” inline.
Limpiar performs the same local reset without an API request. Failed requests
preserve the draft for retry; 401 redirects to `/login`. No health records are
written to browser storage. The daily-entry page makes no record listing request.

Additional manual checks:

- Submit zero/negative glicemia and negative cetonemia/horasAyuno; confirm inline
  errors and no request. Zero cetonemia/horasAyuno must be accepted.
- Select each indicator by mouse and keyboard, then choose Sin seleccionar.
- Paste more than 500 characters, including emoji; confirm truncation and counter.
- Save a populated form and inspect the POST body and PostgreSQL row. Confirm the
  UTC conversion, absence of user IDs, success message, and complete reset.
- Save with optional fields empty; confirm they are sent as null.
- Use Limpiar; confirm the current local date/time returns without a request.
- Simulate 400, 401, 500, and network failures. Confirm Spanish feedback, login
  redirection for 401, and retained input for retry on other failures.
- Check the three-card desktop row and stacked mobile measurements, indicators,
  and action buttons.

## Phase 6: Historial

`/historial` checks the existing session before fetching the signed-in user's
records. Sidebar links connect Registro (`/`) and Historial (`/historial`). The
list preserves backend order, formats dates with `Intl.DateTimeFormat` in the
browser's timezone, and shows missing measurements as an em dash. Narrow screens
use stacked cards. Loading, retry, and first-record empty states are included.

Each keyboard-accessible entry opens a native modal dialog with every measurement,
symptom, and comment. User content is rendered as text. Edit mode reuses the
creation form markup and validation through `record-form-view.js` and
`record-form.js`; the authenticated shell is shared through `app-shell.js`.

Edits send only changed editable fields via PATCH. An unchanged date preserves the
original timestamp, including seconds and milliseconds, and an unchanged form
makes no request. Successful edits update both detail and history without page
reload; a changed date reorders its entry. Deletion requires an explicit native
confirmation dialog, initially focused on Cancelar, and removes the entry only
after HTTP 204. Escape dismisses idle dialogs; requests disable mutation controls.

A 401 redirects to login. A 404 during detail, edit, or delete closes the unavailable
record, explains what happened, and reloads the list. Unexpected errors are generic
Spanish messages and allow retry. Existing backend authorization is unchanged.

Additional manual checks:

- Verify user isolation with two accounts and newest-first local dates.
- Open entries with mouse and keyboard; inspect all values and multiline comments.
- Edit measurements, gauges, comment, and date. Check the minimal PATCH payload,
  database values, row update/order, and original timestamp when date is untouched.
- Cancel editing and cancel deletion; confirm no mutation occurs.
- Confirm deletion, then check local removal and the last-record empty state.
- Remove a record in another session while editing/deleting it; verify 404 refresh.
- Expire the session before loading, editing, or deleting; verify login redirection.
- Test list/network failure and retry, inline validation, dialog focus/Escape, and
  desktop rows/mobile cards at narrow widths.

## Phase 7: Gráficas

`/graficas` uses the shared authenticated shell and fetches `/api/records` once.
Period and chart selectors work entirely in browser memory. The default 30-day
period, 7-day and 90-day presets include today and the preceding calendar days,
ending at the next local midnight. Todo includes all records. Personalizado uses
inclusive browser-local start/end dates; calendar operations handle daylight-saving
changes without fixed timezone offsets. Invalid custom ranges show validation.

Chart.js is pinned to **4.6.1**, loaded as the UMD browser build from jsDelivr:
`https://cdn.jsdelivr.net/npm/chart.js@4.6.1/dist/chart.umd.min.js`.
`chart-library.js` verifies the version and a SHA-384 integrity hash. No bundler,
chart adapter, frontend package dependency, or external analytics service is used.
The CDN receives only the library request; RCC records render locally. A failed
library request can be retried without refetching successfully loaded records.

The page includes null-safe descriptive averages, three measurement line charts,
a selectable symptom chart with integer 1–5 ticks, and three pairwise scatter
comparisons. Line plots use numeric timestamps on a linear x-axis with local-date
labels and local date/time tooltips, so irregular recording intervals retain their
temporal spacing without a date adapter. Nulls remain gaps. Scatter points require
both values and retain only the measurements and timestamp needed for tooltips.
No overall symptom score, correlation, regression, or medical interpretation is
computed. Chart instances are destroyed before replacements and on page exit.

Empty periods, missing individual measurements/symptoms, and missing comparison
pairs have separate empty states. Unexpected API/CDN failures provide Spanish retry
messages; 401 redirects to login. Every chart has a visible title, units, accessible
canvas label, and nearby available-point count. Chart cards stack on mobile.

`npm test` covers existing integrations, `/graficas` and shared assets, local-date
boundaries across daylight-saving changes, null-safe averages and plot points, and
source-array ordering. Additional manual browser checks:

- Exercise all periods, including a single local day and midnight boundaries.
- Check null gaps, real zeros, summary averages, seven symptoms, all comparisons,
  and date/value tooltips.
- Repeat filters and resize the page; verify there are no duplicate Chart instances
  or extra records requests.
- Check empty periods and missing-data states, API/CDN retry, and session expiry.
- Inspect narrow mobile layouts, chart labels, keyboard controls, and browser
  storage/network/console for unintended health-data persistence or transmission.
