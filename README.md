# RCC

Node 22 / Express API with PostgreSQL-backed authentication sessions.

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
