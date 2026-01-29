import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, MapPin, Search, X, TruckIcon, Calendar, Route } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

const Trips = () => {
  const [trips, setTrips] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    trip_number: '',
    truck_id: '',
    driver_id: '',
    from_location: '',
    to_location: '',
    start_date: '',
    end_date: '',
    distance_km: '',
    weight_tons: '',
    rate_per_ton: '',
    rate_type: 'per_ton',
    fixed_amount: '',
    driver_advance_amount: '',
    trip_spent_amount: '',
    consignor_name: '',
    consignee_name: '',
    lr_number: '',
    status: 'planned',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = filterStatus ? { status: filterStatus } : {};
      const [tripsRes, trucksRes, driversRes] = await Promise.all([
        api.get('/trips', { params }),
        api.get('/trucks'),
        api.get('/drivers'),
      ]);
      setTrips(tripsRes.data);
      setTrucks(trucksRes.data);
      setDrivers(driversRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const calculateIncome = () => {
    const { rate_type, weight_tons, rate_per_ton, distance_km, fixed_amount } = formData;
    if (rate_type === 'per_ton' && weight_tons && rate_per_ton) {
      return parseFloat(weight_tons) * parseFloat(rate_per_ton);
    } else if (rate_type === 'per_km' && distance_km && rate_per_ton) {
      return parseFloat(distance_km) * parseFloat(rate_per_ton);
    } else if (rate_type === 'fixed' && fixed_amount) {
      return parseFloat(fixed_amount);
    }
    return 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTrip) {
        await api.put(`/trips/${editingTrip.id}`, formData);
        toast.success('Trip updated successfully');
      } else {
        await api.post('/trips', formData);
        toast.success('Trip created successfully');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this trip?')) return;
    try {
      await api.delete(`/trips/${id}`);
      toast.success('Trip deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete trip');
    }
  };

  const handleEdit = (trip) => {
    setEditingTrip(trip);
    setFormData({
      trip_number: trip.trip_number,
      truck_id: trip.truck_id,
      driver_id: trip.driver_id,
      from_location: trip.from_location,
      to_location: trip.to_location,
      start_date: trip.start_date?.split('T')[0],
      end_date: trip.end_date?.split('T')[0] || '',
      distance_km: trip.distance_km || '',
      weight_tons: trip.weight_tons || '',
      rate_per_ton: trip.rate_per_ton || '',
      rate_type: trip.rate_type || 'per_ton',
      fixed_amount: trip.fixed_amount || '',
      driver_advance_amount: trip.driver_advance_amount ?? '',
      trip_spent_amount: trip.trip_spent_amount ?? '',
      consignor_name: trip.consignor_name || '',
      consignee_name: trip.consignee_name || '',
      lr_number: trip.lr_number || '',
      status: trip.status,
      notes: trip.notes || '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTrip(null);
    setFormData({
      trip_number: '',
      truck_id: '',
      driver_id: '',
      from_location: '',
      to_location: '',
      start_date: '',
      end_date: '',
      distance_km: '',
      weight_tons: '',
      rate_per_ton: '',
      rate_type: 'per_ton',
      fixed_amount: '',
      driver_advance_amount: '',
      trip_spent_amount: '',
      consignor_name: '',
      consignee_name: '',
      lr_number: '',
      status: 'planned',
      notes: '',
    });
  };

  const calculatedIncome = calculateIncome();

  // Filter trips based on search
  const filteredTrips = trips.filter(trip => 
    trip.trip_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trip.from_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trip.to_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trip.truck_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    trip.driver_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate stats
  const totalIncome = trips.reduce((sum, t) => sum + (parseFloat(t.actual_income) || 0), 0);
  const totalAdvance = trips.reduce((sum, t) => sum + (parseFloat(t.driver_advance_amount) || 0), 0);
  const totalTripSpent = trips.reduce((sum, t) => sum + (parseFloat(t.trip_spent_amount) || 0), 0);
  const totalDriverBalance = totalAdvance - totalTripSpent;
  const completedTrips = trips.filter(t => t.status === 'completed').length;
  const inProgressTrips = trips.filter(t => t.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Trip Management</h1>
          <p className="text-slate-500 mt-1">Track and manage all your trips</p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all"
        >
          <Plus size={20} />
          Add Trip
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Trips</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{trips.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Route size={24} className="text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Completed</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{completedTrips}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30">
              <TruckIcon size={24} className="text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">In Progress</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{inProgressTrips}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Calendar size={24} className="text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Income</p>
              <p className="text-2xl font-bold text-violet-600 mt-1">₹{totalIncome.toLocaleString('en-IN')}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <span className="text-white font-bold">₹</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm font-medium text-slate-500">Total Advance Given</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">₹{totalAdvance.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">Money given to drivers</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <p className="text-sm font-medium text-slate-500">Total Trip Spend</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">₹{totalTripSpent.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">Spent by drivers on trips</p>
        </div>
        <div className={`rounded-2xl p-5 shadow-sm border ${totalDriverBalance >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-sm font-medium text-slate-500">Driver Balance (To Return)</p>
          <p className={`text-2xl font-bold mt-1 ${totalDriverBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ₹{Math.abs(totalDriverBalance).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {totalDriverBalance >= 0 ? 'Money to collect from drivers' : 'Money owed to drivers'}
          </p>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search trips..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white min-w-[150px]"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="planned">Planned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Trip #</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Truck</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Route</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Income</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Advance</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Spent</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Balance</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="11" className="px-6 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      Loading trips...
                    </div>
                  </td>
                </tr>
              ) : filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan="11" className="px-6 py-12 text-center">
                    <Route size={48} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">No trips found</p>
                    <p className="text-slate-400 text-sm mt-1">Start by adding a new trip</p>
                  </td>
                </tr>
              ) : (
                filteredTrips.map((trip, idx) => {
                  const advance = parseFloat(trip.driver_advance_amount) || 0;
                  const spent = parseFloat(trip.trip_spent_amount) || 0;
                  const balance = advance - spent;
                  return (
                  <tr key={trip.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-6 py-4">
                      <span className="font-semibold text-slate-900">{trip.trip_number}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                          <TruckIcon size={16} className="text-blue-600" />
                        </div>
                        <span className="text-slate-700">{trip.truck_number}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{trip.driver_name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin size={14} className="text-green-500" />
                        <span className="text-slate-700">{trip.from_location}</span>
                        <span className="text-slate-400 mx-1">→</span>
                        <MapPin size={14} className="text-red-500" />
                        <span className="text-slate-700">{trip.to_location}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{new Date(trip.start_date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 font-semibold text-green-600">₹{trip.actual_income?.toLocaleString('en-IN') || 0}</td>
                    <td className="px-6 py-4 font-medium text-blue-600">₹{advance.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4 font-medium text-orange-600">₹{spent.toLocaleString('en-IN')}</td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {balance >= 0 ? '' : '-'}₹{Math.abs(balance).toLocaleString('en-IN')}
                      </span>
                      <p className="text-xs text-slate-400">
                        {balance > 0 ? 'To return' : balance < 0 ? 'Overspent' : 'Settled'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ring-1 ${
                          trip.status === 'completed'
                            ? 'bg-green-50 text-green-700 ring-green-600/20'
                            : trip.status === 'in_progress'
                            ? 'bg-blue-50 text-blue-700 ring-blue-600/20'
                            : trip.status === 'cancelled'
                            ? 'bg-red-50 text-red-700 ring-red-600/20'
                            : 'bg-amber-50 text-amber-700 ring-amber-600/20'
                        }`}
                      >
                        {trip.status === 'in_progress' ? 'In Progress' : trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        <button 
                          onClick={() => handleEdit(trip)} 
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(trip.id)} 
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{editingTrip ? 'Edit Trip' : 'Add New Trip'}</h2>
                <p className="text-slate-500 mt-1">{editingTrip ? 'Update trip details' : 'Create a new trip record'}</p>
              </div>
              <button 
                onClick={handleCloseModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Trip Number *</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.trip_number}
                    onChange={(e) => setFormData({ ...formData, trip_number: e.target.value })}
                    placeholder="e.g., TRIP-001"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Truck *</label>
                  <select
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                    value={formData.truck_id}
                    onChange={(e) => setFormData({ ...formData, truck_id: e.target.value })}
                    required
                  >
                    <option value="">Select Truck</option>
                    {trucks.map((truck) => (
                      <option key={truck.id} value={truck.id}>
                        {truck.truck_number}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Driver *</label>
                  <select
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                    value={formData.driver_id}
                    onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
                    required
                  >
                    <option value="">Select Driver</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">From Location *</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.from_location}
                    onChange={(e) => setFormData({ ...formData, from_location: e.target.value })}
                    placeholder="e.g., Mumbai"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">To Location *</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.to_location}
                    onChange={(e) => setFormData({ ...formData, to_location: e.target.value })}
                    placeholder="e.g., Delhi"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Distance (km)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.distance_km}
                    onChange={(e) => setFormData({ ...formData, distance_km: e.target.value })}
                    placeholder="e.g., 1400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Start Date *</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">End Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
                  <select
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 font-bold">₹</span>
                  Rate Calculation
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Rate Type</label>
                    <select
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                      value={formData.rate_type}
                      onChange={(e) => setFormData({ ...formData, rate_type: e.target.value })}
                    >
                      <option value="per_ton">Per Ton</option>
                      <option value="per_km">Per KM</option>
                      <option value="fixed">Fixed</option>
                    </select>
                  </div>
                  {formData.rate_type === 'per_ton' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Weight (tons)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          value={formData.weight_tons}
                          onChange={(e) => setFormData({ ...formData, weight_tons: e.target.value })}
                          placeholder="e.g., 10"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Rate per Ton</label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                          value={formData.rate_per_ton}
                          onChange={(e) => setFormData({ ...formData, rate_per_ton: e.target.value })}
                          placeholder="e.g., 1500"
                        />
                      </div>
                    </>
                  )}
                  {formData.rate_type === 'per_km' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Rate per KM</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        value={formData.rate_per_ton}
                        onChange={(e) => setFormData({ ...formData, rate_per_ton: e.target.value })}
                        placeholder="e.g., 50"
                      />
                    </div>
                  )}
                  {formData.rate_type === 'fixed' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Fixed Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        value={formData.fixed_amount}
                        onChange={(e) => setFormData({ ...formData, fixed_amount: e.target.value })}
                        placeholder="e.g., 15000"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Calculated Income</label>
                    <div className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-green-50 font-bold text-green-600">
                      ₹{calculatedIncome.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-bold">₹</span>
                  Trip Money
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Driver Advance (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={formData.driver_advance_amount}
                      onChange={(e) => setFormData({ ...formData, driver_advance_amount: e.target.value })}
                      placeholder="e.g., 5000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Trip Spent (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={formData.trip_spent_amount}
                      onChange={(e) => setFormData({ ...formData, trip_spent_amount: e.target.value })}
                      placeholder="e.g., 2500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Consignor Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.consignor_name}
                    onChange={(e) => setFormData({ ...formData, consignor_name: e.target.value })}
                    placeholder="Sender name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Consignee Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.consignee_name}
                    onChange={(e) => setFormData({ ...formData, consignee_name: e.target.value })}
                    placeholder="Receiver name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">LR Number</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.lr_number}
                    onChange={(e) => setFormData({ ...formData, lr_number: e.target.value })}
                    placeholder="e.g., LR-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                <textarea
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                  rows="2"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-200">
                <button 
                  type="button" 
                  onClick={handleCloseModal} 
                  className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all"
                >
                  {editingTrip ? 'Update Trip' : 'Create Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trips;
