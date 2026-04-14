# Invoxira Cloud — Business Management Suite

## 🚀 Quick Start (Run in 4 commands)

### Terminal 1 — Backend
```
cd backend
npm install
node seeder.js
npm run dev
```
✅ Should show: `MongoDB Connected: localhost` and `Server running on http://localhost:5000`

### Terminal 2 — Frontend
```
cd frontend
npm install
npm run dev
```
✅ Open browser: http://localhost:5173

## 🔑 Login
- Mobile: `9999999999`
- Password: `admin123`

## 📋 Requirements
- Node.js (v18+)
- MongoDB running locally (localhost:27017)

## ▶️ Start MongoDB (if not running)
```
net start MongoDB
```
Or open Services → find MongoDB → Start

## 📁 Project Structure
```
invoxira/
├── backend/
│   ├── .env              ← MongoDB connection
│   ├── server.js         ← Express server
│   ├── seeder.js         ← Load demo data
│   ├── models/           ← MongoDB models
│   ├── routes/           ← API routes
│   └── middleware/       ← Auth middleware
│
└── frontend/
    ├── src/
    │   ├── pages/        ← All page components
    │   ├── components/   ← Layout, Sidebar
    │   ├── styles/       ← CSS
    │   └── api.js        ← Backend connection
    └── vite.config.js
```

## 🗄️ View Data in MongoDB Compass
Open Compass → Connect to: `mongodb://localhost:27017`
→ Database: `invoxira`
