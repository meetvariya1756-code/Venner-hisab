# Venner-Hisab Project — Complete Startup Guide

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Project Architecture](#project-architecture)
3. [Initial Setup (One-Time Only)](#initial-setup-one-time-only)
4. [Daily Startup](#daily-startup)
5. [Troubleshooting](#troubleshooting)
6. [Common Commands](#common-commands)

---

## Prerequisites

Before you start, ensure you have these installed:

### 1. Python 3.9+
```
Download from: https://www.python.org/downloads/
IMPORTANT: During installation, check "Add Python to PATH"
Verify: Open PowerShell and run: python --version
```

### 2. Node.js 18+
```
Download from: https://nodejs.org/
Install the LTS version
Verify: Open PowerShell and run: node --version
```

### 3. PostgreSQL (running on port 5433)
```
Download from: https://www.postgresql.org/download/windows/
During setup:
  - Set password for postgres user (remember this!)
  - Port: 5433 (NOT the default 5432)
  - Remember the superuser password

Verify: psql -U postgres -p 5433
```

---

## Project Architecture

### Backend (FastAPI)
- **Language**: Python
- **Framework**: FastAPI with Uvicorn
- **Port**: 8000
- **Database**: PostgreSQL (or SQLite fallback)
- **Features**:
  - Auto-generates database tables on startup
  - API documentation at http://localhost:8000/docs
  - Hot reload enabled for development
- **Location**: `backend/`

### Frontend (React + Vite)
- **Language**: TypeScript
- **Framework**: React 19 with Vite
- **Port**: 3000
- **Features**:
  - Fast HMR (Hot Module Replacement)
  - Tailwind CSS for styling
  - PWA support
- **Location**: `frontend/`

### Database (PostgreSQL)
- Stores all application data
- Automatically initialized on backend startup
- Connection string: `postgresql://venner_user:venner_pass@127.0.0.1:5433/venner_hisab_dev`

---

## Initial Setup (One-Time Only)

Follow these steps **only once** when you first clone/set up the project.

### Step 1: Database Setup

#### 1.1 Create PostgreSQL User and Database
```powershell
# Open PowerShell as Administrator
# Connect to PostgreSQL
psql -U postgres -p 5433

# In the PostgreSQL prompt, run these commands:
CREATE USER venner_user WITH PASSWORD 'venner_pass';
CREATE DATABASE venner_hisab_dev OWNER venner_user;
GRANT ALL PRIVILEGES ON DATABASE venner_hisab_dev TO venner_user;
\q
```

#### 1.2 Verify Connection
```powershell
psql -U venner_user -d venner_hisab_dev -h 127.0.0.1 -p 5433 -c "SELECT version();"
```

If this works, your database is ready!

### Step 2: Backend Setup

```powershell
# Navigate to project root
cd e:\Venner-hisab-main\Venner-hisab-main

# Navigate to backend
cd backend

# Create Python virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Verify .env file exists
# If not, copy .env.example to .env
# Edit .env if needed (should be pre-configured)
```

### Step 3: Frontend Setup

```powershell
# Navigate to frontend (in a new PowerShell window)
cd e:\Venner-hisab-main\Venner-hisab-main\frontend

# Install npm packages
npm install
```

✅ **Initial setup complete!** You only need to do this once.

---

## Daily Startup

### Option 1: The Easiest Way (Recommended) ⭐

Simply double-click one of these files from your project root:

**`START_ALL.bat`** — Starts backend AND frontend
- Opens 2 new terminal windows automatically
- Both servers start simultaneously
- Perfect for daily development

**`START_BACKEND.bat`** — Starts only the backend
- Use when you only need the API server
- Useful for mobile testing or API-only work

**`START_FRONTEND.bat`** — Starts only the frontend
- Use when backend is already running
- Useful for frontend-only changes

---

### Option 2: Manual Startup

#### Terminal 1: Start Backend
```powershell
cd e:\Venner-hisab-main\Venner-hisab-main\backend
venv\Scripts\activate
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Terminal 2: Start Frontend
```powershell
cd e:\Venner-hisab-main\Venner-hisab-main\frontend
npm run dev
```

---

### Option 3: VS Code Tasks

If you prefer using VS Code, create a `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Backend: Start FastAPI",
      "type": "shell",
      "command": "cmd",
      "args": ["/c", "cd backend && venv\\Scripts\\activate && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"],
      "problemMatcher": [],
      "isBackground": true,
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "new"
      }
    },
    {
      "label": "Frontend: Start Vite",
      "type": "shell",
      "command": "cmd",
      "args": ["/c", "cd frontend && npm run dev"],
      "problemMatcher": [],
      "isBackground": true,
      "presentation": {
        "echo": true,
        "reveal": "always",
        "focus": false,
        "panel": "new"
      }
    }
  ]
}
```

Then use **Terminal → Run Task** in VS Code.

---

## Verification Checklist

Once everything is running, verify all parts work:

✅ **Backend is running**
- Visit: http://localhost:8000/docs
- You should see FastAPI Swagger UI
- Try the health check endpoint (usually `/`)

✅ **Frontend is running**
- Visit: http://localhost:3000
- You should see your React application
- Check browser console for no errors (F12)

✅ **Communication between Frontend & Backend**
- Frontend should be able to make API calls
- Check Network tab in browser dev tools
- No CORS errors should appear

---

## Troubleshooting

### Problem: "Python not found"
**Solution**: 
- Install Python from https://www.python.org/
- During installation, CHECK "Add Python to PATH"
- Restart your terminal after installation

### Problem: "npm: command not found"
**Solution**:
- Install Node.js from https://nodejs.org/
- Make sure you select to add Node to PATH
- Restart terminal after installation

### Problem: "PostgreSQL connection refused"
**Solution**:
1. Verify PostgreSQL is running:
   - Open Services (Windows)
   - Look for "PostgreSQL" service
   - Ensure it's running (status = Running)
2. Verify the port is 5433:
   ```powershell
   netstat -ano | findstr :5433
   ```
3. Recreate the database:
   ```powershell
   psql -U postgres -p 5433
   DROP DATABASE IF EXISTS venner_hisab_dev;
   CREATE DATABASE venner_hisab_dev;
   ```

### Problem: "ModuleNotFoundError" in backend
**Solution**:
1. Ensure virtual environment is activated: `venv\Scripts\activate`
2. Reinstall dependencies: `pip install -r requirements.txt`
3. Verify you're in the `backend/` directory

### Problem: Frontend shows "Cannot GET /"
**Solution**:
- Wait for Vite to fully compile (check terminal)
- Clear browser cache (Ctrl+Shift+Delete)
- Ensure backend is running (port 8000)

### Problem: "Port 3000 already in use"
**Solution**:
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with the number found)
taskkill /PID <PID> /F

# Or use a different port
npm run dev -- --port 3001
```

### Problem: CORS errors
**Solution**:
1. Verify `ALLOWED_ORIGINS` in backend/.env
2. Should include: `http://localhost:3000`
3. Restart backend after changing .env
4. Clear browser cache

---

## Common Commands

### Backend Commands

```powershell
# Navigate to backend
cd backend

# Activate virtual environment
venv\Scripts\activate

# Run server with auto-reload
python -m uvicorn app.main:app --reload

# Run tests
pytest

# Database migrations (if needed)
# (Handled automatically on startup)
```

### Frontend Commands

```powershell
# Navigate to frontend
cd frontend

# Start dev server (uses port 3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

### Database Commands

```powershell
# Connect to database
psql -U venner_user -d venner_hisab_dev -h 127.0.0.1 -p 5433

# Inside psql:
\dt                    # List all tables
\d <table_name>        # Describe table structure
SELECT * FROM <table>; # Query data
\q                     # Quit
```

---

## Development Workflow

### 1. **Morning Startup**
```powershell
# Run this ONE command:
double-click START_ALL.bat

# Both servers start automatically in new windows
# Open browser to http://localhost:3000
```

### 2. **Make Changes**
- **Backend changes**: Auto-reload enabled (just save the file)
- **Frontend changes**: HMR enabled (just save the file)
- **Database changes**: May need to restart backend

### 3. **Stop Development**
- Press `Ctrl+C` in each terminal
- Or close the terminal windows

### 4. **Next Day**
- Repeat step 1!

---

## Environment Configuration

### .env File (Backend)

Located at: `backend/.env`

```
DATABASE_URL=postgresql://venner_user:venner_pass@127.0.0.1:5433/venner_hisab_dev
SECRET_KEY=dev-secret-key-replace-before-production
SESSION_TTL_SECONDS=28800
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
UPLOAD_DIR=./data/uploads
```

**Important**: Never commit .env to Git (it's in .gitignore)

---

## Useful Shortcuts

| Action | Command |
|--------|---------|
| View API docs | http://localhost:8000/docs |
| View ReDoc | http://localhost:8000/redoc |
| View Frontend | http://localhost:3000 |
| Open browser DevTools | F12 |
| HMR Refresh | Ctrl+R |
| Stop server | Ctrl+C |
| Activate venv | `venv\Scripts\activate` |
| Deactivate venv | `deactivate` |

---

## Quick Reference: File Locations

```
e:\Venner-hisab-main\Venner-hisab-main\
├── START_ALL.bat           ← Start everything with ONE click!
├── START_BACKEND.bat       ← Start only backend
├── START_FRONTEND.bat      ← Start only frontend
├── backend/
│   ├── .env                ← Database config
│   ├── requirements.txt    ← Python dependencies
│   ├── venv/               ← Virtual environment
│   └── app/
│       ├── main.py         ← FastAPI entry point
│       ├── api/            ← API endpoints
│       ├── models/         ← Database models
│       └── core/           ← Config, database
├── frontend/
│   ├── package.json        ← Node dependencies
│   ├── node_modules/       ← Installed packages
│   └── src/
│       ├── App.tsx         ← Main React component
│       ├── components/     ← React components
│       └── api/            ← API client
└── database/
    └── *.sql               ← Database setup scripts
```

---

## Need Help?

1. Check the [Troubleshooting](#troubleshooting) section above
2. Look at terminal error messages (they usually tell you what's wrong!)
3. Verify all prerequisites are installed
4. Check browser console (F12) for frontend errors
5. Check backend terminal for API errors

---

**Happy coding! 🚀**
