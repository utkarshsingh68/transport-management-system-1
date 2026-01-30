import { useState, useEffect } from 'react';
import { 
  CreditCard, Search, X, AlertTriangle, CheckCircle, Clock, 
  IndianRupee, Calendar, TrendingUp, Plus,
  ChevronRight, Building2, ArrowUpRight, ArrowDownRight,
  PieChart, BarChart3, FileText, Download, 
  Wallet, Filter, RefreshCw, Eye, Users
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

const Payments = () => {
  const [pendingTrips, setPendingTrips] = useState([]);
  const [summary, setSummary] = useState(null);
  const [consignerBalances, setConsignerBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [selectedConsigner, setSelectedConsigner] = useState(null);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUrgency, setFilterUrgency] = useState('all');
  const [agingData, setAgingData] = useState(null);
  const [selectedTripsForBulk, setSelectedTripsForBulk] = useState([]);
  const [showStatementModal, setShowStatementModal] = useState(false);

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
      
      calculateAgingData(pendingRes.data);
    } catch (error) {
      toast.error('Failed to fetch payment data');
    } finally {
      setLoading(false);
    }
  };

  const calculateAgingData = (trips) => {
    const today = new Date();
    const aging = {
      current: { count: 0, amount: 0 },
      days_1_30: { count: 0, amount: 0 },
      days_31_60: { count: 0, amount: 0 },
      days_61_90: { count: 0, amount: 0 },
      days_90_plus: { count: 0, amount: 0 },
    };

    trips.forEach(trip => {
      const dueDate = trip.payment_due_date ? new Date(trip.payment_due_date) : null;
      const amount = parseFloat(trip.amount_due) || 0;
      
      if (!dueDate || dueDate >= today) {
        aging.current.count++;
        aging.current.amount += amount;
      } else {
        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        
        if (daysOverdue <= 30) {
          aging.days_1_30.count++;
          aging.days_1_30.amount += amount;
        } else if (daysOverdue <= 60) {
          aging.days_31_60.count++;
          aging.days_31_60.amount += amount;
        } else if (daysOverdue <= 90) {
          aging.days_61_90.count++;
          aging.days_61_90.amount += amount;
        } else {
          aging.days_90_plus.count++;
          aging.days_90_plus.amount += amount;
        }
      }
    });

    setAgingData(aging);
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

  const handleBulkPayment = async (e) => {
    e.preventDefault();
    if (selectedTripsForBulk.length === 0) return;

    try {
      for (const trip of selectedTripsForBulk) {
        await api.post('/payments', {
          trip_id: trip.id,
          amount: trip.amount_due,
          payment_date: paymentForm.payment_date,
          payment_mode: paymentForm.payment_mode,
          reference_number: paymentForm.reference_number,
          notes: `Bulk payment - ${paymentForm.notes}`,
        });
      }
      toast.success(`${selectedTripsForBulk.length} payments recorded successfully!`);
      setShowBulkPaymentModal(false);
      setSelectedTripsForBulk([]);
      fetchData();
    } catch (error) {
      toast.error('Some payments failed. Please check and retry.');
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

  const openStatementModal = async (consigner) => {
    setSelectedConsigner(consigner);
    try {
      const response = await api.get(`/consigner-ledger/${consigner.id}`);
      setLedgerEntries(response.data.ledger);
      setShowStatementModal(true);
    } catch (error) {
      toast.error('Failed to fetch statement');
    }
  };

  const toggleTripSelection = (trip) => {
    setSelectedTripsForBulk(prev => {
      const isSelected = prev.find(t => t.id === trip.id);
      if (isSelected) {
        return prev.filter(t => t.id !== trip.id);
      }
      return [...prev, trip];
    });
  };

  const selectAllTripsForConsigner = (consignerId) => {
    const consignerTrips = pendingTrips.filter(t => t.consigner_id === consignerId);
    setSelectedTripsForBulk(consignerTrips);
    setShowBulkPaymentModal(true);
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const getDaysOverdue = (dueDate) => {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diff = Math.floor((today - due) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  };

  const filteredPendingTrips = pendingTrips.filter(trip => {
    const matchesSearch = 
      trip.trip_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trip.consigner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      trip.truck_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterUrgency === 'all') return matchesSearch;
    if (filterUrgency === 'overdue') return matchesSearch && trip.payment_status === 'overdue';
    if (filterUrgency === 'due_soon') return matchesSearch && (trip.urgency === 'due_soon' || trip.urgency === 'due_today');
    if (filterUrgency === 'partial') return matchesSearch && trip.payment_status === 'partial';
    return matchesSearch;
  });

  const filteredConsigners = consignerBalances.filter(c =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  const totalBulkAmount = selectedTripsForBulk.reduce((sum, t) => sum + parseFloat(t.amount_due || 0), 0);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Payment Management</h1>
          <p className="text-slate-600 mt-1">Track payments, collections & consigner udhari</p>
        </div>
        <button
          onClick={fetchData}
          className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={20} className="text-slate-600" />
        </button>
      </div>

      {/* Alert Banner */}
      {agingData && agingData.days_90_plus.count > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="text-red-600" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Critical: {agingData.days_90_plus.count} payments overdue by 90+ days</h3>
            <p className="text-red-700 text-sm">Total outstanding: {formatCurrency(agingData.days_90_plus.amount)}</p>
          </div>
          <button 
            onClick={() => { setActiveTab('pending'); setFilterUrgency('overdue'); }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            View Now
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-600">Total Freight</p>
              <p className="text-lg md:text-2xl font-bold text-slate-900">{formatCurrency(summary?.total_freight)}</p>
              <p className="text-xs text-slate-500 mt-1">{summary?.total_trips || 0} trips</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <IndianRupee className="text-blue-600" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-600">Collected</p>
              <p className="text-lg md:text-2xl font-bold text-green-600">{formatCurrency(summary?.total_collected)}</p>
              <p className="text-xs text-green-600 mt-1">{summary?.paid_trips || 0} paid</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle className="text-green-600" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-600">Pending</p>
              <p className="text-lg md:text-2xl font-bold text-yellow-600">{formatCurrency(summary?.total_pending)}</p>
              <p className="text-xs text-yellow-600 mt-1">{(summary?.pending_trips || 0) + (summary?.partial_trips || 0)} pending</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Clock className="text-yellow-600" size={20} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-slate-200/60">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-600">Overdue</p>
              <p className="text-lg md:text-2xl font-bold text-red-600">{formatCurrency(summary?.overdue_amount)}</p>
              <p className="text-xs text-red-600 mt-1">{summary?.overdue_trips || 0} overdue</p>
            </div>
            <div className="w-10 h-10 md:w-12 md:h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="text-red-600" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Aging Analysis */}
      {agingData && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/60">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 size={20} className="text-slate-600" />
            Outstanding Aging Analysis
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { key: 'current', label: 'Current', color: 'green' },
              { key: 'days_1_30', label: '1-30 Days', color: 'yellow' },
              { key: 'days_31_60', label: '31-60 Days', color: 'orange' },
              { key: 'days_61_90', label: '61-90 Days', color: 'red' },
              { key: 'days_90_plus', label: '90+ Days', color: 'red' },
            ].map(({ key, label, color }) => (
              <div key={key} className={`bg-${color}-50 rounded-xl p-3 border border-${color}-${key === 'days_90_plus' ? '200' : '100'}`}>
                <p className={`text-xs text-${color}-700 font-medium`}>{label}</p>
                <p className={`text-xl font-bold text-${color}-700`}>{formatCurrency(agingData[key].amount)}</p>
                <p className={`text-xs text-${color}-600`}>{agingData[key].count} trips</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: PieChart },
            { id: 'pending', label: 'Pending', icon: Clock, badge: pendingTrips.length },
            { id: 'ledger', label: 'Consigner Udhari', icon: Building2 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[120px] py-3 px-4 text-center font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <tab.icon size={18} />
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full text-xs">
                    {tab.badge}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search trips, consigners..."
              className="w-full pl-12 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {activeTab === 'pending' && (
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-slate-400" />
              <select
                className="px-3 py-2.5 border border-slate-200 rounded-xl bg-white text-sm"
                value={filterUrgency}
                onChange={(e) => setFilterUrgency(e.target.value)}
              >
                <option value="all">All Pending</option>
                <option value="overdue">Overdue Only</option>
                <option value="due_soon">Due Soon</option>
                <option value="partial">Partial Paid</option>
              </select>
              {selectedTripsForBulk.length > 0 && (
                <button
                  onClick={() => setShowBulkPaymentModal(true)}
                  className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 flex items-center gap-2"
                >
                  <Wallet size={16} />
                  Pay {selectedTripsForBulk.length}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Collection Rate */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-900">Collection Rate</h4>
                  <span className="text-2xl font-bold text-blue-600">
                    {summary?.total_freight > 0 
                      ? Math.round((summary.total_collected / summary.total_freight) * 100) 
                      : 0}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all"
                    style={{ 
                      width: `${summary?.total_freight > 0 
                        ? Math.round((summary.total_collected / summary.total_freight) * 100) 
                        : 0}%` 
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-slate-600">Collected: {formatCurrency(summary?.total_collected)}</span>
                  <span className="text-slate-600">Total: {formatCurrency(summary?.total_freight)}</span>
                </div>
              </div>

              {/* Top Consigners */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Users size={18} />
                  Top Outstanding Consigners
                </h4>
                <div className="space-y-2">
                  {consignerBalances
                    .filter(c => parseFloat(c.outstanding_balance) > 0)
                    .slice(0, 5)
                    .map((consigner, idx) => (
                      <div 
                        key={consigner.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
                        onClick={() => openLedgerModal(consigner)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{consigner.name}</p>
                            <p className="text-xs text-slate-500">{consigner.total_trips || 0} trips</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">{formatCurrency(consigner.outstanding_balance)}</p>
                          <button
                            onClick={(e) => { e.stopPropagation(); selectAllTripsForConsigner(consigner.id); }}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Pay All
                          </button>
                        </div>
                      </div>
                    ))}
                  {consignerBalances.filter(c => parseFloat(c.outstanding_balance) > 0).length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      <CheckCircle size={40} className="mx-auto text-green-400 mb-2" />
                      <p>No outstanding balances!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-slate-900">{summary?.total_trips || 0}</p>
                  <p className="text-xs text-slate-600">Total Trips</p>
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-green-600">{summary?.paid_trips || 0}</p>
                  <p className="text-xs text-green-700">Fully Paid</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-blue-600">{summary?.partial_trips || 0}</p>
                  <p className="text-xs text-blue-700">Partial</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-red-600">{summary?.overdue_trips || 0}</p>
                  <p className="text-xs text-red-700">Overdue</p>
                </div>
              </div>
            </div>
          )}

          {/* Pending Tab */}
          {activeTab === 'pending' && (
            <div className="space-y-3">
              {filteredPendingTrips.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle size={48} className="mx-auto text-green-400 mb-3" />
                  <p className="text-slate-600">No pending payments!</p>
                </div>
              ) : (
                filteredPendingTrips.map((trip) => {
                  const daysOverdue = getDaysOverdue(trip.payment_due_date);
                  const isSelected = selectedTripsForBulk.find(t => t.id === trip.id);
                  
                  return (
                    <div
                      key={trip.id}
                      className={`rounded-xl p-4 transition-all ${
                        isSelected ? 'bg-blue-50 border-2 border-blue-300' : 'bg-slate-50 hover:bg-slate-100 border border-transparent'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={!!isSelected}
                            onChange={() => toggleTripSelection(trip)}
                            className="w-5 h-5 mt-1 rounded border-slate-300 text-blue-600"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <span className="font-semibold text-slate-900">{trip.trip_number}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getUrgencyBadge(trip.urgency, trip.payment_status)}`}>
                                {trip.payment_status === 'overdue' ? `⚠️ ${daysOverdue} days overdue` : 
                                 trip.urgency === 'due_today' ? '📅 Due Today' :
                                 trip.urgency === 'due_soon' ? '⏰ Due Soon' :
                                 trip.payment_status === 'partial' ? '📊 Partial' : '⏳ Pending'}
                              </span>
                            </div>
                            <div className="text-sm text-slate-600 space-y-1">
                              <p>🚚 {trip.truck_number} • {trip.from_location} → {trip.to_location}</p>
                              {trip.consigner_name && <p>🏢 {trip.consigner_name}</p>}
                              {trip.payment_due_date && (
                                <p className={daysOverdue ? 'text-red-600 font-medium' : ''}>
                                  📅 Due: {new Date(trip.payment_due_date).toLocaleDateString('en-IN')}
                                </p>
                              )}
                            </div>
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
                  );
                })
              )}
            </div>
          )}

          {/* Ledger Tab */}
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
                    className="bg-slate-50 rounded-xl p-4 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="cursor-pointer" onClick={() => openLedgerModal(consigner)}>
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
                              : 'text-slate-600'
                          }`}>
                            {formatCurrency(Math.abs(consigner.outstanding_balance))}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => openLedgerModal(consigner)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="View Ledger"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            onClick={() => openStatementModal(consigner)}
                            className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg"
                            title="Statement"
                          >
                            <FileText size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {parseFloat(consigner.outstanding_balance) > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
                        <p className="text-xs text-slate-500">
                          Last payment: {consigner.last_payment_date 
                            ? new Date(consigner.last_payment_date).toLocaleDateString('en-IN')
                            : 'Never'}
                        </p>
                        <button
                          onClick={() => selectAllTripsForConsigner(consigner.id)}
                          className="text-xs text-green-600 font-medium hover:underline flex items-center gap-1"
                        >
                          <Wallet size={14} />
                          Settle All
                        </button>
                      </div>
                    )}
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
              <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
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
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    max={selectedTrip.amount_due}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setPaymentForm({ ...paymentForm, amount: selectedTrip.amount_due })}
                    className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm hover:bg-slate-200"
                  >
                    Full
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date *</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Mode</label>
                  <select
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                    value={paymentForm.payment_mode}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Reference No.</label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Transaction ID, Cheque No."
                  value={paymentForm.reference_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
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
                  className="flex-1 px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold shadow-lg shadow-green-500/30"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Payment Modal */}
      {showBulkPaymentModal && selectedTripsForBulk.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Bulk Payment</h2>
                <p className="text-sm text-slate-600">{selectedTripsForBulk.length} trips selected</p>
              </div>
              <button onClick={() => setShowBulkPaymentModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <div className="space-y-2 mb-4">
                {selectedTripsForBulk.map(trip => (
                  <div key={trip.id} className="flex justify-between items-center bg-slate-50 rounded-lg p-3">
                    <div>
                      <p className="font-medium text-sm">{trip.trip_number}</p>
                      <p className="text-xs text-slate-500">{trip.consigner_name || 'No consigner'}</p>
                    </div>
                    <p className="font-semibold text-red-600">{formatCurrency(trip.amount_due)}</p>
                  </div>
                ))}
              </div>
              
              <div className="bg-green-50 rounded-xl p-4 border border-green-200 mb-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-green-800">Total to Pay</span>
                  <span className="text-2xl font-bold text-green-700">{formatCurrency(totalBulkAmount)}</span>
                </div>
              </div>

              <form onSubmit={handleBulkPayment} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl"
                      value={paymentForm.payment_date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Mode</label>
                    <select
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-white"
                      value={paymentForm.payment_mode}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
                    >
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Reference No.</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl"
                    placeholder="Transaction ID"
                    value={paymentForm.reference_number}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowBulkPaymentModal(false); setSelectedTripsForBulk([]); }}
                    className="flex-1 px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold"
                  >
                    Pay All
                  </button>
                </div>
              </form>
            </div>
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
                <p className="text-sm text-slate-600">Udhari Ledger</p>
              </div>
              <button onClick={() => setShowLedgerModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-slate-600">Outstanding Balance</p>
                  <p className={`text-2xl font-bold ${
                    parseFloat(selectedConsigner.outstanding_balance) > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {formatCurrency(Math.abs(selectedConsigner.outstanding_balance))}
                  </p>
                </div>
                <div className="text-right text-sm text-slate-600">
                  <p>Freight: {formatCurrency(selectedConsigner.total_freight)}</p>
                  <p>Paid: {formatCurrency(selectedConsigner.total_paid)}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {ledgerEntries.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No transactions</div>
              ) : (
                <div className="space-y-3">
                  {ledgerEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-4 rounded-xl border ${
                        entry.transaction_type === 'credit' ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            entry.transaction_type === 'credit' ? 'bg-red-100' : 'bg-green-100'
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
                              {entry.trip_number && ` • ${entry.trip_number}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${entry.transaction_type === 'credit' ? 'text-red-600' : 'text-green-600'}`}>
                            {entry.transaction_type === 'credit' ? '+' : '-'}{formatCurrency(entry.amount)}
                          </p>
                          <p className="text-xs text-slate-500">Bal: {formatCurrency(entry.balance_after)}</p>
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

      {/* Statement Modal */}
      {showStatementModal && selectedConsigner && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Account Statement</h2>
                <p className="text-sm text-slate-600">{selectedConsigner.name}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="p-2 hover:bg-slate-100 rounded-lg" title="Print">
                  <Download size={20} />
                </button>
                <button onClick={() => setShowStatementModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="text-center mb-6 pb-4 border-b-2 border-slate-300">
                <h1 className="text-2xl font-bold text-slate-900">ACCOUNT STATEMENT</h1>
                <p className="text-slate-600 mt-1">Generated on {new Date().toLocaleDateString('en-IN')}</p>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="font-semibold text-slate-700 mb-2">Party Details</h3>
                  <p className="font-bold text-lg">{selectedConsigner.name}</p>
                  <p className="text-slate-600">{selectedConsigner.phone}</p>
                </div>
                <div className="text-right">
                  <h3 className="font-semibold text-slate-700 mb-2">Summary</h3>
                  <p className="text-slate-600">Total Freight: {formatCurrency(selectedConsigner.total_freight)}</p>
                  <p className="text-slate-600">Total Paid: {formatCurrency(selectedConsigner.total_paid)}</p>
                  <p className={`text-xl font-bold mt-2 ${
                    parseFloat(selectedConsigner.outstanding_balance) > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    Balance: {formatCurrency(selectedConsigner.outstanding_balance)}
                  </p>
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left p-3 font-semibold">Date</th>
                    <th className="text-left p-3 font-semibold">Description</th>
                    <th className="text-right p-3 font-semibold">Debit</th>
                    <th className="text-right p-3 font-semibold">Credit</th>
                    <th className="text-right p-3 font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map((entry, idx) => (
                    <tr key={entry.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="p-3">{new Date(entry.transaction_date).toLocaleDateString('en-IN')}</td>
                      <td className="p-3">{entry.description}</td>
                      <td className="p-3 text-right text-red-600">
                        {entry.transaction_type === 'credit' ? formatCurrency(entry.amount) : '-'}
                      </td>
                      <td className="p-3 text-right text-green-600">
                        {entry.transaction_type === 'debit' ? formatCurrency(entry.amount) : '-'}
                      </td>
                      <td className="p-3 text-right font-medium">{formatCurrency(entry.balance_after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-6 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
                This is a computer-generated statement
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payments;
