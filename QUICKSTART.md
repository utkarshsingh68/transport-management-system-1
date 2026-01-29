# Quick Start Guide - TMS

## 🚀 Getting Started in 5 Minutes

### Step 1: Install PostgreSQL
1. Download PostgreSQL from https://www.postgresql.org/download/
2. During installation, set a password for the `postgres` user (remember this!)
3. Use default port `5432`

### Step 2: Set Up Environment
```bash
cd c:\Users\utkarsh\Downloads\truck
cd backend
copy .env.example .env
```

Edit `backend\.env` and update:
```env
DB_PASSWORD=your_postgres_password_here
JWT_SECRET=my_secret_key_12345
```

### Step 3: Install & Initialize
```bash
cd c:\Users\utkarsh\Downloads\truck
npm run install-all
cd backend
npm run init-db
```

### Step 4: Run the Application
```bash
cd c:\Users\utkarsh\Downloads\truck
npm run dev
```

### Step 5: Access
Open browser: http://localhost:5173
- Username: `admin`
- Password: `admin123`

## 📱 First Steps After Login

1. **Add Trucks**: Go to Trucks → Add Truck
2. **Add Drivers**: Go to Drivers → Add Driver  
3. **Create Trip**: Go to Trips → Add Trip
4. **Track Fuel**: Go to Fuel → Add Fuel Entry
5. **View Dashboard**: Check real-time analytics

## ⚡ Common Commands

```bash
# Start development servers
npm run dev

# Start backend only
npm run server

# Start frontend only
npm run client

# Reinitialize database (WARNING: Deletes all data)
cd backend
npm run init-db
```

## 🔑 Default User Roles

After first login, you can create additional users:
- Admin: Full access
- Manager: Manage operations
- Accountant: Financial records only
- Viewer: Read-only

## 💡 Tips

- Change admin password after first login
- Regular database backups recommended
- Use Chrome/Edge for best experience
- Mobile responsive - works on tablets and phones

## ❓ Need Help?

Check the main README.md for:
- Detailed API documentation
- Troubleshooting guide
- Feature explanations
- Production deployment steps
