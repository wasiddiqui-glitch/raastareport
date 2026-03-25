# RaastaReport

A full-stack civic tech web app for reporting and tracking road hazards in Pakistani cities. Citizens can report potholes, broken traffic lights, open manholes, and other hazards — with real-time updates, AI-powered analysis, and location-based filtering.

---

## Features

- **Hazard Reporting** — submit reports with title, type, description, city, area, and an optional photo
- **AI Photo Analysis** — upload a photo and GPT-4o Vision automatically identifies the hazard type and description
- **AI Severity Assessment** — GPT-4o mini rates each hazard as Low, Medium, High, or Critical on submission
- **AI Authority Report** — generate a formal report letter ready to send to local authorities
- **Interactive Map** — all hazards plotted on a Leaflet map with color-coded markers by status; click any marker to open the detail modal
- **Real-Time Updates** — new reports, status changes, and deletions appear instantly across all open tabs via Server-Sent Events (SSE)
- **Reverse Geocoding** — clicking the map auto-fills city and area fields using the Nominatim API
- **Near Me Filter** — filter hazards within 1–20 km of your current location using the Haversine formula
- **Duplicate Detection** — warns if a similar hazard has already been reported nearby within 90 days
- **Upvoting** — upvote hazards to signal urgency; persisted across sessions via localStorage
- **Comments** — threaded comments on each hazard with timestamps
- **Status Tracking** — mark hazards as Reported, In Progress, or Fixed
- **CSV Export** — download all hazard data as a spreadsheet
- **Trending & Leaderboard** — see the most upvoted hazards this week and top reporters
- **Authentication** — JWT-based login/signup; only the author can delete their own report
- **Rate Limiting** — POST endpoints rate-limited per IP to prevent abuse

---

## Tech Stack

**Frontend**
- React 19 (Vite)
- Leaflet / react-leaflet
- CSS custom properties, no UI framework

**Backend**
- Node.js + Express 5
- Prisma ORM
- PostgreSQL (Neon)
- OpenAI API (GPT-4o, GPT-4o mini)
- JWT + bcryptjs for auth
- express-rate-limit
- Server-Sent Events for real-time updates

---

## Getting Started

### Prerequisites
- Node.js 18+
- A PostgreSQL database (Neon recommended)
- An OpenAI API key

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/raastareport.git
cd raastareport
```

### 2. Set up the backend

```bash
cd server
npm install
```

Create a `.env` file in `/server`:

```env
DATABASE_URL=your_postgresql_connection_string
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=a_long_random_secret_string
CLIENT_URL=http://localhost:5173
```

Push the schema to your database:

```bash
npx prisma db push
```

Start the server:

```bash
npm run dev
```

### 3. Set up the frontend

```bash
cd ../client
npm install
```

Create a `.env` file in `/client`:

```env
VITE_API_URL=http://localhost:5000
```

Start the dev server:

```bash
npm run dev
```

The app will be running at `http://localhost:5173`.

---

## Deployment

| Service | Platform |
|--------|----------|
| Frontend | Vercel |
| Backend | Render |
| Database | Neon (PostgreSQL) |

**Environment variables to set on Render:**
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `JWT_SECRET`
- `CLIENT_URL` — your Vercel frontend URL

**Environment variables to set on Vercel:**
- `VITE_API_URL` — your Render backend URL

---

## Project Structure

```
raastareport/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── components/
│       │   ├── AuthModal.jsx
│       │   ├── CommentsSection.jsx
│       │   ├── HazardDetailModal.jsx
│       │   ├── HazardForm.jsx
│       │   ├── HazardMap.jsx
│       │   ├── LocationPickerMap.jsx
│       │   └── Navbar.jsx
│       ├── App.jsx
│       └── config.js
└── server/                  # Express backend
    ├── controllers/
    │   ├── aiController.js
    │   ├── authController.js
    │   ├── commentController.js
    │   └── hazardController.js
    ├── middleware/
    │   └── authMiddleware.js
    ├── routes/
    │   ├── aiRoutes.js
    │   ├── authRoutes.js
    │   └── hazardRoutes.js
    ├── utils/
    │   └── haversine.js
    ├── __tests__/
    │   └── haversine.test.js
    └── prisma/
        └── schema.prisma
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/hazards` | — | Get all hazards |
| POST | `/api/hazards` | Required | Create a hazard |
| PATCH | `/api/hazards/:id/status` | — | Update status |
| PATCH | `/api/hazards/:id/upvote` | — | Upvote |
| DELETE | `/api/hazards/:id` | Owner only | Delete hazard |
| GET | `/api/hazards/stream` | — | SSE real-time stream |
| GET | `/api/hazards/check-duplicate` | — | Check for nearby duplicate |
| GET | `/api/hazards/:id/comments` | — | Get comments |
| POST | `/api/hazards/:id/comments` | — | Add comment |
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Log in |
| GET | `/api/auth/me` | Required | Get current user |
| POST | `/api/ai/analyze-image` | — | AI photo analysis |
| POST | `/api/ai/report/:id` | — | Generate authority report |

---

## Running Tests

```bash
cd server
npm test
```

3 unit tests covering the Haversine distance formula used for duplicate detection and Near Me filtering.
