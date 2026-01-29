import { useState, useEffect } from 'react';
import { Plus, Edit2, BookOpen, X, Users, TrendingUp, TrendingDown, Search } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

export default function Parties() {
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [selectedParty, setSelectedParty] = useState(null);
  const [ledgerData, setLedgerData] = useState({ party: null, ledger: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '', company_name: '', phone: '', email: '', address: '',
    gstin: '', pan: '', bank_details: '', opening_balance: 0
  });

  useEffect(() => {
    fetchParties();
  }, []);

  const fetchParties = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/parties`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setParties(response.data);
    } catch (error) {
      console.error('Error fetching parties:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLedger = async (partyId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/parties/${partyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLedgerData(response.data);
      setShowLedger(true);
    } catch (error) {
      console.error('Error fetching ledger:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      if (selectedParty) {
        await axios.put(`${API_URL}/parties/${selectedParty.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/parties`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowModal(false);
      setSelectedParty(null);
      setFormData({ name: '', company_name: '', phone: '', email: '', address: '', gstin: '', pan: '', bank_details: '', opening_balance: 0 });
      fetchParties();
    } catch (error) {
      console.error('Error saving party:', error);
    }
  };

  const openEditModal = (party) => {
    setSelectedParty(party);
    setFormData({
      name: party.name || '',
      company_name: party.company_name || '',
      phone: party.phone || '',
      email: party.email || '',
      address: party.address || '',
      gstin: party.gstin || '',
      pan: party.pan || '',
      bank_details: party.bank_details || '',
      opening_balance: party.opening_balance || 0
    });
    setShowModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-slate-500">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          Loading parties...
        </div>
      </div>
    );
  }

  const filteredParties = parties.filter(party =>
    party.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    party.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    party.phone?.includes(searchTerm)
  );

  const totalReceivables = parties.reduce((sum, p) => sum + (p.balance > 0 ? p.balance : 0), 0);
  const totalPayables = Math.abs(parties.reduce((sum, p) => sum + (p.balance < 0 ? p.balance : 0), 0));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Parties / Customers</h1>
          <p className="text-slate-500 mt-1">Manage your business partners and customers</p>
        </div>
        <button
          onClick={() => { setShowModal(true); setSelectedParty(null); setFormData({ name: '', company_name: '', phone: '', email: '', address: '', gstin: '', pan: '', bank_details: '', opening_balance: 0 }); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-violet-600 text-white rounded-xl font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 transition-all"
        >
          <Plus size={20} />
          Add Party
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Parties</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{parties.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Users size={24} className="text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Receivables</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(totalReceivables)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30">
              <TrendingUp size={24} className="text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Payables</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totalPayables)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
              <TrendingDown size={24} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input
          type="text"
          placeholder="Search parties by name, company, or phone..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Parties Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Phone</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">GSTIN</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Balance</th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParties.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <Users size={48} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium">No parties found</p>
                    <p className="text-slate-400 text-sm mt-1">Add your first party to get started</p>
                  </td>
                </tr>
              ) : (
                filteredParties.map((party, idx) => (
                  <tr key={party.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white font-medium text-sm">
                          {party.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-900">{party.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{party.company_name || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{party.phone || '-'}</td>
                    <td className="px-6 py-4">
                      {party.gstin ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-slate-100 text-slate-700">
                          {party.gstin}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${party.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(party.balance)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-1">
                        <button 
                          onClick={() => fetchLedger(party.id)} 
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="View Ledger"
                        >
                          <BookOpen size={16} />
                        </button>
                        <button 
                          onClick={() => openEditModal(party)} 
                          className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{selectedParty ? 'Edit Party' : 'Add New Party'}</h2>
                <p className="text-slate-500 mt-1">{selectedParty ? 'Update party details' : 'Add a new business partner'}</p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" placeholder="Party name" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Company Name</label>
                  <input type="text" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" placeholder="Company name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" placeholder="Phone number" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" placeholder="Email address" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">GSTIN</label>
                  <input type="text" value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" placeholder="GST Number" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">PAN</label>
                  <input type="text" value={formData.pan} onChange={(e) => setFormData({ ...formData, pan: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" placeholder="PAN Number" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Opening Balance</label>
                  <input type="number" value={formData.opening_balance} onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" placeholder="0" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
                  <textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all resize-none" rows="2" placeholder="Full address"></textarea>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Bank Details</label>
                  <textarea value={formData.bank_details} onChange={(e) => setFormData({ ...formData, bank_details: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all resize-none" rows="2" placeholder="Account number, IFSC, Bank name"></textarea>
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-violet-600 text-white rounded-xl font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 transition-all">Save Party</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ledger Modal */}
      {showLedger && ledgerData.party && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white font-bold text-lg">
                  {ledgerData.party.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Ledger - {ledgerData.party.name}</h2>
                  <p className="text-slate-500 text-sm">{ledgerData.party.company_name || 'Individual'}</p>
                </div>
              </div>
              <button onClick={() => setShowLedger(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 p-6 border-b border-slate-100">
              <div className="bg-slate-50 p-4 rounded-xl">
                <div className="text-sm text-slate-500">Opening Balance</div>
                <div className="font-bold text-slate-900 text-lg">{formatCurrency(ledgerData.party.opening_balance || 0)}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <div className="text-sm text-slate-500">Phone</div>
                <div className="font-bold text-slate-900 text-lg">{ledgerData.party.phone || '-'}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <div className="text-sm text-slate-500">GSTIN</div>
                <div className="font-bold text-slate-900 text-lg">{ledgerData.party.gstin || '-'}</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Debit</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerData.ledger.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center">
                        <BookOpen size={48} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-500 font-medium">No transactions found</p>
                      </td>
                    </tr>
                  ) : (
                    ledgerData.ledger.map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-6 py-4 text-slate-600">{new Date(item.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-slate-900">{item.description}</td>
                        <td className="px-6 py-4 text-right text-red-600 font-medium">{item.debit > 0 ? formatCurrency(item.debit) : ''}</td>
                        <td className="px-6 py-4 text-right text-green-600 font-medium">{item.credit > 0 ? formatCurrency(item.credit) : ''}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
