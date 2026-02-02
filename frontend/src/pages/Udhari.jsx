import { useState, useEffect } from 'react';
import { 
  AlertTriangle, Search, ChevronDown, ChevronRight, 
  IndianRupee, Calendar, Building2, Truck, FileText,
  Phone, MapPin, Clock, CheckCircle, X, Download,
  RefreshCw, Filter, Eye, CreditCard, ArrowRight
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

const Udhari = () => {
  const [udhariData, setUdhariData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedParty, setExpandedParty] = useState(null);
  const [partyTrips, setPartyTrips] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [summary, setSummary] = useState({ totalUdhari: 0, totalParties: 0, totalTrips: 0 });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
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

  const fetchPartyTrips = async (partyId) => {
    if (partyTrips[partyId]) {
      return; // Already loaded
    }
    try {
      const response = await api.get(`/udhari/party/${partyId}/trips`);
      setPartyTrips(prev => ({ ...prev, [partyId]: response.data }));
    } catch (error) {
      toast.error('Failed to fetch trip details');
    }
  };

  const togglePartyExpand = async (partyId) => {
    if (expandedParty === partyId) {
      setExpandedParty(null);
    } else {
      setExpandedParty(partyId);
      await fetchPartyTrips(partyId);
    }
  };

  const handleRecordPayment = (trip) => {
    setSelectedTrip(trip);
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
        consigner_id: selectedTrip.consigner_id,
        amount: parseFloat(paymentForm.amount),
        payment_date: paymentForm.payment_date,
        payment_mode: paymentForm.payment_mode,
        reference_number: paymentForm.reference_number,
        notes: paymentForm.notes
      });
      
      toast.success('Payment recorded successfully!');
      setShowPaymentModal(false);
      setSelectedTrip(null);
      
      // Refresh data
      setPartyTrips({});
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

  const getReasonBadge = (trip) => {
    if (trip.payment_status === 'pending') {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
          Payment Left with Party
        </span>
      );
    } else if (trip.payment_status === 'partial') {
      return (
        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
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
            <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg">
              <AlertTriangle className="text-white" size={28} />
            </div>
            Udhari (Outstanding Dues)
          </h1>
          <p className="text-slate-500 mt-1">Track and manage all pending payments from consigners</p>
        </div>
        <button 
          onClick={fetchUdhariData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={18} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm font-medium">Total Udhari</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(summary.totalUdhari)}</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <IndianRupee size={28} />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Parties with Dues</p>
              <p className="text-3xl font-bold mt-1">{summary.totalParties}</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <Building2 size={28} />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Pending Trips</p>
              <p className="text-3xl font-bold mt-1">{summary.totalTrips}</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <Truck size={28} />
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
            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
      </div>

      {/* Udhari List */}
      <div className="space-y-4">
        {filteredData.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700">No Outstanding Dues!</h3>
            <p className="text-slate-500 mt-2">All payments are settled. Great job!</p>
          </div>
        ) : (
          filteredData.map((party) => (
            <div key={party.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Party Header */}
              <div 
                className="p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => togglePartyExpand(party.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-xl">
                      <Building2 className="text-orange-600" size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800">{party.name}</h3>
                      <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                        {party.phone && (
                          <span className="flex items-center gap-1">
                            <Phone size={14} /> {party.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <FileText size={14} /> {party.pending_trips} pending trips
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-slate-500">Total Due</p>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(party.total_due)}</p>
                    </div>
                    <div className={`p-2 rounded-full transition-transform ${expandedParty === party.id ? 'rotate-180' : ''}`}>
                      <ChevronDown size={24} className="text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Trip Details (Expandable) */}
              {expandedParty === party.id && (
                <div className="border-t border-slate-200 bg-slate-50">
                  {partyTrips[party.id] ? (
                    <div className="p-4">
                      <h4 className="text-sm font-semibold text-slate-600 mb-3 px-2">Trip-wise Breakdown</h4>
                      <div className="space-y-3">
                        {partyTrips[party.id].map((trip) => (
                          <div key={trip.id} className="bg-white rounded-xl border border-slate-200 p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-mono rounded">
                                    #{trip.trip_number}
                                  </span>
                                  {getReasonBadge(trip)}
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <p className="text-slate-500">Route</p>
                                    <p className="font-medium text-slate-700">
                                      {trip.from_location} → {trip.to_location}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500">Trip Date</p>
                                    <p className="font-medium text-slate-700">{formatDate(trip.start_date)}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500">Freight Amount</p>
                                    <p className="font-medium text-slate-700">{formatCurrency(trip.freight_amount)}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500">Amount Paid</p>
                                    <p className="font-medium text-green-600">{formatCurrency(trip.amount_paid)}</p>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="text-right ml-4">
                                <p className="text-sm text-slate-500">Due Amount</p>
                                <p className="text-xl font-bold text-red-600 mb-2">{formatCurrency(trip.amount_due)}</p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRecordPayment(trip);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                                >
                                  <CreditCard size={16} />
                                  Receive Payment
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin mx-auto"></div>
                      <p className="text-slate-500 mt-2">Loading trips...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-800">Record Payment</h3>
                <button 
                  onClick={() => setShowPaymentModal(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-slate-500 text-sm mt-1">
                Trip #{selectedTrip.trip_number} • Due: {formatCurrency(selectedTrip.amount_due)}
              </p>
            </div>

            <form onSubmit={submitPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount *</label>
                <div className="relative">
                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    max={selectedTrip.amount_due}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={paymentForm.payment_mode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Reference Number</label>
                <input
                  type="text"
                  value={paymentForm.reference_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                  placeholder="Transaction ID / Cheque No."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium"
                >
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

export default Udhari;
