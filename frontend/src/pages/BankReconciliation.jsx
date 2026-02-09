import { useState, useEffect } from 'react';
import { 
  Building2, Plus, Search, X, Check, Link2, Unlink, AlertTriangle,
  IndianRupee, Calendar, ArrowUpRight, ArrowDownRight, Filter,
  Download, Upload, RefreshCw, CheckCircle, Clock, Eye
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

const BankReconciliation = () => {
  const [accounts, setAccounts] = useState([]);
  const [statements, setStatements] = useState([]);
  const [unreconciledTxns, setUnreconciledTxns] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [filterReconciled, setFilterReconciled] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const [accountForm, setAccountForm] = useState({
    account_name: '', bank_name: '', account_number: '', ifsc_code: '',
    branch: '', account_type: 'current', opening_balance: 0
  });

  const [statementForm, setStatementForm] = useState({
    bank_account_id: '', transaction_date: new Date().toISOString().split('T')[0],
    description: '', reference_number: '', debit_amount: '', credit_amount: '',
    balance: '', transaction_type: 'NEFT'
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      fetchStatements();
      fetchSummary();
    }
  }, [selectedAccount, filterReconciled, dateRange]);

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/bank-reconciliation/accounts');
      setAccounts(res.data);
      if (res.data.length > 0 && !selectedAccount) {
        setSelectedAccount(res.data[0].id.toString());
      }
    } catch (error) {
      toast.error('Failed to load bank accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatements = async () => {
    try {
      const params = new URLSearchParams();
      params.append('account_id', selectedAccount);
      if (filterReconciled !== 'all') params.append('is_reconciled', filterReconciled);
      if (dateRange.from) params.append('from_date', dateRange.from);
      if (dateRange.to) params.append('to_date', dateRange.to);
      if (searchTerm) params.append('search', searchTerm);

      const res = await api.get(`/bank-reconciliation/statements?${params.toString()}`);
      setStatements(res.data);
    } catch (error) {
      console.error('Error fetching statements:', error);
    }
  };

  const fetchSummary = async () => {
    try {
      const params = new URLSearchParams();
      params.append('account_id', selectedAccount);
      if (dateRange.from) params.append('from_date', dateRange.from);
      if (dateRange.to) params.append('to_date', dateRange.to);

      const res = await api.get(`/bank-reconciliation/summary?${params.toString()}`);
      setSummary(res.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const fetchUnreconciledTransactions = async () => {
    try {
      const res = await api.get('/bank-reconciliation/unreconciled-transactions');
      setUnreconciledTxns(res.data);
    } catch (error) {
      console.error('Error fetching unreconciled transactions:', error);
    }
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    try {
      await api.post('/bank-reconciliation/accounts', accountForm);
      toast.success('Bank account added');
      setShowAccountModal(false);
      setAccountForm({
        account_name: '', bank_name: '', account_number: '', ifsc_code: '',
        branch: '', account_type: 'current', opening_balance: 0
      });
      fetchAccounts();
    } catch (error) {
      toast.error('Failed to save account');
    }
  };

  const handleAddStatement = async (e) => {
    e.preventDefault();
    try {
      await api.post('/bank-reconciliation/statements', {
        ...statementForm,
        bank_account_id: selectedAccount
      });
      toast.success('Statement entry added');
      setShowStatementModal(false);
      setStatementForm({
        bank_account_id: '', transaction_date: new Date().toISOString().split('T')[0],
        description: '', reference_number: '', debit_amount: '', credit_amount: '',
        balance: '', transaction_type: 'NEFT'
      });
      fetchStatements();
      fetchSummary();
    } catch (error) {
      toast.error('Failed to add statement');
    }
  };

  const handleReconcile = async (statement) => {
    setSelectedStatement(statement);
    await fetchUnreconciledTransactions();
    
    // Get suggestions
    try {
      const res = await api.post('/bank-reconciliation/suggest-matches', { statement_id: statement.id });
      setSuggestions(res.data);
    } catch (error) {
      setSuggestions([]);
    }
    
    setShowReconcileModal(true);
  };

  const confirmReconcile = async (txn) => {
    try {
      await api.post('/bank-reconciliation/reconcile', {
        statement_id: selectedStatement.id,
        matched_type: txn.type,
        matched_id: txn.id,
        notes: `Matched with ${txn.description}`
      });
      toast.success('Transaction reconciled');
      setShowReconcileModal(false);
      fetchStatements();
      fetchSummary();
    } catch (error) {
      toast.error('Failed to reconcile');
    }
  };

  const handleUnreconcile = async (statementId) => {
    if (window.confirm('Are you sure you want to unreconcile this transaction?')) {
      try {
        await api.post(`/bank-reconciliation/unreconcile/${statementId}`);
        toast.success('Transaction unreconciled');
        fetchStatements();
        fetchSummary();
      } catch (error) {
        toast.error('Failed to unreconcile');
      }
    }
  };

  const handleDeleteStatement = async (id) => {
    if (window.confirm('Delete this statement entry?')) {
      try {
        await api.delete(`/bank-reconciliation/statements/${id}`);
        toast.success('Statement deleted');
        fetchStatements();
        fetchSummary();
      } catch (error) {
        toast.error('Failed to delete');
      }
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Bank Reconciliation</h1>
          <p className="text-gray-600">Match bank statements with your transactions</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAccountModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Building2 size={18} />
            Add Bank
          </button>
          <button
            onClick={() => setShowStatementModal(true)}
            disabled={!selectedAccount}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={18} />
            Add Entry
          </button>
        </div>
      </div>

      {/* Account Selection & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Bank Account</label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.account_name} - {acc.bank_name}
              </option>
            ))}
          </select>
        </div>

        {summary && (
          <>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Entries</p>
                  <p className="text-xl font-bold">{summary.total_entries}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-green-600">{summary.reconciled_count} reconciled</p>
                  <p className="text-xs text-orange-600">{summary.unreconciled_count} pending</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-sm text-gray-500">Total Debits</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(summary.total_debits)}</p>
              <p className="text-xs text-gray-500">Unreconciled: {formatCurrency(summary.unreconciled_debits)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <p className="text-sm text-gray-500">Total Credits</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(summary.total_credits)}</p>
              <p className="text-xs text-gray-500">Unreconciled: {formatCurrency(summary.unreconciled_credits)}</p>
            </div>
          </>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by description or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchStatements()}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterReconciled}
            onChange={(e) => setFilterReconciled(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Entries</option>
            <option value="false">Unreconciled</option>
            <option value="true">Reconciled</option>
          </select>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={fetchStatements}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Statements List */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reference</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Debit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Credit</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {statements.map((stmt) => (
                <tr key={stmt.id} className={`hover:bg-gray-50 ${stmt.is_reconciled ? 'bg-green-50' : ''}`}>
                  <td className="px-4 py-3 text-sm">
                    {new Date(stmt.transaction_date).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">{stmt.description}</div>
                    {stmt.transaction_type && (
                      <span className="text-xs text-gray-500">{stmt.transaction_type}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{stmt.reference_number || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    {parseFloat(stmt.debit_amount) > 0 && (
                      <span className="text-red-600 font-medium flex items-center justify-end gap-1">
                        <ArrowUpRight size={14} />
                        {formatCurrency(stmt.debit_amount)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {parseFloat(stmt.credit_amount) > 0 && (
                      <span className="text-green-600 font-medium flex items-center justify-end gap-1">
                        <ArrowDownRight size={14} />
                        {formatCurrency(stmt.credit_amount)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {stmt.is_reconciled ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
                        <CheckCircle size={12} />
                        Reconciled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">
                        <Clock size={12} />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      {!stmt.is_reconciled ? (
                        <button
                          onClick={() => handleReconcile(stmt)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Reconcile"
                        >
                          <Link2 size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUnreconcile(stmt.id)}
                          className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                          title="Unreconcile"
                        >
                          <Unlink size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteStatement(stmt.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {statements.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    No statements found. Add bank entries to start reconciling.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Bank Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Add Bank Account</h2>
              <button onClick={() => setShowAccountModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveAccount} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                  <input
                    type="text"
                    value={accountForm.account_name}
                    onChange={(e) => setAccountForm({ ...accountForm, account_name: e.target.value })}
                    placeholder="e.g., Main Business Account"
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={accountForm.bank_name}
                    onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={accountForm.account_number}
                    onChange={(e) => setAccountForm({ ...accountForm, account_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={accountForm.ifsc_code}
                    onChange={(e) => setAccountForm({ ...accountForm, ifsc_code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <input
                    type="text"
                    value={accountForm.branch}
                    onChange={(e) => setAccountForm({ ...accountForm, branch: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                  <select
                    value={accountForm.account_type}
                    onChange={(e) => setAccountForm({ ...accountForm, account_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="current">Current</option>
                    <option value="savings">Savings</option>
                    <option value="overdraft">Overdraft</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opening Balance</label>
                  <input
                    type="number"
                    value={accountForm.opening_balance}
                    onChange={(e) => setAccountForm({ ...accountForm, opening_balance: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowAccountModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Add Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Statement Entry Modal */}
      {showStatementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Add Bank Statement Entry</h2>
              <button onClick={() => setShowStatementModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddStatement} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={statementForm.transaction_date}
                    onChange={(e) => setStatementForm({ ...statementForm, transaction_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                  <select
                    value={statementForm.transaction_type}
                    onChange={(e) => setStatementForm({ ...statementForm, transaction_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="NEFT">NEFT</option>
                    <option value="RTGS">RTGS</option>
                    <option value="IMPS">IMPS</option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={statementForm.description}
                    onChange={(e) => setStatementForm({ ...statementForm, description: e.target.value })}
                    placeholder="Transaction description"
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                  <input
                    type="text"
                    value={statementForm.reference_number}
                    onChange={(e) => setStatementForm({ ...statementForm, reference_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Balance</label>
                  <input
                    type="number"
                    value={statementForm.balance}
                    onChange={(e) => setStatementForm({ ...statementForm, balance: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Debit (Payment/Outflow)</label>
                  <input
                    type="number"
                    value={statementForm.debit_amount}
                    onChange={(e) => setStatementForm({ ...statementForm, debit_amount: e.target.value, credit_amount: '' })}
                    placeholder="0"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credit (Receipt/Inflow)</label>
                  <input
                    type="number"
                    value={statementForm.credit_amount}
                    onChange={(e) => setStatementForm({ ...statementForm, credit_amount: e.target.value, debit_amount: '' })}
                    placeholder="0"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowStatementModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Add Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconcile Modal */}
      {showReconcileModal && selectedStatement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Match Transaction</h2>
              <button onClick={() => setShowReconcileModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {/* Bank Statement Info */}
              <div className="bg-blue-50 p-4 rounded-lg mb-6">
                <h3 className="font-semibold mb-2">Bank Statement Entry</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <p><span className="text-gray-500">Date:</span> {new Date(selectedStatement.transaction_date).toLocaleDateString('en-IN')}</p>
                  <p><span className="text-gray-500">Amount:</span> {formatCurrency(selectedStatement.debit_amount || selectedStatement.credit_amount)}</p>
                  <p className="col-span-2"><span className="text-gray-500">Description:</span> {selectedStatement.description}</p>
                  {selectedStatement.reference_number && (
                    <p><span className="text-gray-500">Reference:</span> {selectedStatement.reference_number}</p>
                  )}
                </div>
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-yellow-500" />
                    Suggested Matches
                  </h3>
                  <div className="space-y-2">
                    {suggestions.map((txn, i) => (
                      <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50">
                        <div>
                          <p className="font-medium">{txn.description}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(txn.date).toLocaleDateString('en-IN')} • {formatCurrency(txn.amount)} • {txn.matchReason}
                          </p>
                        </div>
                        <button
                          onClick={() => confirmReconcile(txn)}
                          className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                        >
                          Match
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Unreconciled Transactions */}
              <div>
                <h3 className="font-semibold mb-3">All Unreconciled Transactions</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {unreconciledTxns.map((txn, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            txn.category === 'Expense' ? 'bg-red-100 text-red-700' :
                            txn.category === 'Fuel' ? 'bg-orange-100 text-orange-700' :
                            txn.category === 'Salary' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {txn.category}
                          </span>
                          <span className="font-medium">{txn.description}</span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {new Date(txn.date).toLocaleDateString('en-IN')} • {formatCurrency(txn.amount)}
                          {txn.party && ` • ${txn.party}`}
                        </p>
                      </div>
                      <button
                        onClick={() => confirmReconcile(txn)}
                        className="px-3 py-1 border border-blue-600 text-blue-600 rounded-lg text-sm hover:bg-blue-50"
                      >
                        Match
                      </button>
                    </div>
                  ))}
                  {unreconciledTxns.length === 0 && (
                    <p className="text-center text-gray-500 py-4">No unreconciled transactions found</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankReconciliation;
