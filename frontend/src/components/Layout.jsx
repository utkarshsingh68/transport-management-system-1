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
  ChevronRight,
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
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, color: 'text-blue-500' },
    { name: 'Trucks', href: '/trucks', icon: Truck, color: 'text-emerald-500' },
    { name: 'Drivers', href: '/drivers', icon: Users, color: 'text-violet-500' },
    { name: 'Trips', href: '/trips', icon: Route, color: 'text-amber-500' },
    { name: 'Fuel', href: '/fuel', icon: Fuel, color: 'text-orange-500' },
    { name: 'Expenses', href: '/expenses', icon: Receipt, color: 'text-rose-500' },
    { name: 'Parties', href: '/parties', icon: Building2, color: 'text-cyan-500' },
    { name: 'Salary', href: '/salary', icon: Wallet, color: 'text-teal-500' },
    { name: 'Ledger', href: '/ledger', icon: BookOpen, color: 'text-indigo-500' },
    { name: 'Profit & Loss', href: '/profit-loss', icon: TrendingUp, color: 'text-emerald-500' },
    { name: 'Reports', href: '/reports', icon: BarChart3, color: 'text-purple-500' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar overlay */}
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-100 transform transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:inset-auto flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Truck size={20} className="text-white" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-800">TMS</span>
              <p className="text-[10px] text-slate-400 font-medium -mt-0.5">Transport Manager</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <div className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-blue-100' : 'bg-slate-100 group-hover:bg-slate-200'}`}>
                    <Icon size={18} className={isActive ? 'text-blue-600' : item.color} />
                  </div>
                  <span className="font-medium text-sm flex-1">{item.name}</span>
                  {isActive && <ChevronRight size={16} className="text-blue-400" />}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{user?.full_name || 'Admin'}</p>
              <p className="text-xs text-slate-500 capitalize">{user?.role || 'Administrator'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu size={22} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-slate-800">
                {navigation.find((item) => item.href === location.pathname)?.name || 'TMS'}
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-600">Welcome, <span className="font-semibold text-slate-800">{user?.full_name}</span></span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
