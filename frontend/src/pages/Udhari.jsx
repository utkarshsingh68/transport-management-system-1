import { useState, useEffect } from 'react';
import { 
  AlertTriangle, Search, ChevronDown, ChevronRight, 
  IndianRupee, Calendar, Building2, Truck, FileText,
  Phone, MapPin, Clock, CheckCircle, X, Download,
  RefreshCw, Filter, Eye, CreditCard, ArrowRight,
  Route, User, Hash, Banknote, CalendarDays, TrendingUp
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

const Udhari = () => {
  const [udhariData, setUdhariData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedParties, setExpandedParties] = useState({});
  const [partyTrips, setPartyTrips] = useState({});
  const [loadingTrips, setLoadingTrips] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [summary, setSummary] = useState({ totalUdhari: 0, totalParties: 0, totalTrips: 0 });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedParty, setSelectedParty] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'cash',
    reference_number: '',
    notes: ''
  });

  useEffect(() => {
    fetchUdhariData();
  }, []);

  const fetchUdhariData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/udhari');
      setUdhariData(response.data.parties || []);
      setSummary(response.data.summary || { totalUdhari: 0, totalParties: 0, totalTrips: 0 });
    } catch (error) {
      console.error('Error fetching udhari:', error);
      toast.error('Failed to fetch udhari data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPartyTrips = async (partyKey) => {
    if (partyTrips[partyKey]) {
      return; // Already loaded
    }
    setLoadingTrips(prev => ({ ...prev, [partyKey]: true }));
    try {
      // Use the partyKey which could be ID or normalized_name
      const encodedKey = encodeURIComponent(partyKey);
      const response = await api.get(`/udhari/party/${encodedKey}/trips`);
      setPartyTrips(prev => ({ ...prev, [partyKey]: response.data }));
    } catch (error) {
      toast.error('Failed to fetch trip details');
    } finally {
      setLoadingTrips(prev => ({ ...prev, [partyKey]: false }));
    }
  };

  const togglePartyExpand = async (partyKey) => {
    const isExpanded = expandedParties[partyKey];
    setExpandedParties(prev => ({ ...prev, [partyKey]: !isExpanded }));
    
    if (!isExpanded) {
      await fetchPartyTrips(partyKey);
    }
  };

  // Get unique key for a party (prefer ID, fallback to normalized_name)
  const getPartyKey = (party) => {
    return party.id || party.normalized_name || party.name?.toLowerCase().trim();
  };

  const handleRecordPayment = (trip, party) => {
    setSelectedTrip(trip);
    setSelectedParty(party);
    setPaymentForm({
      amount: trip.amount_due?.toString() || '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_mode: 'cash',
      reference_number: '',
      notes: `Payment for Trip ${trip.trip_number}`
    });
    setShowPaymentModal(true);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!selectedTrip) return;

    try {
      await api.post('/udhari/payment', {
        trip_id: selectedTrip.id,
        consigner_id: selectedTrip.consigner_id || selectedParty?.id || 0,
        amount: parseFloat(paymentForm.amount),
        payment_date: paymentForm.payment_date,
        payment_mode: paymentForm.payment_mode,
        reference_number: paymentForm.reference_number,
        notes: paymentForm.notes
      });
      
      toast.success('Payment recorded successfully! Udhari updated.');
      setShowPaymentModal(false);
      setSelectedTrip(null);
      setSelectedParty(null);
      
      // Clear cached trips and refresh to recalculate totals
      setPartyTrips({});
      setExpandedParties({});
      fetchUdhariData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to record payment');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getPaymentTypeBadge = (trip) => {
    const amountPaid = parseFloat(trip.amount_paid) || 0;
    const amountDue = parseFloat(trip.amount_due) || 0;
    
    if (amountPaid === 0 && amountDue > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-orange-100 text-orange-700 rounded-full border border-orange-200">
          <AlertTriangle size={12} />
          Left with Party
        </span>
      );
    } else if (amountPaid > 0 && amountDue > 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-yellow-100 text-yellow-700 rounded-full border border-yellow-200">
          <Clock size={12} />
          Partial Payment
        </span>
      );
    }
    return null;
  };

  const filteredData = udhariData.filter(party =>
    party.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    party.phone?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-orange-200 rounded-full"></div>
            <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin absolute inset-0"></div>
          </div>
          <p className="text-slate-500 font-semibold">Loading Udhari...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg shadow-orange-500/30">
              <AlertTriangle className="text-white" size={28} />
            </div>
            Udhari (Outstanding Dues)
          </h1>
          <p className="text-slate-500 mt-1">Track and manage all pending payments from consigners</p>
        </div>
        <button 
          onClick={() => {
            setPartyTrips({});
            setExpandedParties({});
            fetchUdhariData();
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm hover:shadow"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 rounded-2xl p-6 text-white shadow-xl shadow-orange-500/25 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="flex items-center justify-between relative">
            <div>
              <p className="text-orange-100 text-sm font-medium">Total Udhari</p>
              <p className="text-4xl font-extrabold mt-1">{formatCurrency(summary.totalUdhari)}</p>
              <p className="text-orange-200 text-xs mt-2">Outstanding amount</p>
            </div>
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <IndianRupee size={32} />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/25 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="flex items-center justify-between relative">
            <div>
              <p className="text-blue-100 text-sm font-medium">Parties with Dues</p>
              <p className="text-4xl font-extrabold mt-1">{summary.totalParties}</p>
              <p className="text-blue-200 text-xs mt-2">Active consigners</p>
            </div>
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Building2 size={32} />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 via-purple-600 to-pink-600 rounded-2xl p-6 text-white shadow-xl shadow-purple-500/25 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          <div className="flex items-center justify-between relative">
            <div>
              <p className="text-purple-100 text-sm font-medium">Pending Trips</p>
              <p className="text-4xl font-extrabold mt-1">{summary.totalTrips}</p>
              <p className="text-purple-200 text-xs mt-2">Unsettled trips</p>
            </div>
            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
              <Truck size={32} />
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search by party name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
          />
        </div>
      </div>

      {/* Udhari List */}
      <div className="space-y-4">
        {filteredData.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={40} className="text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-slate-700">No Outstanding Dues!</h3>
            <p className="text-slate-500 mt-2">All payments are settled. Great job!</p>
          </div>
        ) : (
          filteredData.map((party) => {
            const partyKey = getPartyKey(party);
            return (
            <div key={partyKey} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Party Header - Clickable to Expand */}
              <div 
                className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
                onClick={() => togglePartyExpand(partyKey)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-red-100 rounded-xl flex items-center justify-center border border-orange-200">
                      <Building2 className="text-orange-600" size={26} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">{party.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                        {party.phone && (
                          <span className="flex items-center gap-1.5">
                            <Phone size={14} /> {party.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 rounded-full text-xs font-medium">
                          <FileText size={12} /> {party.pending_trips} pending trip{party.pending_trips > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Due</p>
                      <p className="text-2xl font-extrabold text-red-600">{formatCurrency(party.total_due)}</p>
                    </div>
                    <div className={`p-2.5 rounded-full bg-slate-100 transition-all duration-300 ${expandedParties[partyKey] ? 'rotate-180 bg-orange-100' : ''}`}>
                      <ChevronDown size={22} className={expandedParties[partyKey] ? 'text-orange-600' : 'text-slate-400'} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Trip Details - Expandable */}
              {expandedParties[partyKey] && (
                <div className="border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white">
                  {loadingTrips[partyKey] ? (
                    <div className="p-10 text-center">
                      <div className="w-10 h-10 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto"></div>
                      <p className="text-slate-500 mt-3 font-medium">Loading trips...</p>
                    </div>
                  ) : partyTrips[partyKey]?.length > 0 ? (
                    <div className="p-5">
                      {/* Trip List Header */}
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                          <Route size={16} className="text-orange-500" />
                          Trip-wise Breakdown
                        </h4>
                        <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                          {partyTrips[partyKey].length} trip(s)
                        </span>
                      </div>
                      
                      {/* Trip Cards */}
                      <div className="space-y-3">
                        {partyTrips[partyKey].map((trip) => (
                          <div key={trip.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:border-orange-200 hover:shadow-sm transition-all">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                              {/* Trip Info */}
                              <div className="flex-1">
                                {/* Trip Header */}
                                <div className="flex flex-wrap items-center gap-2 mb-3">
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg">
                                    <Hash size={12} />
                                    {trip.trip_number}
                                  </span>
                                  {getPaymentTypeBadge(trip)}
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <CalendarDays size={12} />
                                    {formatDate(trip.start_date)}
                                  </span>
                                </div>
                                
                                {/* Trip Details Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
                                  <div>
                                    <p className="text-xs text-slate-400 font-medium uppercase">Route</p>
                                    <p className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                                      {trip.from_location} 
                                      <ArrowRight size={12} className="text-slate-400" /> 
                                      {trip.to_location}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-400 font-medium uppercase">Freight Amount</p>
                                    <p className="text-sm font-bold text-slate-700">{formatCurrency(trip.freight_amount)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-400 font-medium uppercase">Paid Amount</p>
                                    <p className="text-sm font-bold text-green-600">{formatCurrency(trip.amount_paid)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-400 font-medium uppercase">Pending Due</p>
                                    <p className="text-sm font-extrabold text-red-600">{formatCurrency(trip.amount_due)}</p>
                                  </div>
                                </div>

                                {/* Driver & Truck Info */}
                                {(trip.truck_number || trip.driver_name) && (
                                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                                    {trip.truck_number && (
                                      <span className="flex items-center gap-1">
                                        <Truck size={12} /> {trip.truck_number}
                                      </span>
                                    )}
                                    {trip.driver_name && (
                                      <span className="flex items-center gap-1">
                                        <User size={12} /> {trip.driver_name}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {/* Payment Button */}
                              <div className="lg:ml-4">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRecordPayment(trip, party);
                                  }}
                                  className="w-full lg:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/25 hover:shadow-green-500/40"
                                >
                                  <CreditCard size={16} />
                                  Receive Payment
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Party Total Footer */}
                      <div className="mt-4 pt-4 border-t border-dashed border-slate-200 flex justify-end">
                        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-right">
                          <p className="text-xs text-red-600 font-medium uppercase">Party Total Due</p>
                          <p className="text-xl font-extrabold text-red-700">{formatCurrency(party.total_due)}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-10 text-center">
                      <CheckCircle size={32} className="mx-auto text-green-500 mb-2" />
                      <p className="text-slate-500">No pending trips found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );})
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedTrip && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl transform transition-all">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-green-500 to-emerald-600 rounded-t-2xl text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Record Payment</h3>
                    <p className="text-green-100 text-sm">Clear udhari for this trip</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Trip Info Summary */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase font-medium">Trip</p>
                  <p className="font-bold text-slate-800">#{selectedTrip.trip_number}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase font-medium">Party</p>
                  <p className="font-bold text-slate-800">{selectedParty?.name || selectedTrip.consignor_name || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase font-medium">Due Amount</p>
                  <p className="font-bold text-red-600">{formatCurrency(selectedTrip.amount_due)}</p>
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <form onSubmit={submitPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Amount *</label>
                <div className="relative">
                  <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    max={selectedTrip.amount_due}
                    className="w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-lg font-semibold"
                    placeholder="Enter amount"
                    required
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Max: {formatCurrency(selectedTrip.amount_due)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Date *</label>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Mode</label>
                  <select
                    value={paymentForm.payment_mode}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="cash">💵 Cash</option>
                    <option value="bank_transfer">🏦 Bank Transfer</option>
                    <option value="upi">📱 UPI</option>
                    <option value="cheque">📄 Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Reference No.</label>
                <input
                  type="text"
                  value={paymentForm.reference_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                  placeholder="Transaction ID / Cheque No."
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Any additional notes..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 font-semibold transition-all shadow-lg shadow-green-500/25"
                >
                  ✓ Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Udhari;
