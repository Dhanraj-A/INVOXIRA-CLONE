# Invoxira v2 - Clean Build

This is a fresh, clean project setup for Invoxira that works perfectly on Vercel.

## Project Structure

```
invoxira-v2-clean/
├── frontend/          # React + Vite
├── backend/           # Express API
├── public/            # Built frontend (auto-generated)
├── package.json       # Root
├── vercel.json        # Vercel config
└── .gitignore
```

## Installation

### Local Development
```bash
cd invoxira-v2-clean
npm install                    # Install root dependencies
cd frontend && npm install     # Install frontend
cd ../backend && npm install   # Install backend
cd ..
npm run dev                    # Start both
```

### Deploy to Vercel
1. Push to GitHub
2. Connect to Vercel
3. Automatically builds and deploys

## API Server
- Runs on port 5000
- Base URL: `https://invoxira-backend.onrender.com/api`
- Health check: `/api/health`

## Database
- MongoDB with Mongoose
- Configure `MONGODB_URI` in `.env`

## Build Command
- Vercel automatically runs: `cd frontend && npm ci --production=false && npm run build`
- Output goes to `public/` folder
