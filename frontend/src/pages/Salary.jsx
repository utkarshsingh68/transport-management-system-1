import { useState, useEffect } from 'react';
import { Plus, Wallet, CreditCard, Users, Clock, DollarSign, X } from 'lucide-react';
import api from '../services/api';

export default function Salary() {
  const [activeTab, setActiveTab] = useState('salaries');
  const [salaries, setSalaries] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    driver_id: '', payment_date: new Date().toISOString().split('T')[0], month: '',
    basic_salary: '', allowances: 0, deductions: 0, advance_adjusted: 0, payment_mode: 'cash', notes: ''
  });
  const [advanceForm, setAdvanceForm] = useState({
    driver_id: '', advance_date: new Date().toISOString().split('T')[0],
    amount: '', purpose: '', payment_mode: 'cash', notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [salariesRes, advancesRes, driversRes] = await Promise.all([
        api.get('/salary/salaries'),
        api.get('/salary/advances'),
        api.get('/drivers')
      ]);
      setSalaries(salariesRes.data);
      setAdvances(advancesRes.data);
      setDrivers(driversRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSalarySubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/salary/salaries', salaryForm);
      setShowSalaryModal(false);
      setSalaryForm({ driver_id: '', payment_date: new Date().toISOString().split('T')[0], month: '', basic_salary: '', allowances: 0, deductions: 0, advance_adjusted: 0, payment_mode: 'cash', notes: '' });
      fetchData();
    } catch (error) {
      console.error('Error saving salary:', error);
    }
  };

  const handleAdvanceSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/salary/advances', advanceForm);
      setShowAdvanceModal(false);
      setAdvanceForm({ driver_id: '', advance_date: new Date().toISOString().split('T')[0], amount: '', purpose: '', payment_mode: 'cash', notes: '' });
      fetchData();
    } catch (error) {
      console.error('Error saving advance:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  // Calculate pending advances per driver
  const pendingAdvances = advances.filter(a => !a.is_adjusted).reduce((acc, a) => {
    acc[a.driver_id] = (acc[a.driver_id] || 0) + parseFloat(a.amount);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-slate-500">
          <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          Loading salary data...
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'salaries', label: 'Salary Payments', icon: Wallet },
    { id: 'advances', label: 'Advances', icon: CreditCard },
    { id: 'summary', label: 'Driver Summary', icon: Users },
  ];

  const totalSalariesPaid = salaries.reduce((sum, s) => sum + parseFloat(s.net_amount), 0);
  const thisMonthSalaries = salaries.filter(s => s.month === new Date().toISOString().slice(0, 7)).reduce((sum, s) => sum + parseFloat(s.net_amount), 0);
  const totalAdvances = advances.reduce((sum, a) => sum + parseFloat(a.amount), 0);
  const pendingAdvancesTotal = advances.filter(a => !a.is_adjusted).reduce((sum, a) => sum + parseFloat(a.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Salary & Advances</h1>
          <p className="text-slate-500 mt-1">Manage driver salaries and advance payments</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAdvanceModal(true)} 
            className="flex items-center gap-2 px-4 py-2.5 border border-amber-500 text-amber-600 rounded-xl font-medium hover:bg-amber-50 transition-colors"
          >
            <Plus size={18} />
            Add Advance
          </button>
          <button 
            onClick={() => setShowSalaryModal(true)} 
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg shadow-green-500/30 hover:shadow-green-500/40 transition-all"
          >
            <Plus size={20} />
            Pay Salary
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Salaries Paid</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalSalariesPaid)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30">
              <Wallet size={24} className="text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">This Month</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(thisMonthSalaries)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <DollarSign size={24} className="text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Advances</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalAdvances)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <CreditCard size={24} className="text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Pending Advances</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(pendingAdvancesTotal)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Clock size={24} className="text-white" />
            </div>
          </div>
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
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'salaries' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Month</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Basic</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Allowances</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Deductions</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Advance Adj.</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Amount</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salaries.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-12 text-center">
                      <Wallet size={48} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-500 font-medium">No salary payments found</p>
                    </td>
                  </tr>
                ) : (
                  salaries.map((salary, idx) => (
                    <tr key={salary.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-6 py-4 text-slate-600">{new Date(salary.payment_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-medium text-sm">
                            {salary.driver_name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-900">{salary.driver_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-blue-50 text-blue-700">{salary.month}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-700">{formatCurrency(salary.basic_salary)}</td>
                      <td className="px-6 py-4 text-right text-green-600">+{formatCurrency(salary.allowances)}</td>
                      <td className="px-6 py-4 text-right text-red-600">-{formatCurrency(salary.deductions)}</td>
                      <td className="px-6 py-4 text-right text-amber-600">-{formatCurrency(salary.advance_adjusted)}</td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(salary.net_amount)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ring-1 capitalize ${salary.payment_mode === 'cash' ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-blue-50 text-blue-700 ring-blue-600/20'}`}>
                          {salary.payment_mode}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'advances' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Purpose</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mode</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {advances.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <CreditCard size={48} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-500 font-medium">No advances found</p>
                    </td>
                  </tr>
                ) : (
                  advances.map((advance, idx) => (
                    <tr key={advance.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-6 py-4 text-slate-600">{new Date(advance.advance_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-medium text-sm">
                            {advance.driver_name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-900">{advance.driver_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-amber-600">{formatCurrency(advance.amount)}</td>
                      <td className="px-6 py-4 text-slate-600">{advance.purpose || '-'}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ring-1 capitalize ${advance.payment_mode === 'cash' ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-blue-50 text-blue-700 ring-blue-600/20'}`}>
                          {advance.payment_mode}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ring-1 ${advance.is_adjusted ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'}`}>
                          {advance.is_adjusted ? 'Adjusted' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Base Salary</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Paid</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Advances</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drivers.filter(d => d.status === 'active').length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <Users size={48} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-500 font-medium">No active drivers found</p>
                    </td>
                  </tr>
                ) : (
                  drivers.filter(d => d.status === 'active').map((driver, idx) => (
                    <tr key={driver.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-medium text-sm">
                            {driver.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-900">{driver.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{driver.phone || '-'}</td>
                      <td className="px-6 py-4 text-right text-slate-700">{formatCurrency(driver.salary_amount || 0)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-green-600">
                        {formatCurrency(salaries.filter(s => s.driver_id === driver.id).reduce((sum, s) => sum + parseFloat(s.net_amount), 0))}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-amber-600">
                        {formatCurrency(pendingAdvances[driver.id] || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Salary Modal */}
      {showSalaryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Pay Salary</h2>
                <p className="text-slate-500 mt-1">Process a salary payment</p>
              </div>
              <button 
                onClick={() => setShowSalaryModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSalarySubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Driver *</label>
                <select value={salaryForm.driver_id} onChange={(e) => {
                  const driver = drivers.find(d => d.id == e.target.value);
                  setSalaryForm({ ...salaryForm, driver_id: e.target.value, basic_salary: driver?.salary_amount || '', advance_adjusted: pendingAdvances[e.target.value] || 0 });
                }} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all bg-white" required>
                  <option value="">Select Driver</option>
                  {drivers.filter(d => d.status === 'active').map((driver) => (
                    <option key={driver.id} value={driver.id}>{driver.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Date *</label>
                  <input type="date" value={salaryForm.payment_date} onChange={(e) => setSalaryForm({ ...salaryForm, payment_date: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">For Month *</label>
                  <input type="month" value={salaryForm.month} onChange={(e) => setSalaryForm({ ...salaryForm, month: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Basic Salary *</label>
                  <input type="number" value={salaryForm.basic_salary} onChange={(e) => setSalaryForm({ ...salaryForm, basic_salary: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all" placeholder="0" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Allowances</label>
                  <input type="number" value={salaryForm.allowances} onChange={(e) => setSalaryForm({ ...salaryForm, allowances: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Deductions</label>
                  <input type="number" value={salaryForm.deductions} onChange={(e) => setSalaryForm({ ...salaryForm, deductions: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Advance Adjusted</label>
                  <input type="number" value={salaryForm.advance_adjusted} onChange={(e) => setSalaryForm({ ...salaryForm, advance_adjusted: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Mode</label>
                <select value={salaryForm.payment_mode} onChange={(e) => setSalaryForm({ ...salaryForm, payment_mode: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all bg-white">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
                <div className="text-sm text-green-700">Net Payable Amount</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency((parseFloat(salaryForm.basic_salary) || 0) + (parseFloat(salaryForm.allowances) || 0) - (parseFloat(salaryForm.deductions) || 0) - (parseFloat(salaryForm.advance_adjusted) || 0))}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setShowSalaryModal(false)} className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg shadow-green-500/30 hover:shadow-green-500/40 transition-all">Pay Salary</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advance Modal */}
      {showAdvanceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Add Advance</h2>
                <p className="text-slate-500 mt-1">Record an advance payment</p>
              </div>
              <button 
                onClick={() => setShowAdvanceModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAdvanceSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Driver *</label>
                <select value={advanceForm.driver_id} onChange={(e) => setAdvanceForm({ ...advanceForm, driver_id: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all bg-white" required>
                  <option value="">Select Driver</option>
                  {drivers.filter(d => d.status === 'active').map((driver) => (
                    <option key={driver.id} value={driver.id}>{driver.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date *</label>
                  <input type="date" value={advanceForm.advance_date} onChange={(e) => setAdvanceForm({ ...advanceForm, advance_date: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount *</label>
                  <input type="number" value={advanceForm.amount} onChange={(e) => setAdvanceForm({ ...advanceForm, amount: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all" placeholder="0" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Purpose</label>
                <input type="text" value={advanceForm.purpose} onChange={(e) => setAdvanceForm({ ...advanceForm, purpose: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all" placeholder="Reason for advance" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Mode</label>
                <select value={advanceForm.payment_mode} onChange={(e) => setAdvanceForm({ ...advanceForm, payment_mode: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all bg-white">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setShowAdvanceModal(false)} className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-semibold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/40 transition-all">Save Advance</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
