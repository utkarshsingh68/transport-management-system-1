# 🚀 TMS Setup Checklist

Use this checklist to ensure proper setup of your Transport Management System.

## ✅ Pre-Installation Checklist

- [ ] Node.js v16+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] PostgreSQL v12+ installed
- [ ] PostgreSQL service is running
- [ ] You know your PostgreSQL password
- [ ] Git installed (optional, for version control)

## ✅ Installation Steps

### 1. Database Setup
- [ ] PostgreSQL is running on port 5432
- [ ] Can connect to PostgreSQL with `postgres` user
- [ ] Have noted down the password

### 2. Backend Configuration
- [ ] Copied `.env.example` to `.env` in backend folder
- [ ] Updated `DB_PASSWORD` in `.env`
- [ ] Updated `JWT_SECRET` to a random string
- [ ] Verified all .env values

### 3. Dependencies Installation
- [ ] Ran `npm run install-all` from root directory
- [ ] No errors during installation
- [ ] All three package.json files have dependencies installed

### 4. Database Initialization
- [ ] Ran `npm run init-db` from backend folder
- [ ] Saw "Database initialization completed successfully!"
- [ ] Default admin user created

### 5. Application Launch
- [ ] Ran `npm run dev` from root directory
- [ ] Backend started on port 5000
- [ ] Frontend started on port 5173
- [ ] No errors in terminal

### 6. First Login
- [ ] Opened http://localhost:5173
- [ ] Logged in with admin/admin123
- [ ] Redirected to dashboard
- [ ] Can see navigation sidebar

## ✅ Verification Steps

### Test Each Module
- [ ] Dashboard loads with charts
- [ ] Can create a new truck
- [ ] Can create a new driver
- [ ] Can create a new trip
- [ ] Income calculates automatically
- [ ] Can add fuel entry
- [ ] Can add expense
- [ ] Reports show data
- [ ] Can export to Excel

### Test Authentication
- [ ] Can logout
- [ ] Cannot access pages without login
- [ ] Login redirects to dashboard
- [ ] Invalid credentials show error

### Test Responsiveness
- [ ] Resize browser window
- [ ] Sidebar collapses on mobile
- [ ] Tables are scrollable
- [ ] Forms are usable on mobile
- [ ] Charts render on mobile

## ✅ Security Checklist

- [ ] Changed default admin password
- [ ] Updated JWT_SECRET to strong random string
- [ ] Set NODE_ENV=production for production
- [ ] Database password is strong
- [ ] .env file is in .gitignore
- [ ] CORS_ORIGIN set to actual frontend URL

## ✅ Production Deployment Checklist

- [ ] Built frontend (`cd frontend && npm run build`)
- [ ] Set environment variables on server
- [ ] PostgreSQL database created on server
- [ ] Database schema applied
- [ ] Uploads folder has write permissions
- [ ] SSL certificate configured
- [ ] Domain pointed to server
- [ ] Firewall rules configured
- [ ] Database backups scheduled
- [ ] Application runs as system service
- [ ] Logs are being written
- [ ] Error monitoring setup

## ✅ Optional Enhancements

- [ ] Create additional user accounts
- [ ] Import existing truck data
- [ ] Import existing driver data
- [ ] Set up regular database backups
- [ ] Configure email notifications
- [ ] Set up monitoring/alerts
- [ ] Create user training documentation
- [ ] Set up staging environment

## 🐛 Troubleshooting

If something doesn't work, check:

### Backend won't start
- [ ] PostgreSQL is running
- [ ] Database credentials are correct in .env
- [ ] Port 5000 is not in use
- [ ] Dependencies are installed

### Frontend won't start
- [ ] Port 5173 is not in use
- [ ] Dependencies are installed in frontend folder
- [ ] Vite config is correct

### Can't login
- [ ] Database was initialized
- [ ] Using correct credentials (admin/admin123)
- [ ] Backend is running
- [ ] Network tab shows successful API call

### Database errors
- [ ] PostgreSQL service is running
- [ ] Database `tms_db` exists
- [ ] User has proper permissions
- [ ] Connection string is correct

### API errors
- [ ] Backend console shows the error
- [ ] Check API_DOCUMENTATION.md for correct format
- [ ] Verify JWT token is being sent
- [ ] Check user has proper role permissions

## 📞 Need Help?

1. Check README.md for detailed documentation
2. Check API_DOCUMENTATION.md for API reference
3. Check troubleshooting section in README
4. Review error messages in browser console
5. Check backend terminal for errors

## ✨ Success!

When all checkboxes are checked, your TMS is ready to use! 🎉

**Next Steps:**
1. Create user accounts for your team
2. Add your trucks and drivers
3. Start recording trips
4. Monitor your dashboard
5. Generate reports

---

**Remember:** Regular database backups are essential for data safety!
