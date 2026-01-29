import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, BarChart2, Fuel as FuelIcon, Droplet, X } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

const Fuel = () => {
  const [fuelEntries, setFuelEntries] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [selectedTruck, setSelectedTruck] = useState('');
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    truck_id: '',
    date: new Date().toISOString().split('T')[0],
    fuel_station: '',
    quantity_liters: '',
    price_per_liter: '',
    odometer_reading: '',
    payment_mode: 'cash',
    bill_number: '',
    notes: '',
  });

  useEffect(() => {
    fetchData();
  }, [selectedTruck]);

  const fetchData = async () => {
    try {
      const params = selectedTruck ? { truck_id: selectedTruck } : {};
      const [fuelRes, trucksRes] = await Promise.all([
        api.get('/fuel', { params }),
        api.get('/trucks'),
      ]);
      setFuelEntries(fuelRes.data);
      setTrucks(trucksRes.data);

      if (selectedTruck) {
        const analyticsRes = await api.get(`/fuel/analytics/truck/${selectedTruck}`);
        setAnalytics(analyticsRes.data);
      }
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEntry) {
        await api.put(`/fuel/${editingEntry.id}`, formData);
        toast.success('Fuel entry updated successfully');
      } else {
        await api.post('/fuel', formData);
        toast.success('Fuel entry created successfully');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    try {
      await api.delete(`/fuel/${id}`);
      toast.success('Fuel entry deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete entry');
    }
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      truck_id: entry.truck_id,
      date: entry.date?.split('T')[0],
      fuel_station: entry.fuel_station || '',
      quantity_liters: entry.quantity_liters,
      price_per_liter: entry.price_per_liter,
      odometer_reading: entry.odometer_reading || '',
      payment_mode: entry.payment_mode || 'cash',
      bill_number: entry.bill_number || '',
      notes: entry.notes || '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingEntry(null);
    setFormData({
      truck_id: '',
      date: new Date().toISOString().split('T')[0],
      fuel_station: '',
      quantity_liters: '',
      price_per_liter: '',
      odometer_reading: '',
      payment_mode: 'cash',
      bill_number: '',
      notes: '',
    });
  };

  const totalAmount = formData.quantity_liters && formData.price_per_liter
    ? parseFloat(formData.quantity_liters) * parseFloat(formData.price_per_liter)
    : 0;

  const totalFuelCost = fuelEntries.reduce((sum, e) => sum + parseFloat(e.total_amount || 0), 0);
  const totalLiters = fuelEntries.reduce((sum, e) => sum + parseFloat(e.quantity_liters || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-500 font-medium">Loading fuel entries...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Fuel Management</h1>
          <p className="text-slate-500 mt-1">Track fuel consumption and expenses</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white min-w-[180px]"
            value={selectedTruck}
            onChange={(e) => setSelectedTruck(e.target.value)}
          >
            <option value="">All Trucks</option>
            {trucks.map((truck) => (
              <option key={truck.id} value={truck.id}>
                {truck.truck_number}
              </option>
            ))}
          </select>
          <button 
            onClick={() => setShowModal(true)} 
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-semibold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/40 hover:from-amber-600 hover:to-amber-700 transition-all duration-200"
          >
            <Plus size={20} />
            Add Fuel Entry
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">Total Entries</p>
              <p className="text-3xl font-bold mt-1">{fuelEntries.length}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <FuelIcon size={24} />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Liters</p>
              <p className="text-3xl font-bold mt-1">{totalLiters.toFixed(0)}L</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Droplet size={24} />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-5 text-white shadow-lg shadow-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Total Cost</p>
              <p className="text-3xl font-bold mt-1">₹{(totalFuelCost/1000).toFixed(0)}K</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-xl font-bold">₹</span>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-violet-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-violet-100 text-sm font-medium">Avg Price/L</p>
              <p className="text-3xl font-bold mt-1">₹{totalLiters > 0 ? (totalFuelCost/totalLiters).toFixed(2) : '0'}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <BarChart2 size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Date</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Truck</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Station</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Quantity</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Price/L</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Total</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Payment</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fuelEntries.map((entry, index) => (
                <tr 
                  key={entry.id}
                  className={`border-b border-slate-100 hover:bg-slate-50/80 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                >
                  <td className="py-4 px-6 text-slate-600">{new Date(entry.date).toLocaleDateString()}</td>
                  <td className="py-4 px-6 font-semibold text-slate-900">{entry.truck_number}</td>
                  <td className="py-4 px-6 text-slate-600">{entry.fuel_station || '-'}</td>
                  <td className="py-4 px-6 text-slate-600">{parseFloat(entry.quantity_liters).toFixed(2)}L</td>
                  <td className="py-4 px-6 text-slate-600">₹{parseFloat(entry.price_per_liter).toFixed(2)}</td>
                  <td className="py-4 px-6 font-semibold text-amber-600">₹{parseFloat(entry.total_amount).toLocaleString('en-IN')}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${
                      entry.payment_mode === 'cash' 
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                        : entry.payment_mode === 'bank'
                        ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20'
                        : 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/20'
                    }`}>
                      {entry.payment_mode}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleEdit(entry)} 
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(entry.id)} 
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {fuelEntries.length === 0 && (
                <tr>
                  <td colSpan="8" className="py-12 text-center">
                    <FuelIcon size={48} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500">No fuel entries found</p>
                    <p className="text-slate-400 text-sm mt-1">Add your first fuel entry to get started</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{editingEntry ? 'Edit Fuel Entry' : 'Add Fuel Entry'}</h2>
                <p className="text-slate-500 mt-1">{editingEntry ? 'Update fuel record' : 'Record a new fuel entry'}</p>
              </div>
              <button 
                onClick={handleCloseModal}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date *</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Fuel Station</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.fuel_station}
                    onChange={(e) => setFormData({ ...formData, fuel_station: e.target.value })}
                    placeholder="e.g., Indian Oil, HP"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantity (Liters) *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.quantity_liters}
                    onChange={(e) => setFormData({ ...formData, quantity_liters: e.target.value })}
                    placeholder="e.g., 100"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Price per Liter *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.price_per_liter}
                    onChange={(e) => setFormData({ ...formData, price_per_liter: e.target.value })}
                    placeholder="e.g., 95.50"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Total Amount</label>
                  <div className="w-full px-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold text-amber-600">
                    ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Odometer Reading</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.odometer_reading}
                    onChange={(e) => setFormData({ ...formData, odometer_reading: e.target.value })}
                    placeholder="Current odometer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Mode</label>
                  <select
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                    value={formData.payment_mode}
                    onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Bill Number</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.bill_number}
                    onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
                    placeholder="e.g., FUEL-001"
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
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-semibold shadow-lg shadow-amber-500/30 hover:shadow-amber-500/40 transition-all"
                >
                  {editingEntry ? 'Update Entry' : 'Add Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Fuel;
