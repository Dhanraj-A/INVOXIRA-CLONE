import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout    from './components/Layout'
import Login     from './pages/Login'
import Dashboard from './pages/Dashboard'
import Sale      from './pages/Sale'
import { Purchase, Inventory, Parties, Expenses, Staff, Reports, Settings, PrintThemes, CreditDebitNote, FYClosing } from './pages/AllPages'
import { migrateOldData } from './utils/fy'

// Migrate old flat data to FY-based keys on first load
migrateOldData()

function PrivateRoute({ children }) {
  return localStorage.getItem('inv_token') ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="sale"      element={<Sale />} />
          <Route path="purchase"  element={<Purchase />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="parties"   element={<Parties />} />
          <Route path="expenses"  element={<Expenses />} />
          <Route path="staff"     element={<Staff />} />
          <Route path="reports"   element={<Reports />} />
          <Route path="print"     element={<PrintThemes />} />
          <Route path="settings"  element={<Settings />} />
          <Route path="fy-closing" element={<FYClosing />} />
          <Route path="cdn"       element={<CreditDebitNote />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}