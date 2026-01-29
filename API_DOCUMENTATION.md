# API Documentation - TMS

## Base URL
```
http://localhost:5000/api
```

## Authentication
All endpoints (except `/auth/login`) require JWT token in header:
```
Authorization: Bearer <token>
```

---

## Authentication Endpoints

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@tms.com",
    "full_name": "System Administrator",
    "role": "admin"
  }
}
```

### Register New User (Admin Only)
```http
POST /auth/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "role": "manager"
}
```

---

## Trucks Endpoints

### Get All Trucks
```http
GET /trucks
GET /trucks?status=active
```

### Get Truck by ID
```http
GET /trucks/:id
```

### Create Truck
```http
POST /trucks
Content-Type: application/json

{
  "truck_number": "MH-12-AB-1234",
  "truck_type": "Container",
  "capacity_tons": 20,
  "model": "Tata LPT 1918",
  "purchase_date": "2023-01-15",
  "owner_type": "owned",
  "status": "active",
  "notes": "New truck"
}
```

### Update Truck
```http
PUT /trucks/:id
Content-Type: application/json

{
  "truck_number": "MH-12-AB-1234",
  "status": "maintenance"
}
```

### Delete Truck
```http
DELETE /trucks/:id
```

---

## Drivers Endpoints

### Get All Drivers
```http
GET /drivers
GET /drivers?status=active
```

### Create Driver
```http
POST /drivers
Content-Type: application/json

{
  "name": "Rajesh Kumar",
  "phone": "9876543210",
  "license_number": "DL123456",
  "license_expiry": "2025-12-31",
  "address": "Mumbai, Maharashtra",
  "joining_date": "2023-01-01",
  "salary_amount": 25000,
  "status": "active"
}
```

---

## Trips Endpoints

### Get All Trips
```http
GET /trips
GET /trips?truck_id=1
GET /trips?driver_id=2
GET /trips?status=completed
GET /trips?start_date=2024-01-01&end_date=2024-01-31
```

### Create Trip
```http
POST /trips
Content-Type: application/json

{
  "trip_number": "TRIP-001",
  "truck_id": 1,
  "driver_id": 1,
  "from_location": "Mumbai",
  "to_location": "Delhi",
  "start_date": "2024-01-20",
  "distance_km": 1400,
  "weight_tons": 18,
  "rate_per_ton": 2000,
  "rate_type": "per_ton",
  "consignor_name": "ABC Ltd",
  "consignee_name": "XYZ Corp",
  "lr_number": "LR12345",
  "status": "planned"
}
```

**Income Calculation:**
- `per_ton`: weight_tons × rate_per_ton
- `per_km`: distance_km × rate_per_ton
- `fixed`: fixed_amount

---

## Fuel Endpoints

### Get Fuel Entries
```http
GET /fuel
GET /fuel?truck_id=1
GET /fuel?start_date=2024-01-01&end_date=2024-01-31
```

### Get Truck Fuel Analytics
```http
GET /fuel/analytics/truck/:truck_id
GET /fuel/analytics/truck/:truck_id?start_date=2024-01-01&end_date=2024-01-31
```

**Response:**
```json
{
  "total_entries": 10,
  "total_liters": 500.50,
  "total_cost": 45000,
  "avg_price_per_liter": 89.91,
  "first_entry": "2024-01-01",
  "last_entry": "2024-01-31"
}
```

### Create Fuel Entry
```http
POST /fuel
Content-Type: application/json

{
  "truck_id": 1,
  "date": "2024-01-20",
  "fuel_station": "HP Petrol Pump",
  "quantity_liters": 50,
  "price_per_liter": 90,
  "odometer_reading": 45000,
  "payment_mode": "cash",
  "bill_number": "BILL123"
}
```

---

## Expenses Endpoints

### Get All Expenses
```http
GET /expenses
GET /expenses?truck_id=1
GET /expenses?category=Maintenance & Repair
GET /expenses?payment_mode=cash
GET /expenses?start_date=2024-01-01&end_date=2024-01-31
```

### Get Category Summary
```http
GET /expenses/summary/categories
GET /expenses/summary/categories?start_date=2024-01-01&end_date=2024-01-31
```

### Create Expense
```http
POST /expenses
Content-Type: application/json

{
  "expense_date": "2024-01-20",
  "truck_id": 1,
  "category": "Maintenance & Repair",
  "description": "Engine oil change",
  "amount": 5000,
  "payment_mode": "cash",
  "vendor_name": "ABC Auto Services",
  "bill_number": "INV123"
}
```

**Expense Categories:**
- Maintenance & Repair
- Tyre
- Insurance
- Tax & Permit
- Toll
- Loading/Unloading
- Driver Advance
- Office Expense
- Other

---

## Reports Endpoints

### Dashboard Summary
```http
GET /reports/summary
GET /reports/summary?start_date=2024-01-01&end_date=2024-01-31
```

**Response:**
```json
{
  "total_income": 500000,
  "total_expenses": 100000,
  "total_fuel": 150000,
  "total_salary": 50000,
  "total_costs": 300000,
  "profit": 200000,
  "profit_margin": "40.00"
}
```

### Monthly P&L Report
```http
GET /reports/monthly
GET /reports/monthly?year=2024
```

### Truck-wise Report
```http
GET /reports/truck-wise
GET /reports/truck-wise?start_date=2024-01-01&end_date=2024-01-31
```

### Driver-wise Report
```http
GET /reports/driver-wise
GET /reports/driver-wise?start_date=2024-01-01&end_date=2024-01-31
```

### Ledger Balance
```http
GET /reports/ledger/balance
```

**Response:**
```json
{
  "cash_balance": 50000,
  "bank_balance": 200000
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation Error",
  "details": [
    {
      "field": "truck_number",
      "message": "Truck number is required"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Access token required"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 409 Conflict
```json
{
  "error": "Duplicate Entry",
  "message": "A record with this value already exists"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error"
}
```

---

## Rate Limiting
Currently not implemented. Can be added using `express-rate-limit`.

## Pagination
Currently returns all results. Can be implemented with:
```
GET /trucks?page=1&limit=20
```

## Filtering & Sorting
Most endpoints support query parameters for filtering:
```
GET /trips?status=completed&sort=start_date&order=desc
```
