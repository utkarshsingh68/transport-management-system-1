# 🚀 Deployment Guide - Transport Management System

## Deployment Options

### Option 1: Railway (Recommended - Easiest)
Deploy both backend and PostgreSQL database together.

#### Steps:
1. **Create Railway Account**: https://railway.app
2. **Install Railway CLI** (optional):
   ```bash
   npm install -g @railway/cli
   railway login
   ```
3. **Deploy Backend**:
   - Go to Railway Dashboard → New Project → Deploy from GitHub
   - Connect your GitHub repo
   - Select the `backend` folder as root directory
   - Railway will auto-detect Node.js

4. **Add PostgreSQL**:
   - In your Railway project, click "New" → "Database" → "PostgreSQL"
   - Railway will automatically set `DATABASE_URL` environment variable

5. **Set Environment Variables** in Railway:
   ```
   NODE_ENV=production
   JWT_SECRET=your_secure_random_string_here
   CORS_ORIGIN=https://your-frontend-url.vercel.app
   ```

6. **Initialize Database**:
   - Go to Railway PostgreSQL → Data → Query
   - Paste contents of `backend/database/schema.sql`
   - Run the query

7. **Get Backend URL**: Copy your Railway backend URL (e.g., `https://tms-backend-production.up.railway.app`)

---

### Option 2: Render (Free Tier Available)

#### Backend Deployment:
1. Go to https://render.com → New → Web Service
2. Connect GitHub repo, set root directory to `backend`
3. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
4. Add PostgreSQL: New → PostgreSQL (free tier available)
5. Set environment variables:
   ```
   NODE_ENV=production
   DATABASE_URL=(auto-connected from Render PostgreSQL)
   JWT_SECRET=your_secure_random_string
   CORS_ORIGIN=https://your-frontend.vercel.app
   ```

---

## Frontend Deployment (Vercel)

### Steps:
1. **Create Vercel Account**: https://vercel.com
2. **Import Project**:
   - Click "New Project" → Import from GitHub
   - Select your repo
   - Set **Root Directory** to `frontend`

3. **Configure Build**:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Set Environment Variable**:
   ```
   VITE_API_URL=https://your-backend-url.railway.app/api
   ```
   (Replace with your actual backend URL from Railway/Render)

5. **Deploy** → Your site will be live at `https://your-project.vercel.app`

---

## Post-Deployment Checklist

### 1. Update CORS on Backend
After getting your Vercel frontend URL, update the backend's `CORS_ORIGIN`:
```
CORS_ORIGIN=https://your-app.vercel.app
```

### 2. Initialize Database
Run the schema on your production database:
- Copy `backend/database/schema.sql`
- Execute on Railway/Render PostgreSQL console

### 3. Create Admin User
Connect to your database and run:
```sql
INSERT INTO users (username, email, password_hash, full_name, role)
VALUES (
  'admin',
  'admin@yourcompany.com',
  '$2a$10$YOUR_BCRYPT_HASH_HERE',  -- Generate using bcrypt
  'Admin User',
  'admin'
);
```

Or use the backend's registration endpoint if available.

### 4. Test the Application
- Visit your Vercel URL
- Try logging in
- Test CRUD operations

---

## Environment Variables Summary

### Backend (Railway/Render):
| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `5000` (usually auto-set) |
| `DATABASE_URL` | PostgreSQL connection string | Auto-set by Railway/Render |
| `JWT_SECRET` | Secret for JWT tokens | Random 32+ char string |
| `CORS_ORIGIN` | Frontend URL(s) | `https://tms.vercel.app` |

### Frontend (Vercel):
| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://tms-api.railway.app/api` |

---

## Quick Deploy Commands

### If using Railway CLI:
```bash
# From backend folder
cd backend
railway init
railway add postgresql
railway up

# Get your deployment URL
railway open
```

### Build frontend locally to test:
```bash
cd frontend
npm run build
npm run preview
```

---

## Troubleshooting

### CORS Errors
- Ensure `CORS_ORIGIN` matches your frontend URL exactly (including `https://`)
- Multiple origins: `CORS_ORIGIN=https://app1.vercel.app,https://app2.vercel.app`

### Database Connection Errors
- Check `DATABASE_URL` is correctly set
- Ensure SSL is enabled for production databases

### 404 on Frontend Routes
- The `vercel.json` file handles SPA routing - make sure it's deployed

### API Not Responding
- Check backend logs in Railway/Render dashboard
- Verify `VITE_API_URL` is correct in Vercel
