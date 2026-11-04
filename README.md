# Final Reckoning

Final Reckoning is a Next.js web application that brings Canvas assessments,
deadlines, grades, and timetable events into one student-focused dashboard.
It is designed for institutions using the Canvas LMS. Each user connects their
own Canvas account with a personal API token.

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
2. The user saves their own Canvas API token in Settings. Canvas data is only
   ever requested with the signed-in user's token.
3. The server requests the user's courses and assignments from Canvas,
   following Canvas pagination links until all pages have been collected.
4. Assignments with due dates are normalized and grouped by Canvas term and
   course.
5. The dashboard presents the data as lists, a calendar, a timetable, and an
   assessment predictor. The browser stores hidden-assessment preferences
   locally.
6. The assessment API keeps an in-memory cache for up to 30 minutes and
   refreshes stale data when the user next requests it. The cache holds
   assessment data only, never tokens, and a user's entries are removed when
   they log out or change their Canvas settings.

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

`npm run dev` and `npm run build` use webpack rather than Turbopack. Turbopack
adds an inline script to every page, which the production Content Security
Policy blocks, so a Turbopack production build would load but not run any of its
JavaScript. A deployment must use `npm run build`, not a plain `next build`.

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

To change the default Canvas address for new users, also configure:

```env
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

Register at `/register`, then open Settings in the dashboard and save your
Canvas API token. You can also choose your Canvas base URL and add a timetable
link there.

## Environment variables

The complete template is in `.env.example`.

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes for accounts | Neon/Postgres connection string. It should normally include `sslmode=require`. |
| `ENCRYPTION_KEY` | Yes for saved user settings | Secret used to derive the AES-256-GCM encryption key. It must contain at least 16 characters; use a long random value in practice. |
| `CANVAS_BASE_URL` | Optional | Default Canvas API base URL for users who have not chosen one. Defaults to `https://rmit.instructure.com/api/v1/`. It is normalized to the `/api/v1/` path. |
| `NODE_ENV` | Optional | `development` or `production`. Production enables the `Secure` session cookie and HSTS. |
| `PORT` | Optional | Local server port. The default is `3000`. |
| `HOST` | Optional | Runtime host setting used by configuration diagnostics. The default is `0.0.0.0`. |

Generate an encryption key with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

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
| `GET` | `/api/assessments/due` | Required | Aggregates the signed-in user's due assignments by term and course. |
| `GET` | `/api/assessments/export.ics` | Required | Generates a downloadable calendar containing the signed-in user's future assessments from active courses. |

Both routes return `401` without a session. A signed-in user who has not saved a
Canvas token receives `401` with `requiresSetup: true`.

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

### Timetable

| Method | Route | Authentication | Description |
| --- | --- | --- | --- |
| `GET` | `/api/timetable` | Required | Fetches and parses the signed-in user's saved iCalendar subscription. |

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

Timetable URLs must use HTTPS, point to a public address, and return an
iCalendar document containing `BEGIN:VCALENDAR`. Redirects are not followed, so
save the final address of the subscription. The server:

- Fetches the subscription with a ten-second timeout and a 5 MB size limit
- Parses `VEVENT` entries
- Reads summary, location, description, start, end, and UID fields
- Handles folded iCalendar lines and common escaped text values
- Returns normalized JSON events for the dashboard

The route returns `401` without a session, `400` for missing or disallowed
links, `502` for fetch failures and redirects, and `504` for a subscription
timeout.

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
- Next.js sends `Content-Security-Policy`, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` headers.
  Production also sends HSTS.
- Canvas assignment descriptions are sanitized with DOMPurify before being
  rendered in the dashboard. Only a small allow-list of tags and safe `http`,
  `https`, and `mailto` links is retained.
- Timetable links are fetched with server-side request forgery protections:
  HTTPS only, public addresses only, no redirects, and time and size limits.
- API routes do not send permissive CORS headers or internal error details.
- SQL values are parameterized through the Neon client.

Operational recommendations:

- Use HTTPS in every deployed environment.
- Keep `DATABASE_URL`, `ENCRYPTION_KEY`, and Canvas tokens out of source
  control and logs.
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
│       └── timetable.js                # iCalendar parser endpoint
├── lib/
│   ├── auth.js                         # Passwords, sessions, cookies, validation
│   ├── canvas-url.js                   # Canvas URL validation/normalization
│   ├── config.js                       # Runtime configuration and headers
│   ├── dashboard-route.js              # Dashboard route helper
│   ├── db.js                            # Neon connection, schema, user/session queries
│   ├── due-cache.js                    # In-memory assessment cache
│   ├── encrypt.js                      # AES-256-GCM field encryption
│   ├── middleware.js                   # Authenticated request helpers
│   ├── rate-limit.js                   # In-memory auth rate limiter
│   ├── safe-fetch.js                   # Guarded fetching of user-supplied URLs
│   └── sanitize-html.js                # Canvas description sanitizer
├── styles/                             # Global styles and CSS modules
├── tests/
│   ├── api-access.test.js              # Access rules for data routes
│   ├── config.test.js                  # Runtime configuration/security-header tests
│   ├── due-cache.test.js               # Assessment cache limits and clearing
│   ├── safe-fetch.test.js              # URL and address safety checks
│   └── sanitize-html.test.js           # Sanitizer attack and formatting cases
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
2. Add `DATABASE_URL` and `ENCRYPTION_KEY` under the Vercel project's
   Environment Variables, plus `CANVAS_BASE_URL` if you want a different default.
3. Deploy.
4. Open `/register` and verify database initialization, authentication, Canvas
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
- Do not include `Bearer` or quotes.
- Confirm the Canvas URL belongs to the correct institution and ends in
  `/api/v1/`.

### No assessments appear

- Confirm the user has saved a valid token in Settings.
- Confirm the user is enrolled in courses recognized as active.
- Confirm assignments have Canvas due dates.
- Use the dashboard refresh control or request
  `/api/assessments/due?sync=true`.
- Check the browser and server logs for Canvas API errors.

### Timetable is empty or fails to load

- Confirm the URL is a subscription URL, not a calendar webpage.
- Confirm it uses `https://` and does not redirect to another address.
- Confirm it returns an iCalendar document containing `BEGIN:VCALENDAR`.
- Verify that the URL is reachable from the deployed server.
- Check that events include both `DTSTART` and `DTEND`.

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
- Per-course Canvas assignment fetches are performed concurrently. Institutions
  with many courses may need to consider Canvas rate limits and deployment
  function duration.
- The in-memory login/register limiter is per process. A multi-instance
  deployment should add a shared rate-limit store if globally coordinated
  throttling is required.

## License

The `package.json` declares the project license as `ISC`.
