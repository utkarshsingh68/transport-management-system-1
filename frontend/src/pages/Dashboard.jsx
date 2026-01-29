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
import { TrendingUp, TrendingDown, DollarSign, Fuel, Receipt, Truck, Users, Route, ArrowUpRight, ArrowDownRight } from 'lucide-react';

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
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, trend, bgGradient, iconBg }) => (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-800 mb-2">
            {formatCurrency(value || 0)}
          </p>
          {trend !== undefined && (
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              trend >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}>
              {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(trend || 0).toFixed(1)}%
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBg} group-hover:scale-110 transition-transform duration-300`}>
          <Icon size={22} className="text-white" />
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
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: 'rgb(34, 197, 94)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
      },
      {
        label: 'Expenses',
        data: monthlyData.slice(0, 6).reverse().map((d) => d.total_costs),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: 'rgb(239, 68, 68)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { family: 'Inter', size: 12, weight: '500' }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.04)' },
        ticks: { font: { family: 'Inter', size: 11 } }
      },
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Inter', size: 11 } }
      }
    }
  };

  const expenseBreakdown = {
    labels: ['Fuel', 'Other Expenses', 'Salary'],
    datasets: [
      {
        data: [summary?.total_fuel || 0, summary?.total_expenses || 0, summary?.total_salary || 0],
        backgroundColor: ['#f59e0b', '#ef4444', '#8b5cf6'],
        borderWidth: 0,
        hoverOffset: 8,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: { family: 'Inter', size: 12, weight: '500' }
        }
      }
    }
  };

  const profitMargin = Number(summary?.profit_margin) || 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Income"
          value={summary?.total_income}
          icon={DollarSign}
          trend={12}
          iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
        />
        <StatCard
          title="Fuel Cost"
          value={summary?.total_fuel}
          icon={Fuel}
          trend={-5}
          iconBg="bg-gradient-to-br from-amber-500 to-orange-500"
        />
        <StatCard
          title="Expenses"
          value={summary?.total_expenses}
          icon={Receipt}
          trend={8}
          iconBg="bg-gradient-to-br from-rose-500 to-red-500"
        />
        <StatCard
          title="Net Profit"
          value={summary?.profit}
          icon={TrendingUp}
          trend={summary?.profit >= 0 ? 15 : -10}
          iconBg={summary?.profit >= 0 ? "bg-gradient-to-br from-blue-500 to-blue-600" : "bg-gradient-to-br from-red-500 to-red-600"}
        />
      </div>

      {/* Profit Margin */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Profit Margin</h3>
          <span className={`text-2xl font-bold ${profitMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {profitMargin.toFixed(1)}%
          </span>
        </div>
        <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ${
              profitMargin >= 0 
                ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' 
                : 'bg-gradient-to-r from-red-400 to-red-500'
            }`}
            style={{ width: `${Math.min(Math.abs(profitMargin), 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Monthly Trend</h3>
          <div className="h-72">
            <Line data={monthlyChartData} options={chartOptions} />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Expense Breakdown</h3>
          <div className="h-72 flex items-center justify-center">
            <Doughnut data={expenseBreakdown} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">Financial Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                <span className="text-slate-600">Total Revenue</span>
              </div>
              <span className="font-semibold text-slate-800">₹{summary?.total_income?.toLocaleString('en-IN') || 0}</span>
            </div>
            <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span className="text-slate-600">Fuel Expenses</span>
              </div>
              <span className="font-semibold text-amber-600">₹{summary?.total_fuel?.toLocaleString('en-IN') || 0}</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-slate-600">Other Expenses</span>
              </div>
              <span className="font-semibold text-red-600">₹{summary?.total_expenses?.toLocaleString('en-IN') || 0}</span>
            </div>
            <div className="flex justify-between items-center py-3 px-4 bg-slate-50 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-violet-500 rounded-full"></div>
                <span className="text-slate-600">Salary Paid</span>
              </div>
              <span className="font-semibold text-violet-600">₹{summary?.total_salary?.toLocaleString('en-IN') || 0}</span>
            </div>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-slate-100">
          <div className="flex justify-between items-center py-4 px-5 bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl">
            <span className="text-lg font-semibold text-slate-700">Net Profit/Loss</span>
            <span className={`text-2xl font-bold ${summary?.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              ₹{summary?.profit?.toLocaleString('en-IN') || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
