# Transport Management System (TMS)

A comprehensive web-based Transport Management System built for truck businesses to replace Excel workflows and manage end-to-end operations efficiently.

## 🚀 Features

### Core Functionality
- **Truck Management** - Track all trucks with details like capacity, ownership type, and status
- **Driver Management** - Manage driver information, licenses, and salary details
- **Trip Management** - Record trips with routes, weights, rates, and automatic income calculation
- **Fuel Tracking** - Monitor fuel consumption with per-truck analytics and cost tracking
- **Expense Management** - Track all expenses with cash/bank split and bill uploads
- **Reports & Analytics** - Comprehensive P&L dashboards with monthly, truck-wise, and driver-wise reports

### Technical Features
- ✅ Secure login with JWT-based authentication
- ✅ Role-based access control (Admin, Manager, Accountant, Viewer)
- ✅ Responsive mobile-friendly UI
- ✅ Real-time dashboards with interactive charts
- ✅ Export reports to Excel
- ✅ RESTful API architecture
- ✅ PostgreSQL database for data integrity

## 🛠️ Tech Stack

### Frontend
- React 18
- React Router v6
- Tailwind CSS
- Chart.js & react-chartjs-2
- Axios
- React Toastify
- Vite

### Backend
- Node.js & Express
- PostgreSQL
- JWT Authentication
- Bcrypt for password hashing
- Multer for file uploads
- ExcelJS for Excel exports

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
cd c:\Users\utkarsh\Downloads\truck
```

### 2. Install Dependencies
```bash
npm run install-all
```

This command will install dependencies for:
- Root package (concurrently for running both servers)
- Backend
- Frontend

### 3. Configure Database

#### Install PostgreSQL
If you don't have PostgreSQL installed:
- **Windows**: Download from https://www.postgresql.org/download/windows/
- During installation, remember the password you set for the `postgres` user

#### Create Environment File
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your database credentials:
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=tms_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here

JWT_SECRET=change_this_to_a_random_secret_key
JWT_EXPIRE=7d

CORS_ORIGIN=http://localhost:5173
```

### 4. Initialize Database
```bash
cd backend
npm run init-db
```

This will:
- Create the database `tms_db`
- Set up all required tables
- Create a default admin user
- Create uploads directory

**Default Login Credentials:**
- Username: `admin`
- Password: `admin123`

### 5. Start the Application

From the root directory:
```bash
npm run dev
```

This starts both:
- Backend API server on http://localhost:5000
- Frontend development server on http://localhost:5173

Or start them individually:
```bash
# Backend only
npm run server

# Frontend only
npm run client
```

### 6. Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

Login with the default credentials (admin/admin123)

## 📱 Usage Guide

### Dashboard
- View overall financial summary
- Monitor profit/loss trends
- See expense breakdowns
- Track key metrics

### Trucks
- Add/Edit/Delete trucks
- Track truck status (Active, Maintenance, Inactive)
- Manage truck details (capacity, ownership type, model)

### Drivers
- Manage driver information
- Track license details and expiry
- Set monthly salaries
- Maintain driver contact information

### Trips
- Create trip entries with auto-calculated income
- Support for per-ton, per-km, and fixed rate types
- Track trip status (Planned, In Progress, Completed)
- Link trips to trucks and drivers

### Fuel Management
- Record fuel entries per truck
- Track fuel consumption and costs
- View per-truck analytics
- Monitor fuel efficiency

### Expenses
- Categorized expense tracking
- Cash vs Bank payment modes
- Attach bills and receipts
- Truck-specific and general expenses

### Reports
- **Monthly P&L**: Month-wise profit and loss analysis
- **Truck-wise Reports**: Performance metrics per truck
- **Driver-wise Reports**: Driver performance tracking
- **Export to Excel**: Download reports for external use

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Role-based access control
- Protected API endpoints
- Secure file uploads
- SQL injection prevention

## 🗄️ Database Schema

Key tables:
- `users` - User accounts and roles
- `trucks` - Truck master data
- `drivers` - Driver master data
- `trips` - Trip records with income calculations
- `fuel_entries` - Fuel consumption tracking
- `expenses` - Expense records
- `cash_transactions` - Cash ledger
- `bank_transactions` - Bank ledger

## 📊 API Endpoints

### Authentication
- POST `/api/auth/login` - User login
- POST `/api/auth/register` - Create new user (admin only)

### Trucks
- GET `/api/trucks` - Get all trucks
- POST `/api/trucks` - Create truck
- PUT `/api/trucks/:id` - Update truck
- DELETE `/api/trucks/:id` - Delete truck

### Drivers
- GET `/api/drivers` - Get all drivers
- POST `/api/drivers` - Create driver
- PUT `/api/drivers/:id` - Update driver
- DELETE `/api/drivers/:id` - Delete driver

### Trips
- GET `/api/trips` - Get all trips (with filters)
- POST `/api/trips` - Create trip
- PUT `/api/trips/:id` - Update trip
- DELETE `/api/trips/:id` - Delete trip

### Fuel
- GET `/api/fuel` - Get fuel entries
- GET `/api/fuel/analytics/truck/:id` - Get truck fuel analytics
- POST `/api/fuel` - Create fuel entry
- PUT `/api/fuel/:id` - Update fuel entry
- DELETE `/api/fuel/:id` - Delete fuel entry

### Expenses
- GET `/api/expenses` - Get expenses
- GET `/api/expenses/summary/categories` - Category summary
- POST `/api/expenses` - Create expense
- PUT `/api/expenses/:id` - Update expense
- DELETE `/api/expenses/:id` - Delete expense

### Reports
- GET `/api/reports/summary` - Dashboard summary
- GET `/api/reports/monthly` - Monthly P&L
- GET `/api/reports/truck-wise` - Truck-wise report
- GET `/api/reports/driver-wise` - Driver-wise report

## 🔧 Configuration

### Port Configuration
- Backend: Edit `backend/.env` → `PORT=5000`
- Frontend: Edit `frontend/vite.config.js` → `server.port: 5173`

### Database Configuration
Edit `backend/.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tms_db
DB_USER=postgres
DB_PASSWORD=your_password
```

## 🚀 Production Deployment

### Build Frontend
```bash
cd frontend
npm run build
```

### Start Production Server
```bash
cd backend
NODE_ENV=production npm start
```

### Environment Variables for Production
Update `backend/.env`:
```env
NODE_ENV=production
JWT_SECRET=use_a_strong_random_secret
CORS_ORIGIN=https://yourdomain.com
```

## 🔮 Future Enhancements (Ready for Implementation)

The system is designed to easily accommodate:
- WhatsApp reminders for trip updates
- Automated invoice generation
- GPS tracking integration
- Mobile app (React Native)
- Advanced analytics with ML predictions
- Multi-branch support
- Integration with accounting software

## 🐛 Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running
- Check credentials in `.env`
- Ensure database `tms_db` exists

### Port Already in Use
```bash
# Windows - Kill process on port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

### Frontend Not Loading
- Clear browser cache
- Check if backend is running
- Verify proxy settings in `vite.config.js`

## 📝 License

MIT License - Feel free to use for commercial purposes

## 👥 User Roles

- **Admin**: Full access to all features
- **Manager**: Can manage trucks, drivers, and trips
- **Accountant**: Can manage financial records
- **Viewer**: Read-only access

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section
2. Review API documentation
3. Check database schema

## 📈 Performance Tips

- Regular database backups
- Monitor PostgreSQL performance
- Use indexes for large datasets
- Implement pagination for large lists
- Regular cleanup of old records

---

**Built with ❤️ for Transport Businesses**
