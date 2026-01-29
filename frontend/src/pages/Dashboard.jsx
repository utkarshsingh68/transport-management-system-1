import { useState, useEffect } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import api from '../services/api';
import { TrendingUp, TrendingDown, DollarSign, Fuel, Receipt, Truck, Users, Route, ArrowUpRight, ArrowDownRight, Sparkles, Activity, PieChart, Wallet } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [monthlyData, setMonthlyData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [summaryRes, monthlyRes] = await Promise.all([
        api.get('/reports/summary'),
        api.get('/reports/monthly'),
      ]);
      setSummary(summaryRes.data);
      setMonthlyData(monthlyRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value?.toLocaleString('en-IN') || 0}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute inset-0"></div>
          </div>
          <p className="text-slate-500 font-semibold">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, trend, gradient, iconGradient }) => (
    <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/60 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
      {/* Background decoration */}
      <div className={`absolute -right-8 -top-8 w-32 h-32 ${gradient} rounded-full opacity-10 group-hover:opacity-20 transition-opacity`}></div>
      
      <div className="flex items-start justify-between relative">
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-500 mb-2">{title}</p>
          <p className="text-3xl font-extrabold text-slate-800 mb-3">
            {formatCurrency(value || 0)}
          </p>
          {trend !== undefined && (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              trend >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}>
              {trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {Math.abs(trend || 0).toFixed(1)}% vs last month
            </div>
          )}
        </div>
        <div className={`p-4 rounded-2xl ${iconGradient} shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
          <Icon size={26} className="text-white" />
        </div>
      </div>
    </div>
  );

  const monthlyChartData = {
    labels: monthlyData.slice(0, 6).reverse().map((d) => d.month),
    datasets: [
      {
        label: 'Income',
        data: monthlyData.slice(0, 6).reverse().map((d) => d.income),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: 'rgb(16, 185, 129)',
        pointBorderColor: '#fff',
        pointBorderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
      },
      {
        label: 'Expenses',
        data: monthlyData.slice(0, 6).reverse().map((d) => d.total_costs),
        borderColor: 'rgb(244, 63, 94)',
        backgroundColor: 'rgba(244, 63, 94, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: 'rgb(244, 63, 94)',
        pointBorderColor: '#fff',
        pointBorderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: { family: 'Inter', size: 12, weight: '600' }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { family: 'Inter', size: 13, weight: '600' },
        bodyFont: { family: 'Inter', size: 12 },
        padding: 12,
        cornerRadius: 12,
        displayColors: true,
        usePointStyle: true,
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
        ticks: { font: { family: 'Inter', size: 11, weight: '500' }, color: '#94a3b8' },
        border: { display: false }
      },
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Inter', size: 11, weight: '500' }, color: '#94a3b8' },
        border: { display: false }
      }
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  };

  const expenseBreakdown = {
    labels: ['Fuel', 'Other Expenses', 'Salary'],
    datasets: [
      {
        data: [summary?.total_fuel || 0, summary?.total_expenses || 0, summary?.total_salary || 0],
        backgroundColor: ['#f59e0b', '#f43f5e', '#8b5cf6'],
        borderWidth: 0,
        hoverOffset: 12,
        borderRadius: 4,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: { family: 'Inter', size: 12, weight: '600' }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { family: 'Inter', size: 13, weight: '600' },
        bodyFont: { family: 'Inter', size: 12 },
        padding: 12,
        cornerRadius: 12,
      }
    }
  };

  const profitMargin = Number(summary?.profit_margin) || 0;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-30"></div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="text-amber-300" size={20} />
              <span className="text-blue-100 text-sm font-medium">Fleet Overview</span>
            </div>
            <h1 className="text-3xl font-extrabold mb-2">Welcome to Fleetora Dashboard</h1>
            <p className="text-blue-100/80">Monitor your fleet performance and financial metrics in real-time</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/20">
              <p className="text-xs text-blue-100">Total Trucks</p>
              <p className="text-2xl font-bold">{summary?.active_trucks || 0}</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/20">
              <p className="text-xs text-blue-100">Active Trips</p>
              <p className="text-2xl font-bold">{summary?.active_trips || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Income"
          value={summary?.total_income}
          icon={DollarSign}
          trend={12}
          gradient="bg-emerald-500"
          iconGradient="bg-gradient-to-br from-emerald-500 to-teal-600"
        />
        <StatCard
          title="Fuel Cost"
          value={summary?.total_fuel}
          icon={Fuel}
          trend={-5}
          gradient="bg-amber-500"
          iconGradient="bg-gradient-to-br from-amber-500 to-orange-600"
        />
        <StatCard
          title="Expenses"
          value={summary?.total_expenses}
          icon={Receipt}
          trend={8}
          gradient="bg-rose-500"
          iconGradient="bg-gradient-to-br from-rose-500 to-red-600"
        />
        <StatCard
          title="Net Profit"
          value={summary?.profit}
          icon={TrendingUp}
          trend={summary?.profit >= 0 ? 15 : -10}
          gradient={summary?.profit >= 0 ? "bg-blue-500" : "bg-red-500"}
          iconGradient={summary?.profit >= 0 ? "bg-gradient-to-br from-blue-500 to-indigo-600" : "bg-gradient-to-br from-red-500 to-rose-600"}
        />
      </div>

      {/* Profit Margin */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/60 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
              <Activity size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Profit Margin</h3>
              <p className="text-xs text-slate-500">Current performance indicator</p>
            </div>
          </div>
          <div className={`px-4 py-2 rounded-xl ${profitMargin >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
            <span className={`text-2xl font-extrabold ${profitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {profitMargin.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out ${
              profitMargin >= 0 
                ? 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500' 
                : 'bg-gradient-to-r from-red-400 via-red-500 to-rose-500'
            }`}
            style={{ width: `${Math.min(Math.abs(profitMargin), 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-3 text-xs font-medium text-slate-400">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
              <Activity size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Monthly Trend</h3>
              <p className="text-xs text-slate-500">Income vs Expenses over time</p>
            </div>
          </div>
          <div className="h-80">
            <Line data={monthlyChartData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/60 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
              <PieChart size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Expense Breakdown</h3>
              <p className="text-xs text-slate-500">Distribution of costs</p>
            </div>
          </div>
          <div className="h-72 flex items-center justify-center">
            <Doughnut data={expenseBreakdown} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/60 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg">
            <Wallet size={20} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Financial Summary</h3>
            <p className="text-xs text-slate-500">Complete breakdown of your finances</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center py-4 px-5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/50"></div>
                <span className="text-slate-700 font-medium">Total Revenue</span>
              </div>
              <span className="font-bold text-emerald-700 text-lg">₹{summary?.total_income?.toLocaleString('en-IN') || 0}</span>
            </div>
            <div className="flex justify-between items-center py-4 px-5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-amber-500 rounded-full shadow-lg shadow-amber-500/50"></div>
                <span className="text-slate-700 font-medium">Fuel Expenses</span>
              </div>
              <span className="font-bold text-amber-700 text-lg">₹{summary?.total_fuel?.toLocaleString('en-IN') || 0}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-4 px-5 bg-gradient-to-r from-rose-50 to-red-50 rounded-xl border border-rose-100">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-rose-500 rounded-full shadow-lg shadow-rose-500/50"></div>
                <span className="text-slate-700 font-medium">Other Expenses</span>
              </div>
              <span className="font-bold text-rose-700 text-lg">₹{summary?.total_expenses?.toLocaleString('en-IN') || 0}</span>
            </div>
            <div className="flex justify-between items-center py-4 px-5 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-100">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-violet-500 rounded-full shadow-lg shadow-violet-500/50"></div>
                <span className="text-slate-700 font-medium">Salary Paid</span>
              </div>
              <span className="font-bold text-violet-700 text-lg">₹{summary?.total_salary?.toLocaleString('en-IN') || 0}</span>
            </div>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-slate-200">
          <div className={`flex justify-between items-center py-5 px-6 rounded-2xl ${
            summary?.profit >= 0 
              ? 'bg-gradient-to-r from-blue-500 to-indigo-600' 
              : 'bg-gradient-to-r from-red-500 to-rose-600'
          }`}>
            <span className="text-lg font-bold text-white/90">Net Profit/Loss</span>
            <span className="text-3xl font-extrabold text-white">
              ₹{summary?.profit?.toLocaleString('en-IN') || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
