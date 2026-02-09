import { useState, useEffect } from 'react';
import { 
  AlertTriangle, Search, ChevronDown, ChevronRight, 
  IndianRupee, Calendar, Building2, Truck, FileText,
  Phone, MapPin, Clock, CheckCircle, X, Download,
  RefreshCw, Filter, Eye, CreditCard, ArrowRight,
  Route, User, Hash, Banknote, CalendarDays, TrendingUp,
  Upload, FileSpreadsheet, Check, AlertCircle, Loader2
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

  // Excel Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStep, setImportStep] = useState('upload'); // upload, preview, importing, done
  const [importFile, setImportFile] = useState(null);
  const [importAnalysis, setImportAnalysis] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [createNewParties, setCreateNewParties] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);

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

  // Excel Import Functions
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setImportFile(file);
    setImportStep('preview');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post('/ledger-import/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setImportAnalysis(response.data);
      setColumnMapping(response.data.columnMapping || {});
    } catch (error) {
      toast.error('Failed to analyze file: ' + (error.response?.data?.error || error.message));
      resetImport();
    }
  };

  const handleImport = async () => {
    if (!importFile || !columnMapping.party_name) {
      toast.error('Please select a Party Name column');
      return;
    }
    
    if (!columnMapping.debit && !columnMapping.credit && !columnMapping.amount) {
      toast.error('Please select at least one amount column (Debit, Credit, or Amount)');
      return;
    }
    
    setImporting(true);
    setImportStep('importing');
    
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('columnMapping', JSON.stringify(columnMapping));
      formData.append('createNewParties', createNewParties);
      
      const response = await api.post('/ledger-import/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setImportResults(response.data.results);
      setImportStep('done');
      toast.success(`Import completed: ${response.data.results.success} entries created`);
      
      // Refresh data
      fetchUdhariData();
    } catch (error) {
      toast.error('Import failed: ' + (error.response?.data?.error || error.message));
      setImportStep('preview');
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setShowImportModal(false);
    setImportStep('upload');
    setImportFile(null);
    setImportAnalysis(null);
    setColumnMapping({});
    setImportResults(null);
  };

  const downloadTemplate = async () => {
    try {
      const response = await api.get('/ledger-import/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'party_ledger_template.xlsx';
      link.click();
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const COLUMN_TYPES = [
    { key: 'party_name', label: 'Party Name', required: true },
    { key: 'date', label: 'Date' },
    { key: 'description', label: 'Description' },
    { key: 'debit', label: 'Debit (Payment Received)' },
    { key: 'credit', label: 'Credit (Amount Due)' },
    { key: 'amount', label: 'Amount (Single Column)' },
    { key: 'reference', label: 'Reference Number' },
    { key: 'trip_id', label: 'Trip ID/LR Number' }
  ];

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
        <div className="flex gap-3">
          <button 
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg shadow-emerald-500/25"
          >
            <Upload size={18} />
            Import Excel
          </button>
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

      {/* Excel Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3 text-white">
                <FileSpreadsheet size={24} />
                <div>
                  <h2 className="text-xl font-bold">Smart Excel Import</h2>
                  <p className="text-emerald-100 text-sm">Import party ledger entries from Excel/CSV</p>
                </div>
              </div>
              <button onClick={resetImport} className="p-2 hover:bg-white/20 rounded-lg text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Step 1: Upload */}
              {importStep === 'upload' && (
                <div className="space-y-6">
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-emerald-400 transition-colors">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="excel-upload"
                    />
                    <label htmlFor="excel-upload" className="cursor-pointer">
                      <Upload size={48} className="mx-auto text-slate-400 mb-4" />
                      <p className="text-lg font-semibold text-slate-700">Click to upload or drag and drop</p>
                      <p className="text-slate-500 mt-1">Excel (.xlsx, .xls) or CSV files supported</p>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-center gap-4">
                    <div className="h-px bg-slate-200 flex-1"></div>
                    <span className="text-slate-400 text-sm">OR</span>
                    <div className="h-px bg-slate-200 flex-1"></div>
                  </div>
                  
                  <button
                    onClick={downloadTemplate}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <Download size={18} />
                    Download Sample Template
                  </button>
                </div>
              )}

              {/* Step 2: Preview & Map Columns */}
              {importStep === 'preview' && importAnalysis && (
                <div className="space-y-6">
                  {/* File Info */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="text-emerald-600" size={24} />
                      <div>
                        <p className="font-semibold text-slate-800">{importAnalysis.fileName}</p>
                        <p className="text-sm text-slate-600">{importAnalysis.totalRows} rows found</p>
                      </div>
                    </div>
                    {importAnalysis.newPartiesCount > 0 && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                        {importAnalysis.newPartiesCount} new parties
                      </span>
                    )}
                  </div>

                  {/* Column Mapping */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Column Mapping</h3>
                    <p className="text-sm text-slate-500 mb-4">We've auto-detected columns. Please verify or adjust the mapping:</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {COLUMN_TYPES.map(col => (
                        <div key={col.key} className="flex items-center gap-3">
                          <label className="w-40 text-sm font-medium text-slate-700">
                            {col.label}
                            {col.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          <select
                            value={columnMapping[col.key] || ''}
                            onChange={(e) => setColumnMapping({
                              ...columnMapping,
                              [col.key]: e.target.value ? parseInt(e.target.value) : null
                            })}
                            className={`flex-1 px-3 py-2 border rounded-lg text-sm ${
                              columnMapping[col.key] ? 'border-emerald-300 bg-emerald-50' : 'border-slate-300'
                            }`}
                          >
                            <option value="">-- Select Column --</option>
                            {importAnalysis.headers.map(h => (
                              <option key={h.column} value={h.column}>
                                {h.header}
                                {h.detectedType === col.key && ' ✓'}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* New Party Handling */}
                  {importAnalysis.newPartiesCount > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
                        <div>
                          <p className="font-semibold text-slate-800">
                            {importAnalysis.newPartiesCount} parties not found in system
                          </p>
                          <p className="text-sm text-slate-600 mt-1">
                            These parties will be created automatically if you proceed.
                          </p>
                          <label className="flex items-center gap-2 mt-3">
                            <input
                              type="checkbox"
                              checked={createNewParties}
                              onChange={(e) => setCreateNewParties(e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="text-sm">Create new parties automatically</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Preview Table */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Data Preview (First 20 rows)</h3>
                    <div className="border rounded-xl overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600">#</th>
                              {importAnalysis.headers.map(h => (
                                <th key={h.column} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">
                                  {h.header}
                                  {h.detectedType && (
                                    <span className="ml-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">
                                      {h.detectedType}
                                    </span>
                                  )}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {importAnalysis.dataRows.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                                {importAnalysis.headers.map(h => (
                                  <td key={h.column} className="px-3 py-2 whitespace-nowrap">
                                    {row.data[h.column]?.toString() || '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={resetImport}
                      className="flex-1 px-4 py-3 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={!columnMapping.party_name || (!columnMapping.debit && !columnMapping.credit && !columnMapping.amount)}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl hover:from-emerald-600 hover:to-green-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Import {importAnalysis.totalRows} Entries
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Importing */}
              {importStep === 'importing' && (
                <div className="py-16 text-center">
                  <Loader2 size={48} className="mx-auto text-emerald-600 animate-spin mb-4" />
                  <p className="text-lg font-semibold text-slate-700">Importing entries...</p>
                  <p className="text-slate-500 mt-1">Please wait while we process your file</p>
                </div>
              )}

              {/* Step 4: Done */}
              {importStep === 'done' && importResults && (
                <div className="py-8 text-center space-y-6">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                    <Check size={40} className="text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-800">Import Complete!</h3>
                    <p className="text-slate-500 mt-1">Your ledger entries have been processed</p>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 max-w-lg mx-auto">
                    <div className="bg-emerald-50 rounded-xl p-4">
                      <p className="text-2xl font-bold text-emerald-600">{importResults.success}</p>
                      <p className="text-xs text-slate-600">Success</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-4">
                      <p className="text-2xl font-bold text-blue-600">{importResults.newParties}</p>
                      <p className="text-xs text-slate-600">New Parties</p>
                    </div>
                    <div className="bg-yellow-50 rounded-xl p-4">
                      <p className="text-2xl font-bold text-yellow-600">{importResults.skipped}</p>
                      <p className="text-xs text-slate-600">Skipped</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-4">
                      <p className="text-2xl font-bold text-red-600">{importResults.failed}</p>
                      <p className="text-xs text-slate-600">Failed</p>
                    </div>
                  </div>

                  {importResults.errors.length > 0 && (
                    <div className="text-left max-w-lg mx-auto">
                      <p className="font-semibold text-slate-700 mb-2">Errors:</p>
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 max-h-40 overflow-y-auto">
                        {importResults.errors.slice(0, 10).map((err, idx) => (
                          <p key={idx} className="text-sm text-red-700">
                            Row {err.row}: {err.error}
                          </p>
                        ))}
                        {importResults.errors.length > 10 && (
                          <p className="text-sm text-red-500 mt-1">
                            ... and {importResults.errors.length - 10} more errors
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={resetImport}
                    className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl hover:from-emerald-600 hover:to-green-700 font-semibold"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Udhari;
