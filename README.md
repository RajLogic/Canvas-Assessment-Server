# Canvas Assessment Server - Next.js Integration

This project has been upgraded to use **Next.js** for a modern React-based frontend and API routes.

## What's New

- ✅ **Next.js 14** - React framework for production
- ✅ **API Routes** - Built-in API handlers in `/pages/api`
- ✅ **React Frontend** - Interactive UI for viewing courses
- ✅ **Custom Server** - Express server integration with Next.js
- ✅ **CORS Support** - Built-in CORS handling for all endpoints

## Project Structure

```
.
├── pages/                      # Next.js pages and API routes
│   ├── api/
│   │   ├── courses.js         # GET /api/courses
│   │   └── courses/[courseId]/assignments.js
│   └── index.js               # Frontend home page
├── lib/
│   └── canvasApi.js           # Shared Canvas API utilities
├── styles/
│   └── Home.module.css        # CSS modules
├── server.js                  # Custom Express server with Next.js
├── next.config.js             # Next.js configuration
├── package.json               # Dependencies
└── .env.local                 # Environment variables
```

## Installation

```bash
npm install
```

## Environment Setup

Create a `.env.local` file with your Canvas API token:

```env
API_KEY=your_canvas_api_token_here
CANVAS_BASE_URL=https://rmit.instructure.com/api/v1/
```

Notes:
- `API_KEY` is the primary variable; `CANVAS_API_TOKEN`, `CANVAS_TOKEN`, and `CANVAS_ACCESS_TOKEN` are also supported.
- Use the raw token only (do not include a `Bearer ` prefix or surrounding quotes).

## Running the Server

### Development Mode
```bash
npm run dev
```
Starts Next.js development server with hot reload on `http://localhost:3000`

### Production Build
```bash
npm run build
npm start
```

### Using Custom Server
```bash
node server.js
```
Runs with the custom Express server for more control

## API Endpoints

### Get All Courses
```
GET /api/courses
```
Returns an array of all Canvas courses for the authenticated user.

### Get Course Assignments
```
GET /api/courses/[courseId]/assignments
```
Returns assignments for a specific course.

## Frontend

Navigate to `http://localhost:3000` to see the interactive dashboard.

- View all enrolled courses
- Fetch and display course data
- Responsive design with gradient UI

## Dependencies

- **next** (^14.0.0) - React framework
- **react** (^18.2.0) - UI library
- **react-dom** (^18.2.0) - React DOM
- **express** (^4.21.2) - Web server
- **cors** (^2.8.5) - CORS middleware
- **dotenv** (^16.5.0) - Environment variables
- **node-fetch** (^2.6.1) - HTTP client

## Development

```bash
npm run lint      # Run ESLint
npm run build     # Build for production
npm run dev       # Start development server
```

## Notes

- API routes automatically handle CORS headers
- Canvas API token is required in environment variables
- The custom server (`server.js`) uses Express to wrap Next.js for maximum flexibility
- Authentication tokens are kept server-side and never exposed to the client
