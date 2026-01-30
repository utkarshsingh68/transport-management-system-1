import { useState, useEffect } from 'react';
import { 
  CreditCard, Search, Filter, X, AlertTriangle, CheckCircle, Clock, 
  IndianRupee, Calendar, TrendingUp, TrendingDown, Download, Plus,
  ChevronRight, Building2, FileText, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

const Payments = () => {
  const [pendingTrips, setPendingTrips] = useState([]);
  const [summary, setSummary] = useState(null);
  const [consignerBalances, setConsignerBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [selectedConsigner, setSelectedConsigner] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'cash',
    reference_number: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pendingRes, summaryRes, balancesRes] = await Promise.all([
        api.get('/payments/pending'),
        api.get('/payments/summary'),
        api.get('/consigner-ledger/balances'),
      ]);
      setPendingTrips(pendingRes.data);
      setSummary(summaryRes.data);
      setConsignerBalances(balancesRes.data);
    } catch (error) {
      toast.error('Failed to fetch payment data');
    } finally {
      setLoading(false);
    }
  };

  const openPaymentModal = (trip) => {
    setSelectedTrip(trip);
    setPaymentForm({
      amount: trip.amount_due || '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: 'cash',
      reference_number: '',
      notes: '',
    });
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedTrip) return;

    try {
      await api.post('/payments', {
        trip_id: selectedTrip.id,
        ...paymentForm,
      });
      toast.success('Payment recorded successfully!');
      setShowPaymentModal(false);
      setSelectedTrip(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to record payment');
    }
  };

  const openLedgerModal = async (consigner) => {
    setSelectedConsigner(consigner);
    try {
      const response = await api.get(`/consigner-ledger/${consigner.id}`);
      setLedgerEntries(response.data.ledger);
      setShowLedgerModal(true);
    } catch (error) {
      toast.error('Failed to fetch ledger');
    }
  };

  const getUrgencyBadge = (urgency, status) => {
    if (status === 'overdue' || urgency === 'overdue') {
      return 'bg-red-100 text-red-700 border border-red-200';
    }
    if (urgency === 'due_today') {
      return 'bg-orange-100 text-orange-700 border border-orange-200';
    }
    if (urgency === 'due_soon') {
      return 'bg-yellow-100 text-yellow-700 border border-yellow-200';
    }
    if (status === 'partial') {
      return 'bg-blue-100 text-blue-700 border border-blue-200';
    }
    return 'bg-slate-100 text-slate-700 border border-slate-200';
  };

  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'partial': return 'bg-blue-100 text-blue-700';
      case 'overdue': return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const filteredPendingTrips = pendingTrips.filter(trip => 
    trip.trip_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trip.consigner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trip.truck_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredConsigners = consignerBalances.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Payment Management</h1>
          <p className="text-slate-600 mt-1">Track trip payments and consigner ledger</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Freight</p>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary?.total_freight)}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <IndianRupee className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Collected</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary?.total_collected)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{formatCurrency(summary?.total_pending)}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Clock className="text-yellow-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(summary?.overdue_amount)}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
          </div>
          {summary?.overdue_trips > 0 && (
            <p className="text-xs text-red-600 mt-2">{summary.overdue_trips} trips overdue</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'pending'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Clock size={20} />
              Pending Payments
              {pendingTrips.length > 0 && (
                <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full text-xs">
                  {pendingTrips.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
              activeTab === 'ledger'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Building2 size={20} />
              Consigner Udhari
            </div>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder={activeTab === 'pending' ? "Search trips, consigners..." : "Search consigners..."}
              className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === 'pending' && (
            <div className="space-y-3">
              {filteredPendingTrips.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle size={48} className="mx-auto text-green-400 mb-3" />
                  <p className="text-slate-600">No pending payments!</p>
                  <p className="text-slate-400 text-sm">All trip payments are up to date</p>
                </div>
              ) : (
                filteredPendingTrips.map((trip) => (
                  <div
                    key={trip.id}
                    className="bg-slate-50 rounded-xl p-4 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-slate-900">{trip.trip_number}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getUrgencyBadge(trip.urgency, trip.payment_status)}`}>
                            {trip.payment_status === 'overdue' ? '⚠️ Overdue' : 
                             trip.urgency === 'due_today' ? '📅 Due Today' :
                             trip.urgency === 'due_soon' ? '⏰ Due Soon' :
                             trip.payment_status === 'partial' ? '📊 Partial' : '⏳ Pending'}
                          </span>
                        </div>
                        <div className="text-sm text-slate-600 space-y-1">
                          <p>🚚 {trip.truck_number} • {trip.from_location} → {trip.to_location}</p>
                          {trip.consigner_name && <p>🏢 {trip.consigner_name}</p>}
                          {trip.payment_due_date && (
                            <p>📅 Due: {new Date(trip.payment_due_date).toLocaleDateString('en-IN')}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-right">
                          <p className="text-sm text-slate-500">Freight: {formatCurrency(trip.freight_amount)}</p>
                          <p className="text-lg font-bold text-red-600">Due: {formatCurrency(trip.amount_due)}</p>
                          {parseFloat(trip.amount_paid) > 0 && (
                            <p className="text-xs text-green-600">Paid: {formatCurrency(trip.amount_paid)}</p>
                          )}
                        </div>
                        <button
                          onClick={() => openPaymentModal(trip)}
                          className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium text-sm hover:shadow-lg transition-all flex items-center gap-2"
                        >
                          <Plus size={16} />
                          Record Payment
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'ledger' && (
            <div className="space-y-3">
              {filteredConsigners.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 size={48} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No consigners found</p>
                </div>
              ) : (
                filteredConsigners.map((consigner) => (
                  <div
                    key={consigner.id}
                    className="bg-slate-50 rounded-xl p-4 hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={() => openLedgerModal(consigner)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-slate-900">{consigner.name}</h3>
                        <p className="text-sm text-slate-600">
                          {consigner.phone} • {consigner.total_trips || 0} trips
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm text-slate-500">Outstanding</p>
                          <p className={`text-lg font-bold ${
                            parseFloat(consigner.outstanding_balance) > 0 
                              ? 'text-red-600' 
                              : parseFloat(consigner.outstanding_balance) < 0 
                                ? 'text-green-600' 
                                : 'text-slate-600'
                          }`}>
                            {formatCurrency(Math.abs(consigner.outstanding_balance))}
                            {parseFloat(consigner.outstanding_balance) < 0 && ' (Advance)'}
                          </p>
                        </div>
                        <ChevronRight className="text-slate-400" size={20} />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedTrip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Record Payment</h2>
                <p className="text-sm text-slate-600">{selectedTrip.trip_number}</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Total Freight</span>
                  <span className="font-medium">{formatCurrency(selectedTrip.freight_amount)}</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Already Paid</span>
                  <span className="font-medium text-green-600">{formatCurrency(selectedTrip.amount_paid)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2 mt-2">
                  <span className="text-slate-900">Due Amount</span>
                  <span className="text-red-600">{formatCurrency(selectedTrip.amount_due)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  max={selectedTrip.amount_due}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Date *</label>
                <input
                  type="date"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Mode</label>
                <select
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                  value={paymentForm.payment_mode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Reference Number</label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Transaction ID, Cheque No., etc."
                  value={paymentForm.reference_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                <textarea
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                  rows="2"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold shadow-lg shadow-green-500/30 hover:shadow-green-500/40"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ledger Modal */}
      {showLedgerModal && selectedConsigner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selectedConsigner.name}</h2>
                <p className="text-sm text-slate-600">Udhari Ledger • {selectedConsigner.phone}</p>
              </div>
              <button
                onClick={() => setShowLedgerModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-slate-600">Outstanding Balance</p>
                  <p className={`text-2xl font-bold ${
                    parseFloat(selectedConsigner.outstanding_balance) > 0 
                      ? 'text-red-600' 
                      : 'text-green-600'
                  }`}>
                    {formatCurrency(Math.abs(selectedConsigner.outstanding_balance))}
                    {parseFloat(selectedConsigner.outstanding_balance) < 0 && ' (Advance)'}
                  </p>
                </div>
                <div className="text-right text-sm text-slate-600">
                  <p>Total Freight: {formatCurrency(selectedConsigner.total_freight)}</p>
                  <p>Total Paid: {formatCurrency(selectedConsigner.total_paid)}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {ledgerEntries.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No ledger entries found
                </div>
              ) : (
                <div className="space-y-3">
                  {ledgerEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-4 rounded-xl border ${
                        entry.transaction_type === 'credit' 
                          ? 'bg-red-50 border-red-100' 
                          : 'bg-green-50 border-green-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            entry.transaction_type === 'credit' 
                              ? 'bg-red-100' 
                              : 'bg-green-100'
                          }`}>
                            {entry.transaction_type === 'credit' ? (
                              <ArrowUpRight className="text-red-600" size={20} />
                            ) : (
                              <ArrowDownRight className="text-green-600" size={20} />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{entry.description}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(entry.transaction_date).toLocaleDateString('en-IN')}
                              {entry.trip_number && ` • Trip: ${entry.trip_number}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${
                            entry.transaction_type === 'credit' ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {entry.transaction_type === 'credit' ? '+' : '-'}{formatCurrency(entry.amount)}
                          </p>
                          <p className="text-xs text-slate-500">
                            Balance: {formatCurrency(entry.balance_after)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
