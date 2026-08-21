# Quick Start — Venner-Hisab Project

## ⚡ TL;DR - Start Project in 10 Seconds

### First Time Only (One-Time Setup)
1. **Setup PostgreSQL database** (see STARTUP_GUIDE.md → Initial Setup)
2. **Install backend dependencies**: 
   ```powershell
   cd backend
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. **Install frontend dependencies**:
   ```powershell
   cd frontend
   npm install
   ```

### Every Day After That
Run a single command in your terminal from the root folder:
```powershell
npm run dev
```

*(Or double-click `START_ALL.bat`)*

That's it! Both backend and frontend start concurrently in a single terminal window. ✨

---

## 📱 Access Your Project

| What | Where |
|------|-------|
| Frontend (React UI) | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Documentation | http://localhost:8000/docs |
| Alternative API Docs | http://localhost:8000/redoc |

---

## 🛠 If Something Goes Wrong

| Problem | Quick Fix |
|---------|-----------|
| "Port already in use" | Close other instances or use `taskkill /PID <id> /F` |
| "Can't connect to database" | Make sure PostgreSQL is running (check Windows Services) |
| "Import error in backend" | Activate venv: `backend\venv\Scripts\activate` |
| "npm not found" | Restart terminal after installing Node.js |
| "Python not found" | Restart terminal after installing Python |

---

## 📝 Manual Startup (If You Prefer)

**Terminal 1 - Backend:**
```powershell
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```powershell
cd frontend
npm run dev
```

---

## 🔧 Useful Commands

```powershell
# Backend
cd backend
venv\Scripts\activate          # Activate Python virtual environment
pip install -r requirements.txt # Install Python dependencies
python -m uvicorn app.main:app --reload  # Start server

# Frontend
cd frontend
npm install                    # Install Node packages
npm run dev                    # Start dev server
npm run build                  # Build for production
npm run lint                   # Check code

# Database
psql -U venner_user -d venner_hisab_dev -h 127.0.0.1 -p 5433  # Connect to DB
```

---

## 📂 Important Files

```
START_ALL.bat          ← Use this to start everything
STARTUP_GUIDE.md       ← Full detailed guide (read if you have questions)
backend/.env           ← Database configuration
frontend/package.json  ← Frontend dependencies
backend/requirements.txt ← Backend dependencies
```

---

## ❓ Full Details

For complete setup instructions, prerequisites, troubleshooting, and more, see: **STARTUP_GUIDE.md**

---

**That's it! You're ready to develop! 🚀**
