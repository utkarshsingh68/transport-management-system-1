# 🎨 TMS Feature Visual Guide

## 📊 Dashboard Overview
```
┌─────────────────────────────────────────────────────────────┐
│  🚚 Transport Management System                    [Logout] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Income   │  │  Fuel    │  │ Expenses │  │  Profit  │   │
│  │ ₹500K    │  │  ₹150K   │  │  ₹100K   │  │  ₹250K   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                               │
│  ┌────────────────────────┐  ┌────────────────────────┐    │
│  │ Monthly Trend (Chart)  │  │ Expense Breakdown      │    │
│  │   📈                   │  │   🥧                   │    │
│  └────────────────────────┘  └────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 🚛 Truck Management
```
Features:
✅ Add/Edit/Delete trucks
✅ Filter by status (Active/Maintenance/Inactive)
✅ Track ownership type (Owned/Leased/Attached)
✅ Monitor capacity and model details
✅ Search functionality

Table View:
┌────────────┬──────────┬──────────┬───────┬────────┐
│ Truck No.  │   Type   │ Capacity │ Owner │ Status │ Actions
├────────────┼──────────┼──────────┼───────┼────────┤
│ MH-12-1234 │Container │   20T    │ Owned │ Active │ ✏️ 🗑️
│ MH-12-5678 │Trailer   │   25T    │Leased │ Active │ ✏️ 🗑️
└────────────┴──────────┴──────────┴───────┴────────┘
```

## 👨‍✈️ Driver Management
```
Features:
✅ Store driver contact details
✅ Track license numbers and expiry
✅ Manage salary information
✅ Maintain address records

Driver Card:
┌─────────────────────────────────┐
│ 👤 Rajesh Kumar                 │
│ 📞 +91 9876543210              │
│ 🆔 License: DL123456           │
│ 📅 Expiry: 31-Dec-2025         │
│ 💰 Salary: ₹25,000/month       │
│ ✅ Status: Active               │
└─────────────────────────────────┘
```

## 🗺️ Trip Management
```
Smart Income Calculation:

Rate Types:
1. Per Ton:    Weight × Rate = Income
   18 tons × ₹2,000 = ₹36,000

2. Per KM:     Distance × Rate = Income
   1400 km × ₹30 = ₹42,000

3. Fixed:      Fixed Amount = Income
   ₹50,000

Trip Workflow:
Planned → In Progress → Completed → [Reports]

Trip Details Tracked:
• From/To locations
• Truck & Driver assignment
• Weight & Distance
• Consignor/Consignee
• LR Number
• Auto-calculated income
```

## ⛽ Fuel Tracking
```
Per-Truck Analytics:
┌─────────────────────────────────┐
│ Truck: MH-12-1234              │
├─────────────────────────────────┤
│ Total Entries:     25           │
│ Total Liters:      1,250.5 L   │
│ Total Cost:        ₹1,12,545   │
│ Avg Price/Liter:   ₹90.00      │
└─────────────────────────────────┘

Fuel Entry Form:
• Select Truck
• Date & Station
• Quantity in Liters
• Price per Liter
• Auto-calculates total
• Payment mode (Cash/Bank/Credit)
```

## 💰 Expense Management
```
Categories:
📋 Maintenance & Repair
🛞 Tyre
🛡️ Insurance
📄 Tax & Permit
🚧 Toll
📦 Loading/Unloading
💵 Driver Advance
🏢 Office Expense
📌 Other

Payment Modes:
💵 Cash
🏦 Bank

Features:
✅ Category-wise summary
✅ Truck-specific expenses
✅ Bill upload support
✅ Vendor tracking
```

## 📊 Reports & Analytics

### Monthly P&L Report
```
┌────────┬───────┬────────┬─────────┬──────────┬────────┐
│  Month │ Trips │ Income │Expenses │   Fuel   │ Profit │
├────────┼───────┼────────┼─────────┼──────────┼────────┤
│2024-01 │  45   │ 450K   │  80K    │   120K   │ 250K ✅│
│2024-02 │  42   │ 420K   │  75K    │   115K   │ 230K ✅│
│2024-03 │  38   │ 380K   │  85K    │   105K   │ 190K ✅│
└────────┴───────┴────────┴─────────┴──────────┴────────┘
📈 Bar chart visualization included
```

### Truck-wise Performance
```
┌────────────┬───────┬────────┬──────┬──────────┬────────┐
│   Truck    │ Trips │ Income │ Fuel │ Expenses │ Profit │
├────────────┼───────┼────────┼──────┼──────────┼────────┤
│ MH-12-1234 │  25   │ 250K   │ 60K  │   40K    │ 150K ✅│
│ MH-12-5678 │  20   │ 200K   │ 55K  │   35K    │ 110K ✅│
└────────────┴───────┴────────┴──────┴──────────┴────────┘
📊 Performance comparison chart
```

### Driver-wise Performance
```
┌────────────────┬───────┬────────────┬─────────┐
│     Driver     │ Trips │   Income   │ Salary  │
├────────────────┼───────┼────────────┼─────────┤
│ Rajesh Kumar   │  30   │   300K     │  25K    │
│ Suresh Patil   │  25   │   250K     │  25K    │
└────────────────┴───────┴────────────┴─────────┘
```

## 🔐 User Roles & Permissions

```
Admin (Full Access)
├── All CRUD operations
├── User management
├── Delete operations
└── System configuration

Manager
├── Truck & Driver management
├── Trip creation & editing
├── View reports
└── No delete permissions

Accountant
├── Financial records
├── Expense management
├── Trip income tracking
└── Reports access

Viewer (Read-Only)
├── View all data
├── View reports
└── Export reports
```

## 📱 Mobile Responsive Design

```
Desktop View:              Mobile View:
┌─────────────────┐       ┌──────────┐
│ ☰│   Content   │       │ ☰  TMS   │
│ S│             │       ├──────────┤
│ I│             │       │          │
│ D│             │       │ Content  │
│ E│             │       │          │
│ B│             │       │ Stacks   │
│ A│             │       │ Nicely   │
│ R│             │       │          │
└─────────────────┘       └──────────┘
                          Sidebar slides in
```

## 🎯 Key Workflows

### Adding a New Trip
```
1. Click "Add Trip" button
2. Fill trip details:
   ├── Trip Number
   ├── Select Truck
   ├── Select Driver
   ├── From/To locations
   ├── Choose rate type
   └── Enter weight/distance
3. Income auto-calculates
4. Save → Trip created ✅
5. Appears in dashboard
```

### Recording Expenses
```
1. Navigate to Expenses
2. Click "Add Expense"
3. Select:
   ├── Category
   ├── Amount
   ├── Payment mode
   ├── Truck (optional)
   └── Upload bill (optional)
4. Save → Reflected in reports
```

### Generating Reports
```
1. Go to Reports page
2. Select tab:
   ├── Monthly P&L
   ├── Truck-wise
   └── Driver-wise
3. Set date range
4. View charts & tables
5. Click "Export" for Excel
```

## 🎨 Color Coding

```
Status Indicators:
🟢 Active/Completed     - Green
🟡 Planned/Maintenance  - Yellow
🔵 In Progress          - Blue
🔴 Cancelled/Inactive   - Red

Payment Modes:
💵 Cash                 - Green badge
🏦 Bank                 - Blue badge
💳 Credit               - Orange badge

Profit/Loss:
✅ Positive             - Green text
❌ Negative             - Red text
```

## 🚀 Performance Features

```
✅ Fast page loads with Vite
✅ Efficient database queries
✅ Connection pooling
✅ Indexed lookups
✅ Compressed responses
✅ Lazy loading ready
✅ Optimized bundle size
```

## 🔄 Data Flow Example

```
Trip Creation Flow:
┌──────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ User │───▶│ Frontend │───▶│ Backend  │───▶│ Database │
│ Form │    │ Validate │    │   API    │    │  Insert  │
└──────┘    └──────────┘    └──────────┘    └──────────┘
                                 │
                                 ▼
                           ┌──────────┐
                           │Calculate │
                           │  Income  │
                           └──────────┘
```

---

This visual guide shows how all features work together to create a complete Transport Management System! 🚛📊💼
