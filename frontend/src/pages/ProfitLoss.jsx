import { useState, useEffect } from 'react';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend);

const API_URL = 'http://localhost:5000/api';

export default function ProfitLoss() {
  const [pnlData, setPnlData] = useState(null);
  const [truckWise, setTruckWise] = useState([]);
  const [driverWise, setDriverWise] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const params = { start_date: dateRange.start_date, end_date: dateRange.end_date };

      const [pnlRes, truckRes, driverRes, trendRes, breakdownRes] = await Promise.all([
        axios.get(`${API_URL}/pnl/pnl`, { headers, params }),
        axios.get(`${API_URL}/pnl/pnl/truck-wise`, { headers, params }),
        axios.get(`${API_URL}/pnl/pnl/driver-wise`, { headers, params }),
        axios.get(`${API_URL}/pnl/pnl/monthly-trend`, { headers, params: { months: 12 } }),
        axios.get(`${API_URL}/pnl/expense-breakdown`, { headers, params })
      ]);

      setPnlData(pnlRes.data);
      setTruckWise(truckRes.data);
      setDriverWise(driverRes.data);
      setMonthlyTrend(trendRes.data);
      setExpenseBreakdown(breakdownRes.data);
    } catch (error) {
      console.error('Error fetching P&L data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const setQuickDate = (period) => {
    const now = new Date();
    let start, end;
    
    switch (period) {
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'this_quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
      case 'this_year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
        break;
      case 'last_year':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        return;
    }

    setDateRange({
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0]
    });
  };

  // Chart configurations
  const trendChartData = {
    labels: monthlyTrend.map(m => m.month_label),
    datasets: [
      {
        label: 'Income',
        data: monthlyTrend.map(m => m.income),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.5)',
        tension: 0.3
      },
      {
        label: 'Expenses',
        data: monthlyTrend.map(m => m.total_expenses),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.5)',
        tension: 0.3
      },
      {
        label: 'Profit',
        data: monthlyTrend.map(m => m.profit),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.3
      }
    ]
  };

  const expensePieData = {
    labels: expenseBreakdown?.expenses_by_category?.map(e => e.category) || [],
    datasets: [{
      data: expenseBreakdown?.expenses_by_category?.map(e => parseFloat(e.amount)) || [],
      backgroundColor: [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#84CC16'
      ]
    }]
  };

  const truckComparisonData = {
    labels: truckWise.trucks?.map(t => t.truck_number) || [],
    datasets: [
      {
        label: 'Income',
        data: truckWise.trucks?.map(t => t.income) || [],
        backgroundColor: 'rgba(34, 197, 94, 0.7)'
      },
      {
        label: 'Expenses',
        data: truckWise.trucks?.map(t => t.total_expenses) || [],
        backgroundColor: 'rgba(239, 68, 68, 0.7)'
      },
      {
        label: 'Profit',
        data: truckWise.trucks?.map(t => t.profit) || [],
        backgroundColor: 'rgba(59, 130, 246, 0.7)'
      }
    ]
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-500 font-medium">Loading P&L data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Profit & Loss Analysis</h1>
          <p className="text-slate-500 mt-1">Comprehensive financial overview of your business</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select 
            onChange={(e) => setQuickDate(e.target.value)} 
            className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white" 
            defaultValue=""
          >
            <option value="" disabled>Quick Select</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_quarter">This Quarter</option>
            <option value="this_year">This Year</option>
            <option value="last_year">Last Year</option>
          </select>
          <div className="flex items-center gap-2">
            <input 
              type="date" 
              value={dateRange.start_date} 
              onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })} 
              className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
            />
            <span className="text-slate-400">to</span>
            <input 
              type="date" 
              value={dateRange.end_date} 
              onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })} 
              className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" 
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20">
          <p className="text-emerald-100 text-sm font-medium">Total Income</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(pnlData?.income?.total)}</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-5 text-white shadow-lg shadow-red-500/20">
          <p className="text-red-100 text-sm font-medium">Total Expenses</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(pnlData?.expenses?.total)}</p>
        </div>
        <div className={`rounded-2xl p-5 text-white shadow-lg ${pnlData?.net_profit >= 0 ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20' : 'bg-gradient-to-br from-orange-500 to-orange-600 shadow-orange-500/20'}`}>
          <p className="text-white/80 text-sm font-medium">Net Profit</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(pnlData?.net_profit)}</p>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-500/20">
          <p className="text-violet-100 text-sm font-medium">Profit Margin</p>
          <p className="text-2xl font-bold mt-1">{pnlData?.profit_margin || 0}%</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/20">
          <p className="text-amber-100 text-sm font-medium">Fuel Expense</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(pnlData?.expenses?.fuel)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-1.5">
        <div className="flex gap-1">
          <button 
            onClick={() => setActiveTab('overview')} 
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('trucks')} 
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all ${activeTab === 'trucks' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Truck-wise
          </button>
          <button 
            onClick={() => setActiveTab('drivers')} 
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all ${activeTab === 'drivers' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Driver-wise
          </button>
          <button 
            onClick={() => setActiveTab('trend')} 
            className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-all ${activeTab === 'trend' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            Monthly Trend
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Expense Breakdown */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Expense Breakdown</h3>
            <div className="h-64">
              {expenseBreakdown?.expenses_by_category?.length > 0 ? (
                <Pie data={expensePieData} options={{ maintainAspectRatio: false }} />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No expense data</div>
              )}
            </div>
          </div>

          {/* Expense Details */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Expense Categories</h3>
            <div className="space-y-2">
              <div className="flex justify-between py-2.5 border-b border-slate-100">
                <span className="text-slate-600">Fuel</span>
                <span className="font-semibold text-slate-900">{formatCurrency(pnlData?.expenses?.fuel)}</span>
              </div>
              <div className="flex justify-between py-2.5 border-b border-slate-100">
                <span className="text-slate-600">Salaries</span>
                <span className="font-semibold text-slate-900">{formatCurrency(pnlData?.expenses?.salary)}</span>
              </div>
              {Object.entries(pnlData?.expenses?.by_category || {}).map(([category, amount]) => (
                <div key={category} className="flex justify-between py-2.5 border-b border-slate-100">
                  <span className="text-slate-600">{category}</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Mode Split */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Payment Mode Split</h3>
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-500 mb-2">Fuel Payments</div>
              {expenseBreakdown?.fuel_by_mode?.map((item) => (
                <div key={item.payment_mode} className="flex justify-between py-2 px-3 bg-slate-50 rounded-lg">
                  <span className="capitalize text-slate-600">{item.payment_mode}</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
                </div>
              ))}
              <div className="text-sm font-medium text-slate-500 mb-2 mt-4">Other Expenses</div>
              {expenseBreakdown?.expenses_by_mode?.map((item) => (
                <div key={item.payment_mode} className="flex justify-between py-2 px-3 bg-slate-50 rounded-lg">
                  <span className="capitalize text-slate-600">{item.payment_mode}</span>
                  <span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl">
                <div className="text-sm text-blue-600 font-medium">Active Trucks</div>
                <div className="text-2xl font-bold text-blue-700">{truckWise.trucks?.length || 0}</div>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-xl">
                <div className="text-sm text-emerald-600 font-medium">Active Drivers</div>
                <div className="text-2xl font-bold text-emerald-700">{driverWise.drivers?.length || 0}</div>
              </div>
              <div className="bg-gradient-to-br from-violet-50 to-violet-100 p-4 rounded-xl">
                <div className="text-sm text-violet-600 font-medium">Total Trips</div>
                <div className="text-2xl font-bold text-violet-700">{truckWise.trucks?.reduce((sum, t) => sum + parseInt(t.trip_count), 0) || 0}</div>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-xl">
                <div className="text-sm text-amber-600 font-medium">Total KM</div>
                <div className="text-2xl font-bold text-amber-700">{(truckWise.trucks?.reduce((sum, t) => sum + parseFloat(t.total_km), 0) || 0).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'trucks' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Truck Performance Comparison</h3>
            <div className="h-80">
              {truckWise.trucks?.length > 0 ? (
                <Bar data={truckComparisonData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }} />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No truck data</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase">Truck</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase">Trips</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase">KM</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase">Income</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase">Fuel</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase">Other Exp.</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase">Profit</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase">₹/KM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {truckWise.trucks?.map((truck, index) => (
                  <tr key={truck.truck_id} className={`hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-900">{truck.truck_number}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-slate-600">{truck.trip_count}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-600">{parseFloat(truck.total_km).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-emerald-600 font-medium">{formatCurrency(truck.income)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-amber-600">{formatCurrency(truck.fuel_cost)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-red-600">{formatCurrency(truck.other_expenses)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-right font-semibold ${truck.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatCurrency(truck.profit)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-slate-600">{truck.avg_per_km}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-semibold border-t-2 border-slate-200">
                <tr>
                  <td className="px-6 py-4 text-slate-900">Total</td>
                  <td className="px-6 py-4 text-center text-slate-900">{truckWise.trucks?.reduce((sum, t) => sum + parseInt(t.trip_count), 0)}</td>
                  <td className="px-6 py-4 text-right text-slate-900">{truckWise.trucks?.reduce((sum, t) => sum + parseFloat(t.total_km), 0).toLocaleString()}</td>
                  <td className="px-6 py-4 text-right text-emerald-600">{formatCurrency(truckWise.summary?.total_income)}</td>
                  <td colSpan="2" className="px-6 py-4 text-right text-red-600">{formatCurrency(truckWise.summary?.total_expenses)}</td>
                  <td className="px-6 py-4 text-right text-blue-600">{formatCurrency(truckWise.summary?.total_profit)}</td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'drivers' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase">Driver</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase">Phone</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-700 uppercase">Trips</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase">KM Driven</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase">Income Generated</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase">Avg/Trip</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase">Salary Paid</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-700 uppercase">Pending Advances</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {driverWise.drivers?.map((driver, index) => (
                <tr key={driver.driver_id} className={`hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-900">{driver.driver_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-600">{driver.phone || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-slate-600">{driver.trip_count}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-slate-600">{parseFloat(driver.total_km).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-emerald-600 font-medium">{formatCurrency(driver.income_generated)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-slate-600">{formatCurrency(driver.avg_per_trip)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-slate-600">{formatCurrency(driver.salary_paid)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-amber-600 font-medium">{formatCurrency(driver.pending_advances)}</td>
                </tr>
              ))}
              {(!driverWise.drivers || driverWise.drivers.length === 0) && (
                <tr><td colSpan="8" className="px-6 py-12 text-center text-slate-400">No driver data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'trend' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Monthly P&L Trend (Last 12 Months)</h3>
          <div className="h-96">
            {monthlyTrend.length > 0 ? (
              <Line data={trendChartData} options={{ 
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } },
                plugins: { legend: { position: 'top' } }
              }} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">No trend data available</div>
            )}
          </div>

          {/* Monthly Data Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left">Month</th>
                  <th className="px-4 py-2 text-right">Income</th>
                  <th className="px-4 py-2 text-right">Fuel</th>
                  <th className="px-4 py-2 text-right">Expenses</th>
                  <th className="px-4 py-2 text-right">Salary</th>
                  <th className="px-4 py-2 text-right">Total Exp.</th>
                  <th className="px-4 py-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {monthlyTrend.map((month) => (
                  <tr key={month.month}>
                    <td className="px-4 py-2 font-medium">{month.month_label}</td>
                    <td className="px-4 py-2 text-right text-green-600">{formatCurrency(month.income)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(month.fuel)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(month.expenses)}</td>
                    <td className="px-4 py-2 text-right">{formatCurrency(month.salary)}</td>
                    <td className="px-4 py-2 text-right text-red-600">{formatCurrency(month.total_expenses)}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${month.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatCurrency(month.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
