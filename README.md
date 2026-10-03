# CatMatch

CatMatch is a small, professional full stack web application focused exclusively on cat adoption. It helps people find cats compatible with their lifestyle. The project is being developed progressively following a 6-week Full Stack Labs plan.

## Technology Stack

- **Frontend:** React + Vite
- **Backend:** Python + Flask
- **Database:** PostgreSQL (planned)
- **Authentication:** JWT (planned)
- **AI integration:** planned, for cat/adopter matching

## Current Development Stage

**Week 1 — Planning and Setup**

The base project structure and configuration have been created. No application features have been implemented yet.

## Planned Features

- [ ] Home page and core UI
- [ ] User authentication (JWT)
- [ ] Cat listing and profile pages
- [ ] PostgreSQL database integration
- [ ] AI-powered cat/adopter matching
- [ ] Adoption request workflow

## Project Structure

```
CatMatch/
├── frontend/   # React + Vite application
├── backend/    # Flask API
├── README.md
├── .gitignore
└── .env.example
```

## Getting Started

Prerequisites
 - Node.js and npm (recommended Node 18+)
 - Python 3.10+ (3.11 recommended)
 - Git

Frontend

Install dependencies and run development server:

```bash
cd frontend
npm install
npm run dev
```

Run frontend linter:

```bash
cd frontend
npm run lint
```

Backend

Create a virtual environment, install dependencies and run the backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

Environment variables

The project uses an `.env` file (not committed). Copy the example and fill values:

```bash
cp ../.env.example .env
# then edit .env and provide real values (do NOT commit)
```

- Required variables (see `.env.example`):
	- `DATABASE_URL` — PostgreSQL connection URL (format: `postgresql://user:pass@host:port/dbname`).
	- `JWT_SECRET_KEY` — secret key for JWT signing (keep private, recommended >=32 chars).
	- `AI_API_KEY` — API key for AI provider (keep private).

Tests

Run backend unit tests (uses Python's unittest in the `backend/tests` folder):

```bash
cd backend
python -m unittest discover -v
```

Notes

- `.env` is listed in `.gitignore` and must not be committed.
- At this stage (Semana 1) the backend only includes a minimal Flask app; database, JWT
	and other integrations will be added in later weeks.
