import { useState, useEffect } from 'react';
import { Plus, Wallet, Building2, PiggyBank, CreditCard, X, Banknote, BookOpen } from 'lucide-react';
import api from '../services/api';

export default function Ledger() {
  const [activeTab, setActiveTab] = useState('cash');
  const [cashTransactions, setCashTransactions] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [summary, setSummary] = useState({ cash_balance: 0, total_bank_balance: 0, bank_accounts: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [transactionType, setTransactionType] = useState('cash');
  const [formData, setFormData] = useState({
    transaction_date: new Date().toISOString().split('T')[0],
    transaction_type: 'expense', // for cash: income/expense, for bank: credit/debit
    bank_name: '',
    category: '',
    amount: '',
    description: '',
    reference_number: ''
  });

  const categories = {
    income: ['Trip Income', 'Party Payment', 'Other Income'],
    expense: ['Fuel', 'Salary', 'Advance', 'Maintenance', 'Insurance', 'Tax', 'Toll', 'Driver Expense', 'Office Expense', 'Other']
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [cashRes, bankRes, summaryRes] = await Promise.all([
        api.get('/ledger/cash'),
        api.get('/ledger/bank'),
        api.get('/ledger/summary')
      ]);
      setCashTransactions(cashRes.data);
      setBankTransactions(bankRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = transactionType === 'cash' ? '/ledger/cash' : '/ledger/bank';
      const payload = { ...formData };
      if (transactionType === 'bank') {
        payload.transaction_type = formData.transaction_type === 'income' ? 'credit' : 'debit';
      }
      await api.post(endpoint, payload);
      setShowModal(false);
      setFormData({
        transaction_date: new Date().toISOString().split('T')[0],
        transaction_type: 'expense',
        bank_name: '',
        category: '',
        amount: '',
        description: '',
        reference_number: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error saving transaction:', error);
    }
  };

  const openAddModal = (type) => {
    setTransactionType(type);
    setFormData({
      transaction_date: new Date().toISOString().split('T')[0],
      transaction_type: 'expense',
      bank_name: '',
      category: '',
      amount: '',
      description: '',
      reference_number: ''
    });
    setShowModal(true);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-slate-500">
          <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
          Loading ledger data...
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'cash', label: 'Cash Ledger', icon: Banknote, color: 'green' },
    { id: 'bank', label: 'Bank Ledger', icon: Building2, color: 'blue' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Cash & Bank Ledger</h1>
          <p className="text-slate-500 mt-1">Track all cash and bank transactions</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => openAddModal('cash')} 
            className="flex items-center gap-2 px-4 py-2.5 border border-green-500 text-green-600 rounded-xl font-medium hover:bg-green-50 transition-colors"
          >
            <Plus size={18} />
            Cash Entry
          </button>
          <button 
            onClick={() => openAddModal('bank')} 
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all"
          >
            <Plus size={18} />
            Bank Entry
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Cash Balance</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.cash_balance)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-500/30">
              <Banknote size={24} className="text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Bank Balance</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(summary.total_bank_balance)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Building2 size={24} className="text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Balance</p>
              <p className="text-2xl font-bold text-violet-600 mt-1">{formatCurrency(summary.total_balance)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <PiggyBank size={24} className="text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Bank Accounts</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{summary.bank_accounts?.length || 0}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <CreditCard size={24} className="text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Bank Account Balances */}
      {summary.bank_accounts?.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 size={20} className="text-blue-500" />
            Bank Account Balances
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summary.bank_accounts.map((account, index) => (
              <div key={index} className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-xl border border-slate-200">
                <div className="text-sm text-slate-500">{account.bank_name}</div>
                <div className="font-bold text-slate-900 text-lg mt-1">{formatCurrency(account.balance)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl p-1.5 shadow-sm border border-slate-100 inline-flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? tab.id === 'cash'
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'cash' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">In</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Out</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <Banknote size={48} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-500 font-medium">No cash transactions found</p>
                    </td>
                  </tr>
                ) : (
                  cashTransactions.map((txn, idx) => (
                    <tr key={txn.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-6 py-4 text-slate-600">{new Date(txn.transaction_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-slate-100 text-slate-700">{txn.category}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{txn.description || '-'}</td>
                      <td className="px-6 py-4 text-right font-medium text-green-600">
                        {txn.transaction_type === 'income' ? formatCurrency(txn.amount) : ''}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-red-600">
                        {txn.transaction_type === 'expense' ? formatCurrency(txn.amount) : ''}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(txn.balance_after)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'bank' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bank</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ref #</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Credit</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Debit</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bankTransactions.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center">
                      <Building2 size={48} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-slate-500 font-medium">No bank transactions found</p>
                    </td>
                  </tr>
                ) : (
                  bankTransactions.map((txn, idx) => (
                    <tr key={txn.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                      <td className="px-6 py-4 text-slate-600">{new Date(txn.transaction_date).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Building2 size={14} className="text-blue-600" />
                          </div>
                          <span className="font-medium text-slate-900">{txn.bank_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-slate-100 text-slate-700">{txn.category}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{txn.description || '-'}</td>
                      <td className="px-6 py-4 text-slate-500 text-sm">{txn.reference_number || '-'}</td>
                      <td className="px-6 py-4 text-right font-medium text-green-600">
                        {txn.transaction_type === 'credit' ? formatCurrency(txn.amount) : ''}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-red-600">
                        {txn.transaction_type === 'debit' ? formatCurrency(txn.amount) : ''}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">{formatCurrency(txn.balance_after)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Add {transactionType === 'cash' ? 'Cash' : 'Bank'} Transaction</h2>
                <p className="text-slate-500 mt-1">Record a new {transactionType} entry</p>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date *</label>
                  <input type="date" value={formData.transaction_date} onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Type *</label>
                  <select value={formData.transaction_type} onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value, category: '' })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white" required>
                    <option value="income">Income / Credit</option>
                    <option value="expense">Expense / Debit</option>
                  </select>
                </div>
              </div>
              {transactionType === 'bank' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Bank Name *</label>
                  <input type="text" value={formData.bank_name} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" required placeholder="e.g., HDFC, SBI, ICICI" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Category *</label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white" required>
                  <option value="">Select Category</option>
                  {categories[formData.transaction_type]?.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount *</label>
                <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" required min="0" step="0.01" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="Brief description" />
              </div>
              {transactionType === 'bank' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Reference Number</label>
                  <input type="text" value={formData.reference_number} onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" placeholder="Cheque #, UTR, etc." />
                </div>
              )}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" className={`px-5 py-2.5 rounded-xl font-semibold shadow-lg transition-all ${transactionType === 'cash' ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-500/30 hover:shadow-green-500/40' : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-500/30 hover:shadow-blue-500/40'}`}>Save Transaction</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
