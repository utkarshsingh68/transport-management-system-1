import { useState, useEffect } from 'react';
import { 
  Wallet, Plus, X, AlertTriangle, Check, Calendar, CreditCard,
  IndianRupee, TrendingDown, Clock, CheckCircle, Eye, DollarSign,
  Calculator, Truck, Building2, Edit2, Trash2
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

const Loans = () => {
  const [loans, setLoans] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trucks, setTrucks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTruck, setFilterTruck] = useState('');
  const [emiPreview, setEmiPreview] = useState(null);

  const initialForm = {
    loan_type: 'vehicle', principal_amount: '', interest_rate: '',
    loan_term_months: '', emi_amount: '', start_date: new Date().toISOString().split('T')[0],
    lender_name: '', loan_account_number: '', truck_id: '',
    interest_type: 'reducing', notes: ''
  };
  const [form, setForm] = useState(initialForm);

  const [paymentForm, setPaymentForm] = useState({
    emi_id: '', amount: '', payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'bank_transfer', reference_number: ''
  });

  useEffect(() => {
    fetchLoans();
    fetchSummary();
    fetchTrucks();
  }, [filterStatus, filterTruck]);

  const fetchLoans = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterTruck) params.append('truck_id', filterTruck);
      
      const res = await api.get(`/loans?${params.toString()}`);
      setLoans(res.data);
    } catch (error) {
      toast.error('Failed to load loans');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await api.get('/loans/stats/summary');
      setSummary(res.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const fetchTrucks = async () => {
    try {
      const res = await api.get('/trucks');
      setTrucks(res.data);
    } catch (error) {
      console.error('Error fetching trucks:', error);
    }
  };

  const fetchSchedule = async (loanId) => {
    try {
      const res = await api.get(`/loans/${loanId}/schedule`);
      setSchedule(res.data);
    } catch (error) {
      toast.error('Failed to load EMI schedule');
    }
  };

  const calculateEMI = async () => {
    if (!form.principal_amount || !form.interest_rate || !form.loan_term_months) return;
    
    try {
      const res = await api.post('/loans/calculate-emi', {
        principal: parseFloat(form.principal_amount),
        annual_interest_rate: parseFloat(form.interest_rate),
        tenure_months: parseInt(form.loan_term_months),
        interest_type: form.interest_type
      });
      setEmiPreview(res.data);
      setForm({ ...form, emi_amount: Math.round(res.data.emi_amount) });
    } catch (error) {
      console.error('EMI calculation error:', error);
    }
  };

  const handleSaveLoan = async (e) => {
    e.preventDefault();
    try {
      if (selectedLoan) {
        await api.put(`/loans/${selectedLoan.id}`, form);
        toast.success('Loan updated');
      } else {
        await api.post('/loans', form);
        toast.success('Loan added with EMI schedule');
      }
      setShowModal(false);
      setForm(initialForm);
      setSelectedLoan(null);
      setEmiPreview(null);
      fetchLoans();
      fetchSummary();
    } catch (error) {
      toast.error('Failed to save loan');
    }
  };

  const handleEdit = (loan) => {
    setSelectedLoan(loan);
    setForm({
      loan_type: loan.loan_type,
      principal_amount: loan.principal_amount,
      interest_rate: loan.interest_rate,
      loan_term_months: loan.loan_term_months,
      emi_amount: loan.emi_amount,
      start_date: loan.start_date?.split('T')[0] || '',
      lender_name: loan.lender_name || '',
      loan_account_number: loan.loan_account_number || '',
      truck_id: loan.truck_id || '',
      interest_type: loan.interest_type || 'reducing',
      notes: loan.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this loan? This will also delete all EMI records.')) {
      try {
        await api.delete(`/loans/${id}`);
        toast.success('Loan deleted');
        fetchLoans();
        fetchSummary();
      } catch (error) {
        toast.error('Failed to delete loan');
      }
    }
  };

  const handleViewSchedule = async (loan) => {
    setSelectedLoan(loan);
    await fetchSchedule(loan.id);
    setShowScheduleModal(true);
  };

  const openPaymentModal = (loan, emi = null) => {
    setSelectedLoan(loan);
    setPaymentForm({
      emi_id: emi?.id || '',
      amount: emi?.emi_amount || loan.emi_amount,
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: 'bank_transfer',
      reference_number: ''
    });
    setShowPaymentModal(true);
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/loans/${selectedLoan.id}/pay`, paymentForm);
      toast.success('Payment recorded');
      setShowPaymentModal(false);
      fetchLoans();
      fetchSummary();
      if (showScheduleModal) {
        fetchSchedule(selectedLoan.id);
      }
    } catch (error) {
      toast.error('Failed to record payment');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    const badges = {
      'active': { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock },
      'closed': { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
      'overdue': { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle }
    };
    const badge = badges[status] || badges.active;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${badge.bg} ${badge.text}`}>
        <Icon size={12} />
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">EMI & Loan Tracking</h1>
          <p className="text-gray-600">Manage truck loans and track EMI payments</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setSelectedLoan(null); setForm(initialForm); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} />
          Add Loan
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Wallet className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Outstanding</p>
                <p className="text-xl font-bold">{formatCurrency(summary.total_outstanding)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-lg">
                <DollarSign className="text-green-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Paid</p>
                <p className="text-xl font-bold">{formatCurrency(summary.total_paid)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2 rounded-lg">
                <Calendar className="text-orange-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">This Month EMI</p>
                <p className="text-xl font-bold">{formatCurrency(summary.this_month_emi)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-2 rounded-lg">
                <AlertTriangle className="text-red-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">Overdue Amount</p>
                <p className="text-xl font-bold">{formatCurrency(summary.overdue_amount)}</p>
                {summary.overdue_emis > 0 && (
                  <p className="text-xs text-red-500">{summary.overdue_emis} EMIs overdue</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="overdue">Overdue</option>
        </select>
        <select
          value={filterTruck}
          onChange={(e) => setFilterTruck(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Trucks</option>
          {trucks.map(t => (
            <option key={t.id} value={t.id}>{t.truck_number}</option>
          ))}
        </select>
      </div>

      {/* Loans List */}
      <div className="grid gap-4">
        {loans.map((loan) => (
          <div key={loan.id} className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 uppercase">
                    {loan.loan_type}
                  </span>
                  {getStatusBadge(loan.status)}
                  {loan.truck_number && (
                    <span className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">
                      <Truck size={12} />
                      {loan.truck_number}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-semibold">{loan.lender_name || 'Loan'}</h3>
                {loan.loan_account_number && (
                  <p className="text-sm text-gray-500">A/C: {loan.loan_account_number}</p>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Principal</p>
                  <p className="font-semibold">{formatCurrency(loan.principal_amount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Outstanding</p>
                  <p className="font-semibold text-orange-600">{formatCurrency(loan.outstanding_amount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">EMI Amount</p>
                  <p className="font-semibold">{formatCurrency(loan.emi_amount)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Interest</p>
                  <p className="font-semibold">{loan.interest_rate}% ({loan.interest_type})</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleViewSchedule(loan)}
                  className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
                >
                  <Eye size={14} />
                  Schedule
                </button>
                {loan.status !== 'closed' && (
                  <button
                    onClick={() => openPaymentModal(loan)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                  >
                    <IndianRupee size={14} />
                    Pay EMI
                  </button>
                )}
                <button
                  onClick={() => handleEdit(loan)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(loan.id)}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress: {loan.paid_emis}/{loan.total_emis} EMIs</span>
                <span>{Math.round((loan.paid_emis / loan.total_emis) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${(loan.paid_emis / loan.total_emis) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        ))}
        {loans.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-500">
            No loans found. Add a loan to get started.
          </div>
        )}
      </div>

      {/* Add/Edit Loan Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{selectedLoan ? 'Edit Loan' : 'Add New Loan'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveLoan} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loan Type</label>
                  <select
                    value={form.loan_type}
                    onChange={(e) => setForm({ ...form, loan_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="vehicle">Vehicle Loan</option>
                    <option value="working_capital">Working Capital</option>
                    <option value="equipment">Equipment Loan</option>
                    <option value="personal">Personal Loan</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Linked Truck</label>
                  <select
                    value={form.truck_id}
                    onChange={(e) => setForm({ ...form, truck_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">-- None --</option>
                    {trucks.map(t => (
                      <option key={t.id} value={t.id}>{t.truck_number}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lender Name</label>
                  <input
                    type="text"
                    value={form.lender_name}
                    onChange={(e) => setForm({ ...form, lender_name: e.target.value })}
                    placeholder="Bank or Finance Company"
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loan Account Number</label>
                  <input
                    type="text"
                    value={form.loan_account_number}
                    onChange={(e) => setForm({ ...form, loan_account_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Principal Amount (₹)</label>
                  <input
                    type="number"
                    value={form.principal_amount}
                    onChange={(e) => setForm({ ...form, principal_amount: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (% p.a.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.interest_rate}
                    onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loan Term (Months)</label>
                  <input
                    type="number"
                    value={form.loan_term_months}
                    onChange={(e) => setForm({ ...form, loan_term_months: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interest Type</label>
                  <select
                    value={form.interest_type}
                    onChange={(e) => setForm({ ...form, interest_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="reducing">Reducing Balance</option>
                    <option value="flat">Flat Rate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={calculateEMI}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <Calculator size={18} />
                    Calculate EMI
                  </button>
                </div>
              </div>

              {/* EMI Preview */}
              {emiPreview && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">EMI Calculation Preview</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Monthly EMI</p>
                      <p className="font-bold text-lg">{formatCurrency(emiPreview.emi_amount)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Interest</p>
                      <p className="font-semibold">{formatCurrency(emiPreview.total_interest)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Total Payment</p>
                      <p className="font-semibold">{formatCurrency(emiPreview.total_payment)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">EMI Amount (₹)</label>
                <input
                  type="number"
                  value={form.emi_amount}
                  onChange={(e) => setForm({ ...form, emi_amount: e.target.value })}
                  placeholder="Auto-calculated or enter manually"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows="2"
                  className="w-full px-3 py-2 border rounded-lg"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  {selectedLoan ? 'Update Loan' : 'Add Loan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMI Schedule Modal */}
      {showScheduleModal && selectedLoan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">EMI Schedule</h2>
                <p className="text-sm text-gray-500">{selectedLoan.lender_name} - {selectedLoan.truck_number || 'No truck linked'}</p>
              </div>
              <button onClick={() => setShowScheduleModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">#</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Due Date</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">EMI</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Principal</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Interest</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Balance</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-600">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {schedule.map((emi) => (
                      <tr key={emi.id} className={`${
                        emi.status === 'paid' ? 'bg-green-50' : 
                        emi.status === 'overdue' ? 'bg-red-50' : ''
                      }`}>
                        <td className="px-4 py-3">{emi.emi_number}</td>
                        <td className="px-4 py-3">{new Date(emi.due_date).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(emi.emi_amount)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(emi.principal_component)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(emi.interest_component)}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(emi.remaining_balance)}</td>
                        <td className="px-4 py-3 text-center">
                          {emi.status === 'paid' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                              <CheckCircle size={12} />
                              Paid
                            </span>
                          )}
                          {emi.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                              <Clock size={12} />
                              Pending
                            </span>
                          )}
                          {emi.status === 'overdue' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
                              <AlertTriangle size={12} />
                              Overdue
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {emi.status !== 'paid' && (
                            <button
                              onClick={() => openPaymentModal(selectedLoan, emi)}
                              className="px-2 py-1 text-green-600 hover:bg-green-50 rounded text-xs"
                            >
                              Pay
                            </button>
                          )}
                          {emi.paid_date && (
                            <span className="text-xs text-gray-500">
                              {new Date(emi.paid_date).toLocaleDateString('en-IN')}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedLoan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Record EMI Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handlePayment} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <p><span className="text-gray-500">Loan:</span> {selectedLoan.lender_name}</p>
                <p><span className="text-gray-500">EMI Amount:</span> {formatCurrency(selectedLoan.emi_amount)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount (₹)</label>
                <input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                <select
                  value={paymentForm.payment_mode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="auto_debit">Auto Debit</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                <input
                  type="text"
                  value={paymentForm.reference_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                  placeholder="Transaction ID / Cheque No."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Loans;
