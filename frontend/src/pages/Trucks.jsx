import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Truck, Filter, X } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

const Trucks = () => {
  const [trucks, setTrucks] = useState([]);
  const [filteredTrucks, setFilteredTrucks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTruck, setEditingTruck] = useState(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    truck_number: '',
    truck_type: '',
    capacity_tons: '',
    model: '',
    purchase_date: '',
    owner_type: 'owned',
    status: 'active',
    notes: '',
  });

  useEffect(() => {
    fetchTrucks();
  }, []);

  useEffect(() => {
    const filtered = trucks.filter((truck) => {
      const matchesSearch = truck.truck_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.truck_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.model?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || truck.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
    setFilteredTrucks(filtered);
  }, [searchTerm, trucks, filterStatus]);

  const fetchTrucks = async () => {
    try {
      const response = await api.get('/trucks');
      setTrucks(response.data);
      setFilteredTrucks(response.data);
    } catch (error) {
      toast.error('Failed to fetch trucks');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTruck) {
        await api.put(`/trucks/${editingTruck.id}`, formData);
        toast.success('Truck updated successfully');
      } else {
        await api.post('/trucks', formData);
        toast.success('Truck created successfully');
      }
      fetchTrucks();
      handleCloseModal();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this truck?')) return;
    
    try {
      await api.delete(`/trucks/${id}`);
      toast.success('Truck deleted successfully');
      fetchTrucks();
    } catch (error) {
      toast.error('Failed to delete truck');
    }
  };

  const handleEdit = (truck) => {
    setEditingTruck(truck);
    setFormData({
      truck_number: truck.truck_number,
      truck_type: truck.truck_type || '',
      capacity_tons: truck.capacity_tons || '',
      model: truck.model || '',
      purchase_date: truck.purchase_date?.split('T')[0] || '',
      owner_type: truck.owner_type,
      status: truck.status,
      notes: truck.notes || '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTruck(null);
    setFormData({
      truck_number: '',
      truck_type: '',
      capacity_tons: '',
      model: '',
      purchase_date: '',
      owner_type: 'owned',
      status: 'active',
      notes: '',
    });
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
      maintenance: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
      inactive: 'bg-red-50 text-red-700 ring-1 ring-red-600/20'
    };
    return styles[status] || 'bg-slate-50 text-slate-700 ring-1 ring-slate-600/20';
  };

  const getOwnerBadge = (type) => {
    const styles = {
      owned: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
      leased: 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/20',
      attached: 'bg-orange-50 text-orange-700 ring-1 ring-orange-600/20'
    };
    return styles[type] || 'bg-slate-50 text-slate-700 ring-1 ring-slate-600/20';
  };

  const activeTrucks = trucks.filter(t => t.status === 'active').length;
  const maintenanceTrucks = trucks.filter(t => t.status === 'maintenance').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-500 font-medium">Loading trucks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Fleet Management</h1>
          <p className="text-slate-500 mt-1">Manage your trucks and vehicles</p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 hover:from-blue-700 hover:to-blue-800 transition-all duration-200"
        >
          <Plus size={20} />
          Add Truck
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium">Active Trucks</p>
              <p className="text-3xl font-bold mt-1">{activeTrucks}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Truck size={24} />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-lg shadow-amber-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">In Maintenance</p>
              <p className="text-3xl font-bold mt-1">{maintenanceTrucks}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Truck size={24} />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-slate-600 to-slate-700 rounded-2xl p-5 text-white shadow-lg shadow-slate-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-200 text-sm font-medium">Total Fleet</p>
              <p className="text-3xl font-bold mt-1">{trucks.length}</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Truck size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search by truck number, type, or model..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-slate-400" />
            <select
              className="px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white min-w-[140px]"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Trucks Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Truck Number</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Type</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Capacity</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Model</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Owner Type</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Status</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrucks.map((truck, index) => (
                <tr 
                  key={truck.id}
                  className={`border-b border-slate-100 hover:bg-slate-50/80 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Truck size={20} className="text-blue-600" />
                      </div>
                      <span className="font-semibold text-slate-900">{truck.truck_number}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-slate-600">{truck.truck_type || '-'}</td>
                  <td className="py-4 px-6 text-slate-600">{truck.capacity_tons ? `${truck.capacity_tons} tons` : '-'}</td>
                  <td className="py-4 px-6 text-slate-600">{truck.model || '-'}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${getOwnerBadge(truck.owner_type)}`}>
                      {truck.owner_type}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium capitalize ${getStatusBadge(truck.status)}`}>
                      {truck.status}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEdit(truck)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(truck.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTrucks.length === 0 && (
                <tr>
                  <td colSpan="7" className="py-12 text-center">
                    <Truck size={48} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500">No trucks found</p>
                    <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filter</p>
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
                <h2 className="text-2xl font-bold text-slate-900">
                  {editingTruck ? 'Edit Truck' : 'Add New Truck'}
                </h2>
                <p className="text-slate-500 mt-1">
                  {editingTruck ? 'Update truck details' : 'Add a new truck to your fleet'}
                </p>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Truck Number *</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.truck_number}
                    onChange={(e) => setFormData({ ...formData, truck_number: e.target.value })}
                    placeholder="e.g., MH-12-AB-1234"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Type</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.truck_type}
                    onChange={(e) => setFormData({ ...formData, truck_type: e.target.value })}
                    placeholder="e.g., Container, Tanker"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Capacity (tons)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.capacity_tons}
                    onChange={(e) => setFormData({ ...formData, capacity_tons: e.target.value })}
                    placeholder="e.g., 20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Model</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="e.g., Tata Prima"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Purchase Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Owner Type *</label>
                  <select
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                    value={formData.owner_type}
                    onChange={(e) => setFormData({ ...formData, owner_type: e.target.value })}
                    required
                  >
                    <option value="owned">Owned</option>
                    <option value="leased">Leased</option>
                    <option value="attached">Attached</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
                  <select
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                <textarea
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                  rows="3"
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
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all"
                >
                  {editingTruck ? 'Update Truck' : 'Add Truck'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trucks;
