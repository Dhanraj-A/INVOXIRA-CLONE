import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('inv_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  const fy = localStorage.getItem('inv_active_fy')
  if (fy) cfg.headers['x-financial-year'] = fy
  return cfg
})

api.interceptors.response.use(res => res, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('inv_token')
    localStorage.removeItem('inv_user')
    window.location.href = '/login'
  }
  return Promise.reject(err)
})

// ── AUTH ──────────────────────────────────────────────────────
export const loginUser    = (d) => api.post('/auth/login', d)
export const registerUser = (d) => api.post('/auth/register', d)
export const resetPassword= (d) => api.post('/auth/reset-password', d)

// keep object exports too
export const authAPI = { login: loginUser, register: registerUser, reset: resetPassword }

// ── INVOICES ──────────────────────────────────────────────────
export const getInvoices    = (p)    => api.get('/invoices', { params: p })
export const getNextInvNo   = ()     => api.get('/invoices/next/number')
export const createInvoice  = (d)    => api.post('/invoices', d)
export const updateInvoice  = (id,d) => api.put(`/invoices/${id}`, d)
export const deleteInvoice  = (id)   => api.delete(`/invoices/${id}`)

export const invoiceAPI = { getAll: getInvoices, nextNumber: getNextInvNo, create: createInvoice, update: updateInvoice, delete: deleteInvoice }

// ── PURCHASES ─────────────────────────────────────────────────
export const getPurchases    = (p)    => api.get('/purchases', { params: p })
export const getNextPurNo    = ()     => api.get('/purchases/next/number')
export const createPurchase  = (d)    => api.post('/purchases', d)
export const updatePurchase  = (id,d) => api.put(`/purchases/${id}`, d)
export const deletePurchase  = (id)   => api.delete(`/purchases/${id}`)

export const purchaseAPI = { getAll: getPurchases, nextNumber: getNextPurNo, create: createPurchase, update: updatePurchase, delete: deletePurchase }

// ── PRODUCTS ──────────────────────────────────────────────────
export const getProducts    = ()     => api.get('/products')
export const createProduct  = (d)    => api.post('/products', d)
export const updateProduct  = (id,d) => api.put(`/products/${id}`, d)
export const deleteProduct  = (id)   => api.delete(`/products/${id}`)

export const productAPI = { getAll: getProducts, create: createProduct, update: updateProduct, delete: deleteProduct }

// ── CUSTOMERS ─────────────────────────────────────────────────
export const getCustomers    = ()     => api.get('/customers')
export const createCustomer  = (d)    => api.post('/customers', d)
export const updateCustomer  = (id,d) => api.put(`/customers/${id}`, d)
export const deleteCustomer  = (id)   => api.delete(`/customers/${id}`)

export const customerAPI = { getAll: getCustomers, create: createCustomer, update: updateCustomer, delete: deleteCustomer }

// ── SUPPLIERS ─────────────────────────────────────────────────
export const getSuppliers    = ()     => api.get('/suppliers')
export const createSupplier  = (d)    => api.post('/suppliers', d)
export const updateSupplier  = (id,d) => api.put(`/suppliers/${id}`, d)
export const deleteSupplier  = (id)   => api.delete(`/suppliers/${id}`)

export const supplierAPI = { getAll: getSuppliers, create: createSupplier, update: updateSupplier, delete: deleteSupplier }

// ── EXPENSES ──────────────────────────────────────────────────
export const getExpenses    = (p)    => api.get('/expenses', { params: p })
export const createExpense  = (d)    => api.post('/expenses', d)
export const updateExpense  = (id,d) => api.put(`/expenses/${id}`, d)
export const deleteExpense  = (id)   => api.delete(`/expenses/${id}`)

export const expenseAPI = { getAll: getExpenses, create: createExpense, update: updateExpense, delete: deleteExpense }

// ── STAFF ─────────────────────────────────────────────────────
export const getStaff       = ()      => api.get('/staff')
export const createStaff    = (d)     => api.post('/staff', d)
export const updateStaff    = (id,d)  => api.put(`/staff/${id}`, d)
export const deleteStaff    = (id)    => api.delete(`/staff/${id}`)
export const markAttendance = (id,d)  => api.post(`/staff/${id}/attendance`, d)

export const staffAPI = { getAll: getStaff, create: createStaff, update: updateStaff, delete: deleteStaff, attendance: markAttendance }

// ── SETTINGS ──────────────────────────────────────────────────
export const getSettings  = ()  => api.get('/settings')
export const saveSettings = (d) => api.put('/settings', d)

export const settingsAPI = { get: getSettings, update: saveSettings }

// ── CDN (Credit / Debit Notes) ────────────────────────────────
export const getNotes     = ()     => api.get('/cdn')
export const createNote   = (d)    => api.post('/cdn', d)
export const updateNote   = (id,d) => api.put(`/cdn/${id}`, d)
export const deleteNote   = (id)   => api.delete(`/cdn/${id}`)

export const cdnAPI = { getAll: getNotes, create: createNote, update: updateNote, delete: deleteNote }

// ── ACTIVITY LOGS ─────────────────────────────────────────────
export const getActivityLogs    = () => api.get('/activity')
export const createActivityLog  = (d) => api.post('/activity', d)
export const deleteActivityLogs = () => api.delete('/activity')

export const activityAPI = { getAll: getActivityLogs, create: createActivityLog, clear: deleteActivityLogs }

export default api
