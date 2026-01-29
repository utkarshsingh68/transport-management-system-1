import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Upload, Receipt, X, Wallet, CreditCard, TrendingDown } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../services/api';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    truck_id: '',
    category: '',
    description: '',
    amount: '',
    payment_mode: 'cash',
    bank_name: '',
    bill_number: '',
    vendor_name: '',
    notes: '',
  });

  const categories = [
    'Maintenance & Repair',
    'Tyre',
    'Insurance',
    'Tax & Permit',
    'Toll',
    'Loading/Unloading',
    'Driver Advance',
    'Office Expense',
    'Other',
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [expensesRes, trucksRes, summaryRes] = await Promise.all([
        api.get('/expenses'),
        api.get('/trucks'),
        api.get('/expenses/summary/categories'),
      ]);
      setExpenses(expensesRes.data);
      setTrucks(trucksRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key]) {
          data.append(key, formData[key]);
        }
      });

      if (editingExpense) {
        await api.put(`/expenses/${editingExpense.id}`, formData);
        toast.success('Expense updated successfully');
      } else {
        await api.post('/expenses', formData, {
          headers: { 'Content-Type': 'application/json' },
        });
        toast.success('Expense created successfully');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      toast.success('Expense deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      expense_date: expense.expense_date?.split('T')[0],
      truck_id: expense.truck_id || '',
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      payment_mode: expense.payment_mode,
      bank_name: expense.bank_name || '',
      bill_number: expense.bill_number || '',
      vendor_name: expense.vendor_name || '',
      notes: expense.notes || '',
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingExpense(null);
    setFormData({
      expense_date: new Date().toISOString().split('T')[0],
      truck_id: '',
      category: '',
      description: '',
      amount: '',
      payment_mode: 'cash',
      bank_name: '',
      bill_number: '',
      vendor_name: '',
      notes: '',
    });
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  const cashExpenses = expenses.filter(e => e.payment_mode === 'cash').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  const bankExpenses = expenses.filter(e => e.payment_mode === 'bank').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-500 font-medium">Loading expenses...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Expense Management</h1>
          <p className="text-slate-500 mt-1">Track and manage all your business expenses</p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg shadow-red-500/30 hover:shadow-red-500/40 hover:from-red-600 hover:to-red-700 transition-all duration-200"
        >
          <Plus size={20} />
          Add Expense
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-5 text-white shadow-lg shadow-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Total Expenses</p>
              <p className="text-3xl font-bold mt-1">₹{(totalExpenses/1000).toFixed(0)}K</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingDown size={24} />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-5 text-white shadow-lg shadow-emerald-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium">Cash Expenses</p>
              <p className="text-3xl font-bold mt-1">₹{(cashExpenses/1000).toFixed(0)}K</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Wallet size={24} />
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Bank Expenses</p>
              <p className="text-3xl font-bold mt-1">₹{(bankExpenses/1000).toFixed(0)}K</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <CreditCard size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Category Summary */}
      {summary.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Expense Summary by Category</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summary.slice(0, 8).map((item) => (
              <div key={item.category} className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-sm text-slate-500 font-medium">{item.category}</p>
                <p className="text-xl font-bold text-slate-900 mt-1">₹{parseFloat(item.total).toLocaleString('en-IN')}</p>
                <p className="text-xs text-slate-400 mt-0.5">{item.count} entries</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Date</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Category</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Description</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Truck</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Amount</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Payment</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Vendor</th>
                <th className="text-left py-4 px-6 font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense, index) => (
                <tr 
                  key={expense.id}
                  className={`border-b border-slate-100 hover:bg-slate-50/80 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                >
                  <td className="py-4 px-6 text-slate-600">{new Date(expense.expense_date).toLocaleDateString()}</td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 ring-1 ring-purple-600/20">
                      {expense.category}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-slate-600 max-w-xs truncate">{expense.description}</td>
                  <td className="py-4 px-6 text-slate-600">{expense.truck_number || '-'}</td>
                  <td className="py-4 px-6 font-semibold text-red-600">₹{parseFloat(expense.amount).toLocaleString('en-IN')}</td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                      expense.payment_mode === 'cash'
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                        : 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20'
                    }`}>
                      {expense.payment_mode}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-slate-600">{expense.vendor_name || '-'}</td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleEdit(expense)} 
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(expense.id)} 
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan="8" className="py-12 text-center">
                    <Receipt size={48} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-slate-500">No expenses found</p>
                    <p className="text-slate-400 text-sm mt-1">Add your first expense to get started</p>
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
                <h2 className="text-2xl font-bold text-slate-900">{editingExpense ? 'Edit Expense' : 'Add New Expense'}</h2>
                <p className="text-slate-500 mt-1">{editingExpense ? 'Update expense details' : 'Record a new expense'}</p>
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Date *</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Category *</label>
                  <select
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Description *</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter expense description"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="e.g., 5000"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Truck (Optional)</label>
                  <select
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                    value={formData.truck_id}
                    onChange={(e) => setFormData({ ...formData, truck_id: e.target.value })}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Mode *</label>
                  <select
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white"
                    value={formData.payment_mode}
                    onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                    required
                  >
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                  </select>
                </div>
                {formData.payment_mode === 'bank' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Bank Name</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      value={formData.bank_name}
                      onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                      placeholder="e.g., HDFC Bank"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Bill Number</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.bill_number}
                    onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
                    placeholder="e.g., INV-2024-001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Vendor Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                    placeholder="e.g., ABC Repairs"
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
                  className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg shadow-red-500/30 hover:shadow-red-500/40 transition-all"
                >
                  {editingExpense ? 'Update Expense' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
