import { useState, useEffect } from 'react';
import { 
  FileText, Plus, Search, Filter, Download, Eye, Edit2, Trash2, X,
  IndianRupee, Calendar, Building2, CheckCircle, Clock, AlertTriangle,
  Printer, Settings, ChevronDown, ChevronRight
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' }, { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' }, { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' }, { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' }, { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' }, { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' }, { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' }, { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' }, { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' }, { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' }
];

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [viewingInvoice, setViewingInvoice] = useState(null);
  const [parties, setParties] = useState([]);
  const [hsnCodes, setHsnCodes] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [form, setForm] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    party_id: '',
    party_name: '',
    party_address: '',
    party_gstin: '',
    party_state: '',
    party_state_code: '',
    invoice_type: 'tax_invoice',
    supply_type: 'service',
    place_of_supply: '',
    vehicle_number: '',
    lr_number: '',
    notes: '',
    items: [{ description: '', hsn_sac_code: '996511', quantity: 1, unit: 'NOS', rate: 0, amount: 0, gst_rate: 5 }]
  });

  const [profileForm, setProfileForm] = useState({
    company_name: '', address: '', city: '', state: '', state_code: '', pincode: '',
    gstin: '', pan: '', phone: '', email: '', bank_name: '', bank_account_number: '',
    bank_ifsc: '', bank_branch: '', invoice_prefix: 'INV', invoice_start_number: 1, terms_conditions: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invoicesRes, partiesRes, hsnRes, profileRes, summaryRes] = await Promise.all([
        api.get('/invoices'),
        api.get('/parties'),
        api.get('/invoices/hsn-sac'),
        api.get('/invoices/company-profile'),
        api.get('/invoices/stats/summary')
      ]);
      setInvoices(invoicesRes.data);
      setParties(partiesRes.data);
      setHsnCodes(hsnRes.data);
      setCompanyProfile(profileRes.data);
      setSummary(summaryRes.data);
      if (profileRes.data) {
        setProfileForm(profileRes.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleNewInvoice = async () => {
    try {
      const res = await api.get('/invoices/next-number');
      setForm({
        ...form,
        invoice_number: res.data.invoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
      setEditingInvoice(null);
      setShowModal(true);
    } catch (error) {
      toast.error('Failed to generate invoice number');
    }
  };

  const handlePartyChange = (partyId) => {
    const party = parties.find(p => p.id === parseInt(partyId));
    if (party) {
      const state = INDIAN_STATES.find(s => s.name === party.state);
      setForm({
        ...form,
        party_id: party.id,
        party_name: party.name,
        party_address: party.address || '',
        party_gstin: party.gstin || '',
        party_state: party.state || '',
        party_state_code: state?.code || '',
        place_of_supply: party.state || ''
      });
    }
  };

  const calculateItemTax = (item, index) => {
    const amount = parseFloat(item.quantity) * parseFloat(item.rate) || 0;
    const gstRate = parseFloat(item.gst_rate) || 0;
    
    const companyState = companyProfile?.state_code || '27';
    const partyState = form.party_state_code || '27';
    const isInterState = companyState !== partyState;

    let cgst = 0, sgst = 0, igst = 0;
    if (isInterState) {
      igst = (amount * gstRate) / 100;
    } else {
      cgst = (amount * gstRate / 2) / 100;
      sgst = (amount * gstRate / 2) / 100;
    }

    const updatedItems = [...form.items];
    updatedItems[index] = {
      ...item,
      amount,
      cgst_rate: isInterState ? 0 : gstRate / 2,
      cgst_amount: cgst,
      sgst_rate: isInterState ? 0 : gstRate / 2,
      sgst_amount: sgst,
      igst_rate: isInterState ? gstRate : 0,
      igst_amount: igst,
      total_amount: amount + cgst + sgst + igst
    };
    setForm({ ...form, items: updatedItems });
  };

  const addItem = () => {
    setForm({
      ...form,
      items: [...form.items, { description: '', hsn_sac_code: '996511', quantity: 1, unit: 'NOS', rate: 0, amount: 0, gst_rate: 5 }]
    });
  };

  const removeItem = (index) => {
    if (form.items.length > 1) {
      setForm({ ...form, items: form.items.filter((_, i) => i !== index) });
    }
  };

  const calculateTotals = () => {
    const subtotal = form.items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const cgst = form.items.reduce((sum, item) => sum + (parseFloat(item.cgst_amount) || 0), 0);
    const sgst = form.items.reduce((sum, item) => sum + (parseFloat(item.sgst_amount) || 0), 0);
    const igst = form.items.reduce((sum, item) => sum + (parseFloat(item.igst_amount) || 0), 0);
    const totalTax = cgst + sgst + igst;
    const total = Math.round(subtotal + totalTax);
    return { subtotal, cgst, sgst, igst, totalTax, total };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingInvoice) {
        await api.put(`/invoices/${editingInvoice.id}`, form);
        toast.success('Invoice updated successfully');
      } else {
        await api.post('/invoices', form);
        toast.success('Invoice created successfully');
      }
      setShowModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save invoice');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await api.post('/invoices/company-profile', profileForm);
      toast.success('Company profile saved');
      setShowSettingsModal(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to save company profile');
    }
  };

  const handleView = async (invoice) => {
    try {
      const res = await api.get(`/invoices/${invoice.id}`);
      setViewingInvoice(res.data);
      setShowViewModal(true);
    } catch (error) {
      toast.error('Failed to load invoice');
    }
  };

  const handleEdit = async (invoice) => {
    try {
      const res = await api.get(`/invoices/${invoice.id}`);
      setForm({
        ...res.data,
        items: res.data.items || []
      });
      setEditingInvoice(invoice);
      setShowModal(true);
    } catch (error) {
      toast.error('Failed to load invoice');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      try {
        await api.delete(`/invoices/${id}`);
        toast.success('Invoice deleted');
        fetchData();
      } catch (error) {
        toast.error('Failed to delete invoice');
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          inv.party_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || inv.payment_status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const totals = calculateTotals();

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
          <h1 className="text-2xl font-bold text-gray-900">GST Invoices</h1>
          <p className="text-gray-600">Generate and manage GST compliant invoices</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Settings size={18} />
            Settings
          </button>
          <button
            onClick={handleNewInvoice}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={18} />
            New Invoice
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Invoices</p>
                <p className="text-2xl font-bold">{summary.total_invoices}</p>
              </div>
              <FileText className="text-blue-500" size={32} />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.total_amount)}</p>
              </div>
              <IndianRupee className="text-green-500" size={32} />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Received</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.total_paid)}</p>
              </div>
              <CheckCircle className="text-green-500" size={32} />
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(summary.total_pending)}</p>
              </div>
              <Clock className="text-orange-500" size={32} />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Party</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Amount</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Balance</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-blue-600">{invoice.invoice_number}</td>
                  <td className="px-4 py-3 text-sm">{new Date(invoice.invoice_date).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{invoice.party_name}</div>
                    {invoice.party_gstin && <div className="text-xs text-gray-500">GSTIN: {invoice.party_gstin}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(invoice.total_amount)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(invoice.balance_amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      invoice.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                      invoice.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {invoice.payment_status?.charAt(0).toUpperCase() + invoice.payment_status?.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => handleView(invoice)} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => handleEdit(invoice)} className="p-1 text-gray-600 hover:bg-gray-50 rounded">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(invoice.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    No invoices found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">{editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Invoice Header */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={form.invoice_number}
                    onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={form.invoice_date}
                    onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Type</label>
                  <select
                    value={form.invoice_type}
                    onChange={(e) => setForm({ ...form, invoice_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="tax_invoice">Tax Invoice</option>
                    <option value="bill_of_supply">Bill of Supply</option>
                    <option value="credit_note">Credit Note</option>
                    <option value="debit_note">Debit Note</option>
                  </select>
                </div>
              </div>

              {/* Party Details */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3">Bill To</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Party</label>
                    <select
                      value={form.party_id}
                      onChange={(e) => handlePartyChange(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a party</option>
                      {parties.map(party => (
                        <option key={party.id} value={party.id}>{party.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                    <input
                      type="text"
                      value={form.party_gstin}
                      onChange={(e) => setForm({ ...form, party_gstin: e.target.value.toUpperCase() })}
                      placeholder="22AAAAA0000A1Z5"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      maxLength={15}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <textarea
                      value={form.party_address}
                      onChange={(e) => setForm({ ...form, party_address: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <select
                      value={form.party_state}
                      onChange={(e) => {
                        const state = INDIAN_STATES.find(s => s.name === e.target.value);
                        setForm({ ...form, party_state: e.target.value, party_state_code: state?.code || '', place_of_supply: e.target.value });
                      }}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map(state => (
                        <option key={state.code} value={state.name}>{state.code} - {state.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Place of Supply</label>
                    <input
                      type="text"
                      value={form.place_of_supply}
                      onChange={(e) => setForm({ ...form, place_of_supply: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold">Items</h3>
                  <button type="button" onClick={addItem} className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1">
                    <Plus size={16} /> Add Item
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-2 py-2 text-left">Description</th>
                        <th className="px-2 py-2 text-left w-24">HSN/SAC</th>
                        <th className="px-2 py-2 text-center w-16">Qty</th>
                        <th className="px-2 py-2 text-right w-24">Rate</th>
                        <th className="px-2 py-2 text-center w-20">GST %</th>
                        <th className="px-2 py-2 text-right w-24">Amount</th>
                        <th className="px-2 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {form.items.map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="px-2 py-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => {
                                const items = [...form.items];
                                items[index].description = e.target.value;
                                setForm({ ...form, items });
                              }}
                              placeholder="Service description"
                              className="w-full px-2 py-1 border rounded"
                              required
                            />
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={item.hsn_sac_code}
                              onChange={(e) => {
                                const items = [...form.items];
                                const hsn = hsnCodes.find(h => h.code === e.target.value);
                                items[index].hsn_sac_code = e.target.value;
                                items[index].gst_rate = hsn?.gst_rate || 5;
                                setForm({ ...form, items });
                                calculateItemTax(items[index], index);
                              }}
                              className="w-full px-2 py-1 border rounded text-xs"
                            >
                              {hsnCodes.map(hsn => (
                                <option key={hsn.code} value={hsn.code}>{hsn.code}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const items = [...form.items];
                                items[index].quantity = e.target.value;
                                setForm({ ...form, items });
                                calculateItemTax({ ...items[index], quantity: e.target.value }, index);
                              }}
                              className="w-full px-2 py-1 border rounded text-center"
                              min="1"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              value={item.rate}
                              onChange={(e) => {
                                const items = [...form.items];
                                items[index].rate = e.target.value;
                                setForm({ ...form, items });
                                calculateItemTax({ ...items[index], rate: e.target.value }, index);
                              }}
                              className="w-full px-2 py-1 border rounded text-right"
                              min="0"
                            />
                          </td>
                          <td className="px-2 py-2">
                            <select
                              value={item.gst_rate}
                              onChange={(e) => {
                                const items = [...form.items];
                                items[index].gst_rate = parseFloat(e.target.value);
                                setForm({ ...form, items });
                                calculateItemTax({ ...items[index], gst_rate: e.target.value }, index);
                              }}
                              className="w-full px-2 py-1 border rounded text-center"
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>
                          <td className="px-2 py-2 text-right font-medium">
                            {formatCurrency(item.total_amount || item.amount)}
                          </td>
                          <td className="px-2 py-2">
                            {form.items.length > 1 && (
                              <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700">
                                <X size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="mt-4 flex justify-end">
                  <div className="w-64 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(totals.subtotal)}</span>
                    </div>
                    {totals.cgst > 0 && (
                      <>
                        <div className="flex justify-between text-gray-600">
                          <span>CGST:</span>
                          <span>{formatCurrency(totals.cgst)}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                          <span>SGST:</span>
                          <span>{formatCurrency(totals.sgst)}</span>
                        </div>
                      </>
                    )}
                    {totals.igst > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>IGST:</span>
                        <span>{formatCurrency(totals.igst)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total:</span>
                      <span>{formatCurrency(totals.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
                  <input
                    type="text"
                    value={form.vehicle_number}
                    onChange={(e) => setForm({ ...form, vehicle_number: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">LR Number</label>
                  <input
                    type="text"
                    value={form.lr_number}
                    onChange={(e) => setForm({ ...form, lr_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingInvoice ? 'Update Invoice' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      {showViewModal && viewingInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Invoice #{viewingInvoice.invoice_number}</h2>
              <div className="flex gap-2">
                <button onClick={() => window.print()} className="p-2 hover:bg-gray-100 rounded-lg">
                  <Printer size={20} />
                </button>
                <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6" id="invoice-print">
              {/* Company & Invoice Info */}
              <div className="flex justify-between">
                <div>
                  <h3 className="text-xl font-bold">{viewingInvoice.company?.company_name || 'Your Company'}</h3>
                  <p className="text-sm text-gray-600">{viewingInvoice.company?.address}</p>
                  <p className="text-sm text-gray-600">{viewingInvoice.company?.city}, {viewingInvoice.company?.state} - {viewingInvoice.company?.pincode}</p>
                  {viewingInvoice.company?.gstin && <p className="text-sm font-medium">GSTIN: {viewingInvoice.company.gstin}</p>}
                </div>
                <div className="text-right">
                  <h2 className="text-2xl font-bold text-blue-600">TAX INVOICE</h2>
                  <p className="font-medium">{viewingInvoice.invoice_number}</p>
                  <p className="text-sm">Date: {new Date(viewingInvoice.invoice_date).toLocaleDateString('en-IN')}</p>
                  {viewingInvoice.due_date && <p className="text-sm">Due: {new Date(viewingInvoice.due_date).toLocaleDateString('en-IN')}</p>}
                </div>
              </div>

              {/* Bill To */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-semibold text-gray-500 mb-2">BILL TO</h4>
                <p className="font-bold">{viewingInvoice.party_name}</p>
                <p className="text-sm">{viewingInvoice.party_address}</p>
                <p className="text-sm">{viewingInvoice.party_state}</p>
                {viewingInvoice.party_gstin && <p className="text-sm font-medium">GSTIN: {viewingInvoice.party_gstin}</p>}
              </div>

              {/* Items */}
              <table className="w-full text-sm border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left border">Description</th>
                    <th className="px-3 py-2 text-center border">HSN/SAC</th>
                    <th className="px-3 py-2 text-center border">Qty</th>
                    <th className="px-3 py-2 text-right border">Rate</th>
                    <th className="px-3 py-2 text-right border">Amount</th>
                    <th className="px-3 py-2 text-center border">GST</th>
                    <th className="px-3 py-2 text-right border">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingInvoice.items?.map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 border">{item.description}</td>
                      <td className="px-3 py-2 text-center border">{item.hsn_sac_code}</td>
                      <td className="px-3 py-2 text-center border">{item.quantity}</td>
                      <td className="px-3 py-2 text-right border">{formatCurrency(item.rate)}</td>
                      <td className="px-3 py-2 text-right border">{formatCurrency(item.amount)}</td>
                      <td className="px-3 py-2 text-center border">{item.gst_rate}%</td>
                      <td className="px-3 py-2 text-right border">{formatCurrency(item.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-72 border rounded-lg overflow-hidden">
                  <div className="flex justify-between px-4 py-2 bg-gray-50">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(viewingInvoice.subtotal)}</span>
                  </div>
                  {parseFloat(viewingInvoice.cgst_amount) > 0 && (
                    <>
                      <div className="flex justify-between px-4 py-2 border-t">
                        <span>CGST:</span>
                        <span>{formatCurrency(viewingInvoice.cgst_amount)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2 border-t">
                        <span>SGST:</span>
                        <span>{formatCurrency(viewingInvoice.sgst_amount)}</span>
                      </div>
                    </>
                  )}
                  {parseFloat(viewingInvoice.igst_amount) > 0 && (
                    <div className="flex justify-between px-4 py-2 border-t">
                      <span>IGST:</span>
                      <span>{formatCurrency(viewingInvoice.igst_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-4 py-3 bg-blue-600 text-white font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(viewingInvoice.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Amount in Words */}
              <div className="bg-gray-50 px-4 py-2 rounded">
                <span className="text-sm font-medium">Amount in Words: </span>
                <span className="text-sm">{viewingInvoice.amount_in_words}</span>
              </div>

              {/* Bank Details */}
              {viewingInvoice.company?.bank_name && (
                <div className="border rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-500 mb-2">BANK DETAILS</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><span className="text-gray-500">Bank:</span> {viewingInvoice.company.bank_name}</p>
                    <p><span className="text-gray-500">A/C No:</span> {viewingInvoice.company.bank_account_number}</p>
                    <p><span className="text-gray-500">IFSC:</span> {viewingInvoice.company.bank_ifsc}</p>
                    <p><span className="text-gray-500">Branch:</span> {viewingInvoice.company.bank_branch}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Company Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Company Profile & Invoice Settings</h2>
              <button onClick={() => setShowSettingsModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={profileForm.company_name}
                    onChange={(e) => setProfileForm({ ...profileForm, company_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={profileForm.city}
                    onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <select
                    value={profileForm.state}
                    onChange={(e) => {
                      const state = INDIAN_STATES.find(s => s.name === e.target.value);
                      setProfileForm({ ...profileForm, state: e.target.value, state_code: state?.code || '' });
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map(state => (
                      <option key={state.code} value={state.name}>{state.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                  <input
                    type="text"
                    value={profileForm.pincode}
                    onChange={(e) => setProfileForm({ ...profileForm, pincode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={profileForm.gstin}
                    onChange={(e) => setProfileForm({ ...profileForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg"
                    maxLength={15}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PAN</label>
                  <input
                    type="text"
                    value={profileForm.pan}
                    onChange={(e) => setProfileForm({ ...profileForm, pan: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg"
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Bank Details (for Invoice)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={profileForm.bank_name}
                      onChange={(e) => setProfileForm({ ...profileForm, bank_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                    <input
                      type="text"
                      value={profileForm.bank_account_number}
                      onChange={(e) => setProfileForm({ ...profileForm, bank_account_number: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                    <input
                      type="text"
                      value={profileForm.bank_ifsc}
                      onChange={(e) => setProfileForm({ ...profileForm, bank_ifsc: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                    <input
                      type="text"
                      value={profileForm.bank_branch}
                      onChange={(e) => setProfileForm({ ...profileForm, bank_branch: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Invoice Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
                    <input
                      type="text"
                      value={profileForm.invoice_prefix}
                      onChange={(e) => setProfileForm({ ...profileForm, invoice_prefix: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border rounded-lg"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Number</label>
                    <input
                      type="number"
                      value={profileForm.invoice_start_number}
                      onChange={(e) => setProfileForm({ ...profileForm, invoice_start_number: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border rounded-lg"
                      min={1}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
