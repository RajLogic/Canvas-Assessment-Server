# Final Reckoning

Final Reckoning is a Next.js web application that brings Canvas assessments,
deadlines, grades, and timetable events into one student-focused dashboard.
It is designed for institutions using the Canvas LMS and supports both a
server-wide Canvas configuration and optional per-user Canvas settings.

The application includes:

- Account registration, login, logout, and seven-day cookie sessions
- Canvas course and assignment retrieval with pagination
- Upcoming assessment aggregation grouped by term and course
- Assessment search, sorting, urgency filters, semester/year/course filters,
  calendar view, and hidden-assessment management
- Submission status, scores, points, descriptions, rubrics, and Canvas links
- Timetable import from an iCalendar (`.ics`) subscription URL
- Upcoming-assessment calendar export as an iCalendar (`.ics`) file
- Per-user Canvas token, Canvas URL, timetable URL, and dashboard-version
  settings
- Neon Serverless Postgres persistence
- Encrypted storage for Canvas API tokens and timetable links
- Request rate limiting for registration and login
- Production security headers and deployment support for Vercel

## Contents

- [How it works](#how-it-works)
- [Technology](#technology)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Database](#database)
- [Using the application](#using-the-application)
- [HTTP API](#http-api)
- [Canvas integration](#canvas-integration)
- [Timetable integration](#timetable-integration)
- [Security and privacy](#security-and-privacy)
- [Project structure](#project-structure)
- [Development commands](#development-commands)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Limitations and operational notes](#limitations-and-operational-notes)
- [License](#license)

## How it works

1. A user creates an account or signs in with an email address or username.
2. Canvas credentials are taken from the user's saved settings when present.
   Otherwise, the server-wide Canvas environment variables are used.
3. The server requests the user's courses and assignments from Canvas,
   following Canvas pagination links until all pages have been collected.
4. Assignments with due dates are normalized and grouped by Canvas term and
   course.
5. The dashboard presents the data as lists, a calendar, a timetable, and an
   assessment predictor. The browser stores hidden-assessment preferences
   locally.
6. The assessment API keeps an in-memory cache for up to 30 minutes and
   refreshes stale data in the background where possible.

Canvas tokens are never sent to the browser. The browser calls this
application's API routes, and the server calls Canvas.

## Technology

- [Next.js](https://nextjs.org/) 16 with the Pages Router
- React 19
- Node.js native `fetch`
- Neon Serverless Postgres
- Node.js `crypto` for PBKDF2 password hashing and AES-256-GCM field
  encryption
- ESLint 10 with the Next.js configuration

The project is an ES module package (`"type": "module"`). The configured
runtime requirement is Node.js 20 or newer.

## Requirements

- Node.js 20+
- npm
- A Canvas API token with permission to read the user's courses and
  assignments
- A Neon Postgres database, or another Postgres-compatible Neon connection
  endpoint
- An `ENCRYPTION_KEY` for storing user secrets safely
- An iCalendar subscription URL if timetable integration is required

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create local configuration

Copy `.env.example` to `.env.local` and fill in the values:

```powershell
Copy-Item .env.example .env.local
```

Do not commit `.env`, `.env.local`, or any other file containing real tokens,
database URLs, or encryption keys.

### 3. Configure the required values

At minimum, configure:

```env
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=generate-a-long-random-secret
```

For a server-wide Canvas fallback, also configure:

```env
API_KEY=your_raw_canvas_api_token
CANVAS_BASE_URL=https://your-school.instructure.com/api/v1/
```

The database tables are created automatically when registration or login first
initializes the database.

### 4. Start development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Create an account and configure Canvas

Register at `/register`, then open Settings in the dashboard. A user can save
their own Canvas API token and Canvas base URL, which take precedence over the
server-wide fallback values.

## Environment variables

The complete template is in `.env.example`.

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes for accounts | Neon/Postgres connection string. It should normally include `sslmode=require`. |
| `ENCRYPTION_KEY` | Yes for saved user settings | Secret used to derive the AES-256-GCM encryption key. It must contain at least 16 characters; use a long random value in practice. |
| `API_KEY` | Recommended fallback | Server-wide raw Canvas API token. Per-user tokens override it. |
| `CANVAS_API_TOKEN` | Alternative | Alias for `API_KEY`. |
| `CANVAS_TOKEN` | Alternative | Alias for `API_KEY`. |
| `CANVAS_ACCESS_TOKEN` | Alternative | Alias for `API_KEY`. |
| `CANVAS_BASE_URL` | Optional | Server-wide Canvas API base URL. Defaults to `https://rmit.instructure.com/api/v1/`. It is normalized to the `/api/v1/` path. |
| `TIMETABLE_LINK` | Optional | Server-wide iCalendar subscription URL. Per-user timetable links override it. |
| `NODE_ENV` | Optional | `development` or `production`. Production enables the `Secure` session cookie and HSTS. |
| `PORT` | Optional | Local server port. The default is `3000`. |
| `HOST` | Optional | Runtime host setting used by configuration diagnostics. The default is `0.0.0.0`. |

Generate an encryption key with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`API_KEY` must be the token itself. Do not include an assignment such as
`API_KEY=...`, surrounding quotes, or a `Bearer ` prefix. The Canvas token
aliases are accepted for compatibility, but `API_KEY` is the preferred name.

### Encryption-key rotation

User Canvas tokens and timetable links are encrypted before they are stored.
Changing `ENCRYPTION_KEY` makes existing encrypted values unreadable; users
will need to enter their credentials and links again. Treat the key as
production data and store it in the deployment provider's secret settings.

## Database

The application uses Neon Serverless Postgres through
`@neondatabase/serverless`. `initializeDatabase()` runs the required
idempotent schema statements:

### `users`

Stores:

- `email` and `username` (unique)
- PBKDF2 password hash
- Encrypted Canvas API token
- Encrypted timetable link
- Plain Canvas base URL
- Dashboard version preference
- Creation and update timestamps

### `sessions`

Stores:

- Random session ID
- Related user ID
- Expiration timestamp
- Creation timestamp

Sessions expire after seven days. Expired sessions are ignored during lookup
and can be removed with the database cleanup helper.

No migration runner is required for the current schema. The application uses
`CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
for the columns it owns.

## Using the application

### Landing page

`/` provides the public landing page and links to login and registration.
Authenticated users are redirected to the dashboard.

### Authentication

- `/register` creates an account using email, username, and password.
- `/login` accepts either email or username.
- Passwords must contain at least eight characters.
- Usernames must be 3–30 characters and may contain letters, numbers,
  underscores, and hyphens.
- The session is stored in an HTTP-only `ct_session` cookie.

### Dashboard

The dashboard can display:

- Active/upcoming assessments
- Passed assessments from the current year
- Older assessments
- Hidden assessments
- Calendar view
- Timetable events
- Assessment predictor
- Settings

Assessment cards can show due date/time, urgency, points, submission status,
score, percentage, description, rubric link, and the original Canvas page.

Available controls include:

- Search by assessment name, course, or term
- Filter by year, semester, course code, or course
- Sort by due date, course name, points, or assessment name
- Toggle ascending or descending order
- Filter by urgency: five days or less, two weeks or less, or more than two
  weeks
- Hide individual assessments or all assessments for a course
- Restore hidden assessments or clear all hidden items
- Refresh Canvas data

Hidden assessment IDs are stored in browser `localStorage` under
`fr_hidden_assessments`; they are not stored in Postgres and do not follow a
user to another browser.

## HTTP API

All routes are served by Next.js API routes under `/api`.

### Authentication routes

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Creates a user, initializes the database, creates a session, and sets the session cookie. |
| `POST` | `/api/auth/login` | Authenticates with email or username and sets a seven-day session cookie. |
| `GET` | `/api/auth/session` | Returns the current authentication state and safe user configuration flags. It never returns a raw token. |
| `POST` | `/api/auth/session` | Logs out and clears the session cookie. Kept for compatibility; `/api/auth/logout` is also available. |
| `POST` | `/api/auth/logout` | Deletes the current session when possible and clears the session cookie. |
| `POST`, `PUT` | `/api/auth/settings` | Saves authenticated-user Canvas, timetable, and dashboard settings. |

Registration is limited to five attempts per IP per 30 minutes. Login is
limited to ten attempts per IP per 15 minutes. Rate-limit response headers
include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and, when blocked,
`Retry-After`.

### Canvas and assessment routes

| Method | Route | Authentication | Description |
| --- | --- | --- | --- |
| `GET` | `/api/courses` | No application session required | Returns Canvas courses using the server-wide Canvas configuration. |
| `GET` | `/api/courses/[courseId]/assignments` | No application session required | Returns assignments for a Canvas course using the server-wide configuration. |
| `GET` | `/api/assessments/due` | Optional; required for per-user settings | Aggregates due assignments by term and course. Uses the user's token/URL when authenticated and the server fallback otherwise. |
| `GET` | `/api/assessments/export.ics` | Optional; required for per-user settings | Generates a downloadable calendar containing future assessments from active courses. |

`/api/assessments/due` supports these query parameters:

| Parameter | Description |
| --- | --- |
| `search` | Search term applied to term, course, and assessment names. |
| `q` | Alias for `search`. |
| `term` | Backward-compatible alias for `search`. |
| `onlyActive` | Defaults to true. Set to `false` to include past due assessments. |
| `sync` | Set to `true` or `1` to force an origin refresh instead of using cached data. |

The response includes `generatedAt`, `totalAssessments`, `totalTerms`,
`canvasBaseUrl`, grouped `terms`, and `_cache` metadata. The route caches
results in process memory for 30 minutes. Cache entries are separated by user,
Canvas base URL, and active/past selection.

### Timetable and diagnostics

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/timetable` | Fetches and parses an iCalendar subscription. A query `link` takes precedence, followed by the authenticated user's link, then `TIMETABLE_LINK`. |
| `GET` | `/api/health/canvas-auth` | Returns safe Canvas token diagnostics, runtime configuration flags, base URL status, token source, token length, and a short token fingerprint. |

The health endpoint intentionally does not expose a token value. It is still
diagnostic information and should not be exposed publicly without considering
your deployment's access controls.

## Canvas integration

Canvas base URLs must use HTTPS and include `/api/v1`, for example:

```text
https://university.instructure.com/api/v1/
```

The application:

- Requests active, completed, and past courses with enrollments and terms
- Follows Canvas `Link` headers for pagination
- Fetches assignments with submissions
- Treats courses with active enrollments or an available workflow state as
  active
- Includes assignments with a `due_at` value
- Groups results by Canvas term and course
- Sorts assessments by due timestamp
- Filters future assessments by default
- Preserves Canvas URLs for opening assignment details and rubrics

If a Canvas response returns `401`, the API reports an invalid or expired
token and the dashboard asks the user to update Settings.

## Timetable integration

Timetable URLs must be reachable over HTTP or HTTPS and return an iCalendar
document containing `BEGIN:VCALENDAR`. The server:

- Fetches the subscription with a ten-second timeout
- Parses `VEVENT` entries
- Reads summary, location, description, start, end, and UID fields
- Handles folded iCalendar lines and common escaped text values
- Returns normalized JSON events for the dashboard

The route returns `400` for missing/invalid configuration, `502` for fetch
failures, and `504` for a subscription timeout.

## Security and privacy

The application includes the following protections:

- Passwords are hashed with Node.js PBKDF2 using SHA-512, 100,000 iterations,
  and a random 32-byte salt.
- Session IDs are generated with cryptographically secure random bytes.
- Sessions use an HTTP-only, `SameSite=Lax` cookie; production cookies also
  use `Secure`.
- Canvas API tokens and timetable links are encrypted with AES-256-GCM before
  database storage.
- Canvas tokens remain server-side and are never returned by session APIs.
- Login and registration requests are rate limited.
- Next.js sends `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, and `Permissions-Policy` headers. Production also sends
  HSTS.
- Canvas assignment descriptions are sanitized before being rendered in the
  dashboard. Only a small allow-list of tags and safe `http`, `https`, and
  `mailto` links is retained.
- SQL values are parameterized through the Neon client.

Operational recommendations:

- Use HTTPS in every deployed environment.
- Keep `DATABASE_URL`, `ENCRYPTION_KEY`, and Canvas tokens out of source
  control and logs.
- Use per-user tokens where users should only see their own Canvas data.
- Restrict or protect diagnostic endpoints in public deployments.
- Do not enable insecure database TLS settings in production. If a local
  environment requires an insecure TLS workaround, fix the certificate chain
  instead of weakening production verification.

## Project structure

```text
.
├── pages/
│   ├── _app.js                         # Global CSS, document title, viewport
│   ├── _document.js                    # HTML shell, metadata, favicon
│   ├── index.js                        # Public landing page
│   ├── login.js                        # Login form
│   ├── register.js                     # Registration form
│   ├── dashboard.js                    # Authenticated dashboard UI
│   └── api/
│       ├── auth/
│       │   ├── login.js                # Login endpoint
│       │   ├── logout.js               # Logout endpoint
│       │   ├── register.js             # Registration endpoint
│       │   ├── session.js              # Session state and compatibility logout
│       │   └── settings.js             # Per-user settings endpoint
│       ├── assessments/
│       │   ├── due.js                  # Aggregated assessments
│       │   └── export.ics.js           # ICS export
│       ├── courses.js                  # Course endpoint
│       ├── timetable.js                # iCalendar parser endpoint
│       └── health/
│           └── canvas-auth.js          # Safe Canvas diagnostics
├── lib/
│   ├── auth.js                         # Passwords, sessions, cookies, validation
│   ├── canvas-url.js                   # Canvas URL validation/normalization
│   ├── canvasApi.js                    # Server-wide Canvas client
│   ├── config.js                       # Runtime configuration and headers
│   ├── dashboard-route.js              # Dashboard route helper
│   ├── db.js                            # Neon connection, schema, user/session queries
│   ├── encrypt.js                      # AES-256-GCM field encryption
│   ├── middleware.js                   # Authenticated request helpers
│   └── rate-limit.js                   # In-memory auth rate limiter
├── styles/                             # Global styles and CSS modules
├── tests/
│   └── config.test.js                  # Runtime configuration/security-header tests
├── public/
│   └── hell.png                        # Application logo/favicon
├── .env.example                        # Environment variable template
├── next.config.js                      # Next.js configuration
├── server.js                           # Backward-compatible configuration entry point
├── vercel.json                         # Vercel framework configuration
└── package.json                         # Scripts and dependencies
```

## Development commands

Install dependencies:

```bash
npm install
```

Start the development server with hot reload:

```bash
npm run dev
```

Run ESLint:

```bash
npm run lint
```

Run the Node.js test suite:

```bash
npm test
```

Create a production build:

```bash
npm run build
```

Start the production Next.js server:

```bash
npm start
```

`node server.js` is retained for backward compatibility. It loads environment
configuration and prints diagnostics, but Next.js handles the actual page and
API routing. Prefer `npm run dev` and `npm start`.

## Deployment

### Vercel

The repository includes `vercel.json` with the Next.js framework setting.

1. Import the repository into Vercel.
2. Add `DATABASE_URL`, `ENCRYPTION_KEY`, and the appropriate Canvas variables
   under the Vercel project's Environment Variables.
3. Add `TIMETABLE_LINK` only if a server-wide timetable fallback is wanted.
4. Deploy.
5. Open `/register` and verify database initialization, authentication, Canvas
   loading, and timetable loading.

Set `NODE_ENV=production` in the deployment environment. Vercel runs the
Next.js build automatically; the equivalent local verification is:

```bash
npm run lint
npm test
npm run build
```

### Other Node.js hosts

For a Node.js host:

```bash
npm ci
npm run build
npm start
```

Provide the environment variables through the host's secret manager. Put a
reverse proxy with HTTPS in front of the application when the host does not
provide TLS termination.

### Caching and serverless behavior

Assessment and rate-limit caches are in process memory. On serverless
platforms, they may be reset when an instance is recycled and may not be
shared between instances. The application remains correct because a cache
miss fetches fresh data, but cache warmth and rate-limit state are not global.

## Troubleshooting

### `Database connection failed`

- Confirm `DATABASE_URL` is present in the running environment.
- Confirm the Neon URL is complete and includes the required TLS settings.
- Check that the database is reachable from the deployment region.
- Restart the development server after editing `.env.local`.

### `ENCRYPTION_KEY` is missing or too short

Set a secret with at least 16 characters. Use a long random value, such as
the 64-character hexadecimal value generated by the command in
[Environment variables](#environment-variables). Changing it later requires
users to re-save encrypted settings.

### Canvas returns `401`

- Generate a new Canvas API token.
- Ensure the value is the raw token only.
- Do not include `Bearer`, quotes, or `API_KEY=`.
- Confirm the Canvas URL belongs to the correct institution and ends in
  `/api/v1/`.
- Check `/api/health/canvas-auth` for a safe token-presence and URL diagnostic.

### No assessments appear

- Confirm the user has a valid token or that `API_KEY` is configured.
- Confirm the user is enrolled in courses recognized as active.
- Confirm assignments have Canvas due dates.
- Use the dashboard refresh control or request
  `/api/assessments/due?sync=true`.
- Check the browser and server logs for Canvas API errors.

### Timetable is empty or fails to load

- Confirm the URL is a subscription URL, not a calendar webpage.
- Confirm it returns an iCalendar document containing `BEGIN:VCALENDAR`.
- Verify that the URL is reachable from the deployed server.
- Check that events include both `DTSTART` and `DTEND`.
- Remember that a query `link` overrides the user's saved link, which
  overrides `TIMETABLE_LINK`.

### Authentication appears to reset

- Confirm cookies are enabled.
- Use HTTPS in production so the `Secure` cookie can be stored.
- Confirm the database session row still exists and has not expired.
- Check that the deployment is using the same `DATABASE_URL` between
  requests.

## Limitations and operational notes

- Assessment data is fetched from Canvas and can be stale for up to 30 minutes
  unless a forced sync is requested.
- Assessment caching is process-local, not a shared distributed cache.
- Hidden assessments are browser-local and are not synchronized to the server.
- Timetable parsing supports the iCalendar fields needed by the dashboard but
  is not a full RFC 5545 recurrence engine.
- The public `/api/courses` and course-assignment routes use the server-wide
  Canvas token rather than the authenticated user's saved token. The
  authenticated dashboard uses `/api/assessments/due` and per-user settings.
- Per-course Canvas assignment fetches are performed concurrently. Institutions
  with many courses may need to consider Canvas rate limits and deployment
  function duration.
- The in-memory login/register limiter is per process. A multi-instance
  deployment should add a shared rate-limit store if globally coordinated
  throttling is required.

## License

The `package.json` declares the project license as `ISC`.
