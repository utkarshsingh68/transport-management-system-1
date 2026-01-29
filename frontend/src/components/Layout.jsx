import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  Users,
  Route,
  Fuel,
  Receipt,
  BarChart3,
  Menu,
  X,
  LogOut,
  Building2,
  Wallet,
  BookOpen,
  TrendingUp,
  Bell,
  Search,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, color: 'from-blue-500 to-indigo-600' },
    { name: 'Trucks', href: '/trucks', icon: Truck, color: 'from-emerald-500 to-teal-600' },
    { name: 'Drivers', href: '/drivers', icon: Users, color: 'from-violet-500 to-purple-600' },
    { name: 'Trips', href: '/trips', icon: Route, color: 'from-amber-500 to-orange-600' },
    { name: 'Fuel', href: '/fuel', icon: Fuel, color: 'from-orange-500 to-red-500' },
    { name: 'Expenses', href: '/expenses', icon: Receipt, color: 'from-rose-500 to-pink-600' },
    { name: 'Parties', href: '/parties', icon: Building2, color: 'from-cyan-500 to-blue-600' },
    { name: 'Salary', href: '/salary', icon: Wallet, color: 'from-teal-500 to-emerald-600' },
    { name: 'Ledger', href: '/ledger', icon: BookOpen, color: 'from-indigo-500 to-violet-600' },
    { name: 'Profit & Loss', href: '/profit-loss', icon: TrendingUp, color: 'from-green-500 to-emerald-600' },
    { name: 'Reports', href: '/reports', icon: BarChart3, color: 'from-purple-500 to-indigo-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50/30 flex">
      {/* Mobile sidebar overlay */}
      <div
        className={`fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-40 lg:hidden transition-all duration-300 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200/60 transform transition-all duration-300 ease-out lg:translate-x-0 flex flex-col shadow-xl lg:shadow-sm ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-20 px-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Truck size={24} className="text-white" />
            </div>
            <div>
              <span className="text-xl font-extrabold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Fleetora</span>
              <p className="text-[11px] text-slate-400 font-medium -mt-0.5 flex items-center gap-1">
                <Sparkles size={10} className="text-amber-500" />
                Fleet Management
              </p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3">
          <div className="space-y-1.5">
            {navigation.map((item, index) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10 text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={`p-2.5 rounded-xl transition-all duration-300 ${
                    isActive 
                      ? `bg-gradient-to-br ${item.color} shadow-lg` 
                      : 'bg-slate-100 group-hover:bg-slate-200 group-hover:scale-110'
                  }`}>
                    <Icon size={18} className={isActive ? 'text-white' : 'text-slate-600 group-hover:text-slate-800'} />
                  </div>
                  <span className="font-semibold text-sm flex-1">{item.name}</span>
                  {isActive && (
                    <div className="w-1.5 h-6 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100/50">
          <div className="flex items-center gap-3 mb-3 p-3 bg-white rounded-xl shadow-sm">
            <div className="w-11 h-11 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/30">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{user?.full_name || 'Admin'}</p>
              <p className="text-xs text-slate-500 capitalize flex items-center gap-1">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                {user?.role || 'Administrator'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
          >
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:ml-72 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-4 lg:px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-xl transition-all duration-200"
            >
              <Menu size={22} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-800">
                {navigation.find((item) => item.href === location.pathname)?.name || 'Dashboard'}
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search - Desktop */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg border border-slate-200 w-56">
              <Search size={16} className="text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-transparent text-sm text-slate-600 placeholder:text-slate-400 outline-none w-full"
              />
            </div>
            
            {/* Notifications */}
            <button className="relative p-2 hover:bg-slate-100 rounded-lg transition-all duration-200">
              <Bell size={20} className="text-slate-500" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            
            {/* User badge */}
            <div className="hidden md:flex items-center gap-2 pl-2 pr-3 py-1.5 bg-slate-100 rounded-lg">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                {user?.full_name?.charAt(0) || 'A'}
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700">{user?.full_name}</span>
                <p className="text-[10px] text-slate-500 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
        
        {/* Footer */}
        <footer className="py-3 px-6 border-t border-slate-200/60 bg-white/80">
          <p className="text-center text-xs text-slate-400">
            © 2026 Fleetora Transport Management System
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
