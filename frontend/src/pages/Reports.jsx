import { useState, useEffect } from 'react';
import { Download, Calendar, BarChart3, TruckIcon, Users, TrendingUp } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { toast } from 'react-toastify';
import api from '../services/api';
import * as XLSX from 'xlsx';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('monthly');
  const [monthlyData, setMonthlyData] = useState([]);
  const [truckData, setTruckData] = useState([]);
  const [driverData, setDriverData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start_date: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [monthlyRes, truckRes, driverRes] = await Promise.all([
        api.get('/reports/monthly', { params: { year: new Date().getFullYear() } }),
        api.get('/reports/truck-wise', { params: dateRange }),
        api.get('/reports/driver-wise', { params: dateRange }),
      ]);
      setMonthlyData(monthlyRes.data);
      setTruckData(truckRes.data);
      setDriverData(driverRes.data);
    } catch (error) {
      toast.error('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = (data, filename) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Report exported successfully');
  };

  const monthlyChartData = {
    labels: monthlyData.slice(0, 12).reverse().map((d) => d.month),
    datasets: [
      {
        label: 'Profit',
        data: monthlyData.slice(0, 12).reverse().map((d) => d.profit),
        backgroundColor: monthlyData.slice(0, 12).reverse().map((d) => 
          d.profit >= 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)'
        ),
        borderRadius: 8,
      },
    ],
  };

  const truckChartData = {
    labels: truckData.map((d) => d.truck_number),
    datasets: [
      {
        label: 'Income',
        data: truckData.map((d) => d.income),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderRadius: 8,
      },
      {
        label: 'Costs',
        data: truckData.map((d) => d.total_costs),
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderRadius: 8,
      },
    ],
  };

  const tabs = [
    { id: 'monthly', label: 'Monthly P&L', icon: TrendingUp },
    { id: 'truck', label: 'Truck-wise', icon: TruckIcon },
    { id: 'driver', label: 'Driver-wise', icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-slate-500 mt-1">Analyze your business performance</p>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-xl p-2 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-slate-400" />
            <input
              type="date"
              className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              value={dateRange.start_date}
              onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })}
            />
          </div>
          <span className="text-slate-400">to</span>
          <input
            type="date"
            className="px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
            value={dateRange.end_date}
            onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl p-1.5 shadow-sm border border-slate-100 inline-flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Monthly Report */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30">
                  <TrendingUp size={20} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Monthly Profit Trend</h3>
              </div>
              <button
                onClick={() => exportToExcel(monthlyData, 'monthly_report')}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                <Download size={18} />
                Export
              </button>
            </div>
            <Bar data={monthlyChartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Month</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Trips</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Income</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fuel</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Expenses</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Costs</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Profit/Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyData.map((row, idx) => (
                    <tr key={row.month} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-6 py-4 font-semibold text-slate-900">{row.month}</td>
                      <td className="px-6 py-4 text-slate-600">{row.total_trips}</td>
                      <td className="px-6 py-4 text-green-600 font-medium">₹{parseFloat(row.income || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4 text-amber-600">₹{parseFloat(row.fuel || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4 text-red-600">₹{parseFloat(row.expenses || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4 text-slate-600">₹{parseFloat(row.total_costs || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 text-sm font-bold rounded-lg ${row.profit >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          ₹{parseFloat(row.profit || 0).toLocaleString('en-IN')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Truck-wise Report */}
      {activeTab === 'truck' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <TruckIcon size={20} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Truck-wise Performance</h3>
              </div>
              <button
                onClick={() => exportToExcel(truckData, 'truck_report')}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                <Download size={18} />
                Export
              </button>
            </div>
            <Bar data={truckChartData} options={{ responsive: true }} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Truck Number</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Trips</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Income</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fuel Cost</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Expenses</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Costs</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Profit/Loss</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {truckData.map((row, idx) => (
                    <tr key={row.truck_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                            <TruckIcon size={16} className="text-blue-600" />
                          </div>
                          <span className="font-semibold text-slate-900">{row.truck_number}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{row.total_trips}</td>
                      <td className="px-6 py-4 text-green-600 font-medium">₹{parseFloat(row.income || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4 text-amber-600">₹{parseFloat(row.fuel || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4 text-red-600">₹{parseFloat(row.expenses || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4 text-slate-600">₹{parseFloat(row.total_costs || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 text-sm font-bold rounded-lg ${row.profit >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          ₹{parseFloat(row.profit || 0).toLocaleString('en-IN')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Driver-wise Report */}
      {activeTab === 'driver' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <Users size={20} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Driver Performance</h3>
              </div>
              <button
                onClick={() => exportToExcel(driverData, 'driver_report')}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
              >
                <Download size={18} />
                Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver Name</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Trips</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Income Generated</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly Salary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {driverData.map((row, idx) => (
                    <tr key={row.driver_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white font-medium text-sm">
                            {row.driver_name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-900">{row.driver_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 text-sm font-medium rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-600/20">
                          {row.total_trips} trips
                        </span>
                      </td>
                      <td className="px-6 py-4 text-green-600 font-semibold">₹{parseFloat(row.income || 0).toLocaleString('en-IN')}</td>
                      <td className="px-6 py-4 text-slate-600">₹{parseFloat(row.salary_amount || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
