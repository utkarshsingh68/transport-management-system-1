import { useState, useEffect } from 'react';
import { 
  Plus, FileText, Upload, Trash2, Eye, AlertTriangle, 
  CheckCircle, Clock, Search, Filter, X, Download, Calendar,
  Truck, Users
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

const documentTypes = {
  truck: [
    { value: 'rc', label: 'RC (Registration Certificate)' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'permit', label: 'Permit' },
    { value: 'fitness', label: 'Fitness Certificate' },
    { value: 'puc', label: 'PUC Certificate' },
    { value: 'tax', label: 'Road Tax' },
  ],
  driver: [
    { value: 'license', label: 'Driving License' },
    { value: 'aadhar', label: 'Aadhar Card' },
    { value: 'pan', label: 'PAN Card' },
    { value: 'medical', label: 'Medical Certificate' },
  ]
};

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [summary, setSummary] = useState({ active_count: 0, expiring_soon_count: 0, expired_count: 0 });

  const [formData, setFormData] = useState({
    document_type: '',
    entity_type: 'truck',
    entity_id: '',
    document_number: '',
    issue_date: '',
    expiry_date: '',
    reminder_days: 30,
    notes: '',
    file: null
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [docsRes, trucksRes, driversRes, summaryRes] = await Promise.all([
        api.get('/documents'),
        api.get('/trucks'),
        api.get('/drivers'),
        api.get('/documents/summary')
      ]);
      setDocuments(docsRes.data);
      setTrucks(trucksRes.data);
      setDrivers(driversRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => {
        if (formData[key] !== null && formData[key] !== '') {
          data.append(key, formData[key]);
        }
      });

      await api.post('/documents', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      toast.success('Document uploaded successfully');
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to upload document');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.delete(`/documents/${id}`);
      toast.success('Document deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const resetForm = () => {
    setFormData({
      document_type: '',
      entity_type: 'truck',
      entity_id: '',
      document_number: '',
      issue_date: '',
      expiry_date: '',
      reminder_days: 30,
      notes: '',
      file: null
    });
  };

  const getStatusBadge = (doc) => {
    const status = doc.computed_status || doc.status;
    if (status === 'expired') {
      return <span className="badge badge-danger flex items-center gap-1"><AlertTriangle size={12} />Expired</span>;
    } else if (status === 'expiring_soon') {
      return <span className="badge badge-warning flex items-center gap-1"><Clock size={12} />Expiring Soon</span>;
    }
    return <span className="badge badge-success flex items-center gap-1"><CheckCircle size={12} />Active</span>;
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = 
      doc.entity_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.document_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.document_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'truck') return matchesSearch && doc.entity_type === 'truck';
    if (activeTab === 'driver') return matchesSearch && doc.entity_type === 'driver';
    if (activeTab === 'expiring') return matchesSearch && doc.computed_status === 'expiring_soon';
    if (activeTab === 'expired') return matchesSearch && doc.computed_status === 'expired';
    return matchesSearch;
  });

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-IN') : '-';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-slate-500">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          Loading documents...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title">Document Management</h1>
          <p className="page-subtitle">Track and manage all truck and driver documents</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary"
        >
          <Plus size={18} />
          <span>Add Document</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        <div className="stat-card stat-card-blue">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-slate-500">Total Documents</p>
              <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">{summary.total_count || 0}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <FileText size={20} className="text-white" />
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-green">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-slate-500">Active</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-600 mt-1">{summary.active_count || 0}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
              <CheckCircle size={20} className="text-white" />
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-orange">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-slate-500">Expiring Soon</p>
              <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">{summary.expiring_soon_count || 0}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <Clock size={20} className="text-white" />
            </div>
          </div>
        </div>
        <div className="stat-card stat-card-red">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-slate-500">Expired</p>
              <p className="text-xl sm:text-2xl font-bold text-red-600 mt-1">{summary.expired_count || 0}</p>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
              <AlertTriangle size={20} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="tabs">
          {[
            { id: 'all', label: 'All' },
            { id: 'truck', label: 'Trucks', icon: Truck },
            { id: 'driver', label: 'Drivers', icon: Users },
            { id: 'expiring', label: 'Expiring' },
            { id: 'expired', label: 'Expired' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
            >
              {tab.icon && <tab.icon size={14} className="inline mr-1" />}
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Documents List */}
      <div className="space-y-3">
        {filteredDocuments.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} className="mb-4 text-slate-300" />
            <p>No documents found</p>
          </div>
        ) : (
          filteredDocuments.map(doc => (
            <div key={doc.id} className="card flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  doc.entity_type === 'truck' 
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
                    : 'bg-gradient-to-br from-violet-500 to-purple-600'
                }`}>
                  {doc.entity_type === 'truck' ? <Truck size={20} className="text-white" /> : <Users size={20} className="text-white" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-800">{doc.entity_name}</h3>
                    {getStatusBadge(doc)}
                  </div>
                  <p className="text-sm text-slate-500 capitalize">{doc.document_type.replace('_', ' ')}</p>
                  {doc.document_number && (
                    <p className="text-xs text-slate-400 mt-1">#{doc.document_number}</p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="text-right">
                  {doc.expiry_date && (
                    <>
                      <p className="text-xs text-slate-400">Expiry Date</p>
                      <p className={`text-sm font-medium ${
                        doc.computed_status === 'expired' ? 'text-red-600' : 
                        doc.computed_status === 'expiring_soon' ? 'text-amber-600' : 'text-slate-700'
                      }`}>
                        {formatDate(doc.expiry_date)}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {doc.file_path && (
                    <a
                      href={`${import.meta.env.VITE_API_URL}${doc.file_path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="icon-btn"
                      title="View Document"
                    >
                      <Eye size={18} />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="icon-btn-danger"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Document Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800">Add New Document</h2>
                <button onClick={() => setShowModal(false)} className="icon-btn">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                {/* Entity Type */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="entity_type"
                      value="truck"
                      checked={formData.entity_type === 'truck'}
                      onChange={(e) => setFormData({ ...formData, entity_type: e.target.value, entity_id: '', document_type: '' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <Truck size={18} />
                    <span>Truck</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="entity_type"
                      value="driver"
                      checked={formData.entity_type === 'driver'}
                      onChange={(e) => setFormData({ ...formData, entity_type: e.target.value, entity_id: '', document_type: '' })}
                      className="w-4 h-4 text-blue-600"
                    />
                    <Users size={18} />
                    <span>Driver</span>
                  </label>
                </div>

                {/* Entity Selection */}
                <div className="input-group">
                  <label className="label">
                    {formData.entity_type === 'truck' ? 'Select Truck' : 'Select Driver'} *
                  </label>
                  <select
                    value={formData.entity_id}
                    onChange={(e) => setFormData({ ...formData, entity_id: e.target.value })}
                    className="input"
                    required
                  >
                    <option value="">Choose...</option>
                    {formData.entity_type === 'truck' 
                      ? trucks.map(t => <option key={t.id} value={t.id}>{t.truck_number}</option>)
                      : drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                    }
                  </select>
                </div>

                {/* Document Type */}
                <div className="input-group">
                  <label className="label">Document Type *</label>
                  <select
                    value={formData.document_type}
                    onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                    className="input"
                    required
                  >
                    <option value="">Choose...</option>
                    {documentTypes[formData.entity_type].map(dt => (
                      <option key={dt.value} value={dt.value}>{dt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Document Number */}
                <div className="input-group">
                  <label className="label">Document Number</label>
                  <input
                    type="text"
                    value={formData.document_number}
                    onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                    className="input"
                    placeholder="e.g., MH12AB1234"
                  />
                </div>

                {/* Dates */}
                <div className="form-grid">
                  <div className="input-group">
                    <label className="label">Issue Date</label>
                    <input
                      type="date"
                      value={formData.issue_date}
                      onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div className="input-group">
                    <label className="label">Expiry Date</label>
                    <input
                      type="date"
                      value={formData.expiry_date}
                      onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                      className="input"
                    />
                  </div>
                </div>

                {/* Reminder Days */}
                <div className="input-group">
                  <label className="label">Remind before (days)</label>
                  <input
                    type="number"
                    value={formData.reminder_days}
                    onChange={(e) => setFormData({ ...formData, reminder_days: parseInt(e.target.value) })}
                    className="input"
                    min="1"
                    max="365"
                  />
                </div>

                {/* File Upload */}
                <div className="input-group">
                  <label className="label">Upload Document</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
                    <input
                      type="file"
                      onChange={(e) => setFormData({ ...formData, file: e.target.files[0] })}
                      className="hidden"
                      id="file-upload"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                      <p className="text-sm text-slate-600">
                        {formData.file ? formData.file.name : 'Click to upload or drag and drop'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG, DOC (max 10MB)</p>
                    </label>
                  </div>
                </div>

                {/* Notes */}
                <div className="input-group">
                  <label className="label">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="input"
                    rows={2}
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Upload size={18} />
                  Upload Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
