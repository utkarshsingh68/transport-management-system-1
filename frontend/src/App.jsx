import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Trucks from './pages/Trucks';
import Drivers from './pages/Drivers';
import Trips from './pages/Trips';
import Fuel from './pages/Fuel';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Parties from './pages/Parties';
import Salary from './pages/Salary';
import Ledger from './pages/Ledger';
import ProfitLoss from './pages/ProfitLoss';
import Documents from './pages/Documents';
import Payments from './pages/Payments';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="trucks" element={<Trucks />} />
            <Route path="drivers" element={<Drivers />} />
            <Route path="trips" element={<Trips />} />
            <Route path="fuel" element={<Fuel />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="parties" element={<Parties />} />
            <Route path="salary" element={<Salary />} />
            <Route path="ledger" element={<Ledger />} />
            <Route path="profit-loss" element={<ProfitLoss />} />
            <Route path="documents" element={<Documents />} />
            <Route path="payments" element={<Payments />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </Router>
      <ToastContainer position="top-right" autoClose={3000} />
    </AuthProvider>
  );
}

export default App;
