import { useState, useEffect, useRef } from 'react'
import { getActiveFY, getFYLabel, isFYClosed, getStorageKey, isOwnerOrManager, getDefaultDateForFY, validateDateInFY, getFYRange } from '../utils/fy'
import { getInvoices, createInvoice, getPurchases, getNextPurNo, createPurchase, updatePurchase, deletePurchase, getProducts, createProduct, updateProduct, deleteProduct, getCustomers, createCustomer, updateCustomer, deleteCustomer, getSuppliers, createSupplier, updateSupplier, deleteSupplier, getExpenses, createExpense, updateExpense, deleteExpense, getStaff, createStaff, updateStaff, deleteStaff, markAttendance, getSettings, saveSettings, getNotes, createNote, updateNote, deleteNote } from '../api'
import FinancialYearManager from '../components/FinancialYearManager'

// ── Shared helpers ─────────────────────────────────────────────
function NumInput({ value, onChange, className, style, ...props }) {
  return <input {...props} type="number" className={className || 'form-input'} style={style}
    value={value} onFocus={e => e.target.select()} onBlur={e => { if (e.target.value === '') onChange(0) }}
    onChange={e => { const n = parseFloat(e.target.value); onChange(isNaN(n) ? 0 : n) }} />
}
const emptyItem = () => ({ id: Date.now() + Math.random(), name: '', hsn: '', qty: 0, unit: 'Nos', price: 0, discount: 0, gstRate: 18 })
const GST_RATES = [0, 5, 12, 18, 28]
const UNITS = ['Nos', 'Kg', 'Ltr', 'Mtr', 'Box', 'Pcs', 'Set', 'Pair']
const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal']
const ECATS = ['Rent', 'Salary', 'Electricity', 'Internet', 'Transport', 'Stationery', 'Maintenance', 'Marketing', 'Food', 'Miscellaneous']
const ICATS = ['Electronics', 'Clothing', 'Furniture', 'Accessories', 'Hardware', 'Stationery', 'Food & Beverage', 'General']
const ROLES = ['Owner', 'Manager', 'Accountant', 'Sales', 'Staff', 'Driver', 'Security', 'Peon']
const DEPTS = ['General', 'Sales', 'Finance', 'Warehouse', 'Marketing', 'Operations', 'HR']
const TODAY = new Date().toISOString().split('T')[0]
const ATT_LABELS = { P: 'Present', A: 'Absent', H: 'Half Day', HO: 'Holiday' }
const ATT_COLORS = { P: '#2E7D32', A: '#C62828', H: '#E65100', HO: '#1565C0' }
const ATT_BG = { P: '#E8F5E9', A: '#FFEBEE', H: '#FFF3E0', HO: '#E3F2FD' }

function calcItem(it) {
  const taxable = (it.qty || 0) * (it.price || 0) * (1 - (it.discount || 0) / 100)
  const gstAmt = taxable * ((it.gstRate || 0) / 100)
  return { taxable, gstAmt, total: taxable + gstAmt }
}
function calcTotals(form) {
  const items = (form.items || []).map(calcItem)
  const sub = items.reduce((s, i) => s + i.taxable, 0)
  const gst = items.reduce((s, i) => s + i.gstAmt, 0)
  const tr = parseFloat(form.transport || 0)
  const pre = sub + gst + tr
  const ro = Math.round(pre) - pre
  return { sub, gst, tr, ro, grand: pre + ro }
}
function amtWords(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function w(n) { if (n < 20) return a[n]; if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : ''); if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + w(n % 100) : ''); if (n < 100000) return w(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + w(n % 1000) : ''); if (n < 10000000) return w(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + w(n % 100000) : ''); return w(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + w(n % 10000000) : '') }
  const i = Math.floor(n), d = Math.round((n - i) * 100)
  return (w(i) || 'Zero') + ' Rupees' + (d ? ' and ' + w(d) + ' Paise' : '') + ' Only'
}
function getBiz() {
  const a = JSON.parse(localStorage.getItem('inv_biz') || '{}')
  const b = JSON.parse(localStorage.getItem('bizcloud_biz_profile') || '{}')
  // merge both keys — inv_biz takes priority, bizcloud_biz_profile as fallback
  return { ...b, ...a }
}
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || '[]') } catch { return [] } }
function lsSet(k, v) { localStorage.setItem(k, JSON.stringify(v)) }
function exportCSVFile(rows, filename) {
  const csv = rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); a.download = filename; a.click()
}
function exportPDFWindow(html, title) {
  const w = window.open('', '_blank')
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}table{width:100%;border-collapse:collapse;margin:10px 0}th{background:#1565C0;color:#fff;padding:8px;text-align:left}td{padding:7px;border-bottom:1px solid #eee}@page{margin:10mm}@media print{button{display:none}}</style></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`)
  w.document.close()
}

// ════════════════════════════════════════════════════════════════
// PURCHASE — localStorage based, no backend needed
// ════════════════════════════════════════════════════════════════
export function Purchase() {
  const [activeFY, setActiveFY] = useState(getActiveFY())
  useEffect(() => {
    const h = (e) => setActiveFY(e.detail.fy)
    window.addEventListener('fy_changed', h)
    return () => window.removeEventListener('fy_changed', h)
  }, [])
  const fyReadOnly = isFYClosed(activeFY)
  const [purchases, setPurchases] = useState([])
  const [products, setProductsLocal] = useState([])
  const [suppliers, setSuppliersLocal] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [active, setActive] = useState(null)
  const [search, setSearch] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [dateMode, setDateMode] = useState('')
  const [suppSugg, setSuppSugg] = useState([])
  const [prodSugg, setProdSugg] = useState({})
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ purchaseNo: '1', date: getDefaultDateForFY(activeFY), dueDate: '', paymentType: 'Cash', status: 'pending', suppSearch: '', supplier: null, items: [emptyItem()], transport: 0, stateOfSupply: 'Tamil Nadu', notes: '' })
  const ff = v => setForm(p => ({ ...p, ...v }))
  const fileRef = useRef()

  useEffect(() => { loadData() }, [activeFY])

  async function loadData() {
    setLoading(true)
    try {
      const [purRes, prodRes, suppRes] = await Promise.all([
        getPurchases().catch(() => ({ data: [] })),
        getProducts().catch(() => ({ data: [] })),
        getSuppliers().catch(() => ({ data: [] })),
      ])
      setPurchases(purRes.data || [])
      setProductsLocal(prodRes.data || [])
      setSuppliersLocal(suppRes.data || [])
    } catch (err) { console.error('Load error:', err) }
    setLoading(false)
  }

  async function fetchNextNo() {
    try { const { data } = await getNextPurNo(); return data.next || '1' }
    catch { return String((purchases.length ? Math.max(...purchases.map(p => parseInt(p.purchaseNo) || 0)) : 0) + 1) }
  }
  const today = new Date()
  function applyDateFilter(mode) {
    setDateMode(mode)
    if (mode === 'month') { const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'); setFilterFrom(`${y}-${m}-01`); setFilterTo(today.toISOString().split('T')[0]) }
    else if (mode === 'year') { const fy = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear(); setFilterFrom(`${fy}-04-01`); setFilterTo(`${fy + 1}-03-31`) }
  }
  const filtered = purchases.filter(p => {
    const ms = !search || p.purchaseNo.includes(search) || (p.supplier?.name || '').toLowerCase().includes(search.toLowerCase())
    return ms && (!filterFrom || p.date >= filterFrom) && (!filterTo || p.date <= filterTo)
  })
  const totalPur = filtered.reduce((s, p) => s + (p.grandTotal || 0), 0)

  async function openNew() {
    const no = await fetchNextNo()
    setForm({ purchaseNo: no, date: getDefaultDateForFY(activeFY), dueDate: '', paymentType: 'Cash', status: 'pending', suppSearch: '', supplier: null, items: [emptyItem()], transport: 0, stateOfSupply: 'Tamil Nadu', notes: '' })
    setEditId(null); setShowForm(true)
  }
  function openEdit(p) { setForm({ ...p, suppSearch: p.supplier?.name || '', items: p.items?.length ? p.items.map(it => ({ ...it, id: Date.now() + Math.random() })) : [emptyItem()] }); setEditId(p._id); setShowForm(true) }
  async function save() {
    if (fyReadOnly) { alert(`FY ${getFYLabel(activeFY)} is closed. Read-only mode.`); return }
    if (!validateDateInFY(form.date, activeFY)) { const r = getFYRange(activeFY); alert(`Date must be between ${r.from} and ${r.to} for FY ${getFYLabel(activeFY)}`); return }
    if (form.dueDate && !validateDateInFY(form.dueDate, activeFY)) { const r = getFYRange(activeFY); alert(`Due Date must be between ${r.from} and ${r.to} for FY ${getFYLabel(activeFY)}`); return }
    if (!form.suppSearch && !form.supplier) { alert('Enter supplier name'); return }
    if (form.items.filter(i => i.name).length === 0) { alert('Add at least one item'); return }
    const supplier = form.supplier || { name: form.suppSearch, mobile: '', gstin: '', address: '' }
    const items = form.items.filter(i => i.name).map(it => {
      const { id, ...rest } = it
      return { ...rest, amount: calcItem(it).total }
    })
    const { grand } = calcTotals({ ...form, items })
    const finalForm = { ...form, supplier, items, grandTotal: grand, suppSearch: supplier.name }
    try {
      // 1. Auto-Capture Supplier
      const existingSupp = suppliers.find(s => 
        s.name.trim().toLowerCase() === supplier.name.trim().toLowerCase() && 
        (s.mobile || '') === (supplier.mobile || '') && 
        (s.address || '') === (supplier.address || '')
      )
      if (!existingSupp) {
        await createSupplier({ ...supplier, fy: activeFY })
      }

      // 2. Auto-Capture Products & Sync Stock
      for (const it of items) {
        if (!it.name) continue
        const existingProd = products.find(p => p.name.trim().toLowerCase() === it.name.trim().toLowerCase())
        if (existingProd) {
          // Add stock for purchase
          await updateProduct(existingProd._id, { ...existingProd, stock: (existingProd.stock || 0) + (it.qty || 0) })
        } else {
          // Create new product
          await createProduct({ 
            name: it.name, hsn: it.hsn, unit: it.unit, price: it.price, gst: it.gstRate, 
            stock: it.qty || 0, addStock: 0, cost: it.price, cat: 'General', fy: activeFY 
          })
        }
      }

      if (editId) {
        const { data } = await updatePurchase(editId, finalForm)
        setActive(data)
      } else {
        const { data } = await createPurchase(finalForm)
        setActive(data)
      }
      await loadData()
      setShowForm(false); setMsg('✅ Purchase saved!'); setTimeout(() => setMsg(''), 3000)
    } catch (err) {
      alert(err.response?.data?.message || 'Save failed: ' + err.message)
    }
  }
  async function del(id) {
    if (fyReadOnly) { alert(`FY ${getFYLabel(activeFY)} is closed. Cannot delete.`); return }
    if (!confirm('Delete?')) return
    try {
      await deletePurchase(id)
      await loadData()
      if (active?._id === id) setActive(null)
      setMsg('🗑️ Deleted'); setTimeout(() => setMsg(''), 2000)
    } catch (err) { alert('Delete failed: ' + err.message) }
  }
  function updateItem(idx, key, val) { setForm(p => { const items = [...p.items]; items[idx] = { ...items[idx], [key]: val }; return { ...p, items } }) }
  function addItem() { setForm(p => ({ ...p, items: [...p.items, emptyItem()] })) }
  function removeItem(idx) { setForm(p => ({ ...p, items: p.items.length > 1 ? p.items.filter((_, i) => i !== idx) : [emptyItem()] })) }
  function searchProduct(idx, val) {
    updateItem(idx, 'name', val)
    const filtered = val.length > 0 ? products.filter(p => p.name.toLowerCase().includes(val.toLowerCase())).slice(0, 6) : []
    if (val.length > 0 && !filtered.find(p => p.name.toLowerCase() === val.toLowerCase())) {
      filtered.push({ _id: 'new', name: val, isNew: true })
    }
    setProdSugg(prev => ({ ...prev, [idx]: filtered }))
  }
  function selectProduct(idx, prod) {
    setForm(p => { 
      const items = [...p.items]; 
      if (prod.isNew) {
        items[idx] = { ...items[idx], name: prod.name }
      } else {
        items[idx] = { ...items[idx], name: prod.name, hsn: prod.hsn || '', price: prod.cost || prod.price || 0, gstRate: prod.gst || 18, unit: prod.unit || 'Nos' }
      }
      return { ...p, items } 
    })
    setProdSugg(prev => ({ ...prev, [idx]: [] }))
  }
  function onSuppSearch(v) {
    ff({ suppSearch: v, supplier: null })
    const filtered = v.length > 0 ? suppliers.filter(s => s.name.toLowerCase().includes(v.toLowerCase()) || (s.mobile || '').includes(v)).slice(0, 6) : []
    if (v.length > 0 && !filtered.find(s => s.name.toLowerCase() === v.toLowerCase())) {
      filtered.push({ _id: 'new', name: v, isNew: true })
    }
    setSuppSugg(filtered)
  }

  // Export functions
  function exportExcel() {
    const rows = [['Purchase No', 'Date', 'Supplier', 'Mobile', 'GSTIN', 'Payment', 'Status', 'Amount', 'GST']]
    filtered.forEach(p => {
      const { gst } = calcTotals(p)
      rows.push([p.purchaseNo, p.date, p.supplier?.name || '', p.supplier?.mobile || '', p.supplier?.gstin || '', p.paymentType, p.status, p.grandTotal || 0, gst.toFixed(2)])
    })
    exportCSVFile(rows, 'purchases.csv')
  }
  function exportPDF() {
    const biz = getBiz()
    const rows = filtered.map(p => `<tr><td>${p.purchaseNo}</td><td>${p.date}</td><td>${p.supplier?.name || ''}</td><td>${p.paymentType}</td><td>₹${(p.grandTotal || 0).toLocaleString()}</td><td>${p.status}</td></tr>`).join('')
    exportPDFWindow(`<h2>${biz.businessName || 'Invoxira Cloud'} — Purchase Report</h2><p>Total: ₹${totalPur.toLocaleString()} | ${filtered.length} records</p><table><thead><tr><th>Purchase#</th><th>Date</th><th>Supplier</th><th>Payment</th><th>Amount</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`, 'Purchase Report')
  }
  function importCSV(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const lines = evt.target.result.split('\n').filter(l => l.trim())
        const hdr = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
        const imported = lines.slice(1).map((line, i) => {
          const v = line.split(',').map(x => x.replace(/"/g, '').trim())
          const get = k => v[hdr.indexOf(k)] || ''
          return { id: Date.now() + i, purchaseNo: get('Purchase No') || String(purchases.length + i + 1), date: get('Date') || TODAY, supplier: { name: get('Supplier'), mobile: get('Mobile'), gstin: get('GSTIN'), address: '' }, paymentType: get('Payment') || 'Cash', status: get('Status') || 'pending', items: [emptyItem()], grandTotal: parseFloat(get('Amount')) || 0, transport: 0, notes: '' }
        }).filter(p => p.supplier?.name)
        setPurchases(prev => [...prev, ...imported])
        setMsg(`✅ ${imported.length} purchases imported!`); setTimeout(() => setMsg(''), 3000)
      } catch { setMsg('❌ Import failed'); setTimeout(() => setMsg(''), 3000) }
    }
    reader.readAsText(file); e.target.value = ''
  }

  const { sub, gst, tr, ro, grand } = calcTotals(form)

  // ── PRINT PURCHASE BILL ─────────────────────────────────
  function printPurchase(pur) {
    const biz = getBiz()
    const { sub, gst, tr, ro, grand } = calcTotals(pur)
    const logo = biz.logo || null
    const initial = (biz.businessName || 'I').split(' ').map(w => w[0]).join('').substring(0, 3).toUpperCase()
    const items = (pur.items || []).filter(it => it.name)
    const rows = items.map((it, i) => {
      const r = calcItem(it)
      return `<tr>
        <td style="text-align:center">${i + 1}</td>
        <td><b>${it.name}</b>${it.hsn ? `<br><span style="font-size:9px;color:#666">HSN: ${it.hsn}</span>` : ''}</td>
        <td style="text-align:center">${it.qty}</td>
        <td style="text-align:center">${it.unit}</td>
        <td style="text-align:right">₹ ${(it.price || 0).toFixed(2)}</td>
        <td style="text-align:center">${it.discount || 0}%</td>
        <td style="text-align:right">₹ ${r.gstAmt.toFixed(2)}<br><span style="font-size:9px">(${it.gstRate}%)</span></td>
        <td style="text-align:right"><b>₹ ${r.total.toFixed(2)}</b></td>
      </tr>`
    }).join('')
    const selectedThemeId = localStorage.getItem('inv_print_theme') || 'padmavathi'
    const THEMES = [
      { id: 'padmavathi', name: 'Sri Padmavathi Style', header: '#fff', headerText: '#000', accent: '#000', tableBg: '#f8f8f8' },
      { id: 'blue', name: 'Blue Professional', header: '#1565C0', headerText: '#fff', accent: '#1565C0', tableBg: '#E3F2FD' },
      { id: 'green', name: 'Green Eco', header: '#2E7D32', headerText: '#fff', accent: '#2E7D32', tableBg: '#E8F5E9' },
      { id: 'red', name: 'Royal Red', header: '#B71C1C', headerText: '#fff', accent: '#B71C1C', tableBg: '#FFEBEE' },
      { id: 'purple', name: 'Purple Elite', header: '#6A1B9A', headerText: '#fff', accent: '#6A1B9A', tableBg: '#F3E5F5' },
      { id: 'dark', name: 'Modern Dark', header: '#212121', headerText: '#FFD600', accent: '#FFD600', tableBg: '#424242' },
      { id: 'orange', name: 'Warm Sunset', header: '#E65100', headerText: '#fff', accent: '#E65100', tableBg: '#FFF3E0' },
      { id: 'teal', name: 'Teal Ocean', header: '#00695C', headerText: '#fff', accent: '#00695C', tableBg: '#E0F2F1' },
      { id: 'pink', name: 'Rose Gold', header: '#880E4F', headerText: '#fff', accent: '#880E4F', tableBg: '#FCE4EC' },
      { id: 'minimal', name: 'Minimal Clean', header: '#fff', headerText: '#212121', accent: '#212121', tableBg: '#fff' }
    ]
    const th = THEMES.find(t => t.id === selectedThemeId) || THEMES[0]

    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>Purchase Bill #${pur.purchaseNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#333;padding:14px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;margin-bottom:6px;border-bottom:2px solid ${th.accent === '#fff' ? '#ccc' : th.accent}}
  .co-name{font-size:17px;font-weight:bold;margin-bottom:3px;color:${th.header === '#fff' ? '#333' : th.header}}
  .co-info{font-size:10px;line-height:1.6}
  .top-right{text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px}
  .logo-circle{width:55px;height:55px;border:2px solid ${th.accent};border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;color:${th.accent}}
  .bill-title{text-align:center;font-size:16px;font-weight:bold;color:${th.header === '#fff' ? '#333' : th.header};padding:6px 0;border-bottom:1px solid #E0E0E0;margin-bottom:8px}
  .info-grid{display:grid;grid-template-columns:1.5fr 1fr 1fr;border:1px solid #ccc;margin-bottom:10px}
  .info-col{padding:8px 10px;border-right:1px solid #ccc}
  .info-col:last-child{border-right:none}
  .info-label{font-size:9px;font-weight:bold;text-transform:uppercase;color:#555;margin-bottom:4px}
  .info-val{font-size:11px;line-height:1.5}
  table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px}
  table thead tr{background:${th.header};color:${th.headerText}}
  table th{padding:7px 8px;text-align:left;font-weight:600}
  table td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:middle}
  table tbody tr:nth-child(even){background:${th.tableBg}}
  .total-row{background:#f5f5f5!important;font-weight:bold}
  .bottom-section{display:flex;justify-content:space-between;gap:16px;margin-bottom:12px}
  .words-box{flex:1}
  .words-label{font-weight:bold;font-size:10px;margin-bottom:3px}
  .words-val{font-style:italic;color:#333;font-size:10px}
  .summary-table{width:280px;border:1px solid #ccc;border-radius:2px}
  .summary-table td{padding:5px 10px;border-bottom:1px solid #eee;font-size:11px;color:#333}
  .summary-table td:last-child{text-align:right;font-weight:600}
  .summary-total{background:${th.header}!important;color:${th.headerText}!important}
  .summary-total td{color:${th.headerText}!important;font-size:13px!important;font-weight:bold!important}
  .footer{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding-top:10px;border-top:1px solid #ccc;margin-top:8px}
  .bank-box{font-size:10px;line-height:1.7}
  .sign-box{text-align:right;font-size:10px}
  .sign-line{border-bottom:1px solid #333;width:160px;margin:30px 0 4px auto}
  @page{margin:10mm}
  @media print{button{display:none}}
</style></head><body>

<!-- HEADER -->
<div class="header">
  <div>
    ${logo ? `<img src="${logo}" style="height:45px;margin-bottom:6px"><br>` : `<div class="co-name">${biz.businessName || 'Invoxira Cloud'}</div>`}
    ${logo ? `<div class="co-name" style="font-size:14px">${biz.businessName || 'Invoxira Cloud'}</div>` : ''}
    <div class="co-info">
      ${biz.address ? `${biz.address}` : ''}${biz.city ? `, ${biz.city}` : ''}${biz.state ? `, ${biz.state}` : ''}<br>
      ${biz.mobile ? `Phone: ${biz.mobile}` : ''}${biz.email ? `&nbsp;&nbsp;Email: ${biz.email}` : ''}<br>
      ${biz.gstin ? `GSTIN: ${biz.gstin}` : ''}
    </div>
  </div>
  <div class="top-right">
  </div>
</div>

<!-- TITLE -->
<div class="bill-title">Purchase Bill</div>

<!-- INFO GRID -->
<div class="info-grid">
  <div class="info-col">
    <div class="info-label">Supplier</div>
    <div class="info-val">
      <b>${pur.supplier?.name || '—'}</b><br>
      ${pur.supplier?.address || ''}<br>
      ${pur.supplier?.mobile ? `Phone: ${pur.supplier.mobile}` : ''}<br>
      ${pur.supplier?.gstin ? `GSTIN: ${pur.supplier.gstin}` : ''}
    </div>
  </div>
  <div class="info-col">
    <div class="info-label">Purchase Details</div>
    <div class="info-val">
      Bill No.: <b>${pur.purchaseNo}</b><br>
      Date: ${pur.date}<br>
      Payment: ${pur.paymentType}<br>
      Status: ${(pur.status || 'pending').toUpperCase()}
    </div>
  </div>
  <div class="info-col">
    <div class="info-label">State of Supply</div>
    <div class="info-val">
      ${pur.stateOfSupply || biz.state || 'Tamil Nadu'}
    </div>
  </div>
</div>

<!-- ITEMS TABLE -->
<table>
  <thead><tr>
    <th style="width:30px;text-align:center">#</th>
    <th>Item Name</th>
    <th style="text-align:center">Qty</th>
    <th style="text-align:center">Unit</th>
    <th style="text-align:right">Rate</th>
    <th style="text-align:center">Disc%</th>
    <th style="text-align:right">GST</th>
    <th style="text-align:right">Amount</th>
  </tr></thead>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td colspan="2"><b>Total</b></td>
      <td style="text-align:center">${items.reduce((s, it) => s + (it.qty || 0), 0)}</td>
      <td></td><td></td><td></td>
      <td style="text-align:right"><b>₹ ${gst.toFixed(2)}</b></td>
      <td style="text-align:right"><b>₹ ${(sub + gst).toFixed(2)}</b></td>
    </tr>
  </tbody>
</table>

<!-- BOTTOM SECTION -->
<div class="bottom-section">
  <div class="words-box">
    <div class="words-label">Amount In Words</div>
    <div class="words-val">${amtWords(grand)}</div>
    ${pur.notes ? `<div style="margin-top:8px;font-size:10px;color:#555"><b>Notes:</b> ${pur.notes}</div>` : ''}
  </div>
  <table class="summary-table">
    <tbody>
      <tr><td>Sub Total</td><td>₹ ${sub.toFixed(2)}</td></tr>
      <tr><td>SGST</td><td>₹ ${(gst / 2).toFixed(2)}</td></tr>
      <tr><td>CGST</td><td>₹ ${(gst / 2).toFixed(2)}</td></tr>
      ${tr > 0 ? `<tr><td>Transport</td><td>₹ ${tr.toFixed(2)}</td></tr>` : ''}
      ${ro !== 0 ? `<tr><td>Round Off</td><td>${ro >= 0 ? '+' : ''}₹ ${Math.abs(ro).toFixed(2)}</td></tr>` : ''}
      <tr class="summary-total"><td><b>Grand Total</b></td><td><b>₹ ${grand.toFixed(2)}</b></td></tr>
    </tbody>
  </table>
</div>

<!-- FOOTER -->
<div class="footer">
  <div class="bank-box">
    <b>Bank Details:</b><br>
    ${biz.bankName ? `Bank Name: ${biz.bankName}` : ''}${biz.city ? `, ${biz.city}` : ''}<br>
    ${biz.accountNo ? `Account No.: ${biz.accountNo}<br>` : ''}
    ${biz.ifsc ? `IFSC Code: ${biz.ifsc}<br>` : ''}
    ${biz.ownerName ? `Account Holder: ${biz.ownerName}` : ''}
    ${biz.upi ? `<br>UPI: ${biz.upi}` : ''}
  </div>
  <div class="sign-box">
    <div>For: ${biz.businessName || 'Invoxira Cloud'}</div>
    <div class="sign-line"></div>
    <b>Authorized Signatory</b>
  </div>
</div>

<script>window.onload=()=>window.print()<\/script>
</body></html>`)
    w.document.close()
  }

  if (!showForm) return (
    <div className="page-wrap">
      {msg && <div style={{ padding: '8px 14px', background: msg.startsWith('✅') ? '#E8F5E9' : '#FFEBEE', color: msg.startsWith('✅') ? '#2E7D32' : '#C62828', borderRadius: 4, marginBottom: 12, fontWeight: 600, fontSize: 13 }}>{msg}</div>}
      {fyReadOnly && <div style={{ padding: '8px 14px', background: '#FFF3E0', color: '#E65100', borderRadius: 4, marginBottom: 12, fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>🔒 FY {getFYLabel(activeFY)} is closed. View &amp; export only.</div>}
      <div className="page-head">
        <div><div className="page-title">Purchase</div><div className="page-subtitle">{purchases.length} purchases</div></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className={`filter-btn${dateMode === 'month' ? ' active' : ''}`} onClick={() => applyDateFilter('month')}>This Month</button>
          <button className={`filter-btn${dateMode === 'year' ? ' active' : ''}`} onClick={() => applyDateFilter('year')}>This Year</button>
          <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setDateMode('') }} style={{ padding: '5px 8px', border: '1px solid #BDBDBD', borderRadius: 4, fontSize: 12 }} />
          <span style={{ alignSelf: 'center', fontSize: 12, color: '#757575' }}>to</span>
          <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setDateMode('') }} style={{ padding: '5px 8px', border: '1px solid #BDBDBD', borderRadius: 4, fontSize: 12 }} />
          {(filterFrom || filterTo) && <button className="btn btn-gray btn-sm" onClick={() => { setFilterFrom(''); setFilterTo(''); setDateMode('') }}>✕</button>}
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={importCSV} />
          <button className="btn btn-gray btn-sm" onClick={() => fileRef.current.click()}>📥 Import CSV</button>
          <button className="btn btn-gray btn-sm" onClick={exportExcel}>📊 Export Excel</button>
          <button className="btn btn-gray btn-sm" onClick={exportPDF}>📄 Export PDF</button>
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ New Purchase</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 14 }}>
        {[['Total Purchase', `₹${totalPur.toLocaleString()}`, '#E65100', '#FFF3E0'], ['Count', filtered.length, '#1565C0', '#E3F2FD'], ['This Month', `₹${filtered.filter(p => p.date?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, p) => s + (p.grandTotal || 0), 0).toLocaleString()}`, '#6A1B9A', '#F3E5F5'], ['Paid', `₹${filtered.filter(p => p.status === 'paid').reduce((s, p) => s + (p.grandTotal || 0), 0).toLocaleString()}`, '#2E7D32', '#E8F5E9'], ['Pending', `₹${filtered.filter(p => p.status !== 'paid').reduce((s, p) => s + (p.grandTotal || 0), 0).toLocaleString()}`, '#C62828', '#FFEBEE']].map(([l, v, c, bg]) => (
          <div key={l} style={{ background: bg, borderRadius: 6, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: c, fontWeight: 600 }}>{l}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: c }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="filter-bar">
        <div className="search-wrap"><span className="search-icon">🔍</span><input placeholder="Search purchase, supplier..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: active ? '1fr 340px' : '1fr', gap: 12 }}>
        <div className="card">
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Purchase No</th><th>Date</th><th>Supplier</th><th>Payment</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#9E9E9E' }}><div style={{ fontSize: 32 }}>🛒</div><div>No purchases found</div></td></tr>
                  : filtered.map(p => (
                    <tr key={p._id} style={{ cursor: 'pointer', background: active?._id === p._id ? '#E3F2FD' : '' }} onClick={() => setActive(active?._id === p._id ? null : p)}>
                      <td style={{ fontWeight: 700, color: '#1565C0' }}>#{p.purchaseNo}</td>
                      <td style={{ color: '#757575' }}>{p.date}</td>
                      <td><div style={{ fontWeight: 600 }}>{p.supplier?.name || '—'}</div><div style={{ fontSize: 11, color: '#9E9E9E' }}>{p.supplier?.mobile || ''}</div></td>
                      <td><span className="badge badge-blue">{p.paymentType}</span></td>
                      <td style={{ fontWeight: 700 }}>₹{(p.grandTotal || 0).toLocaleString()}</td>
                      <td><span className={`badge badge-${p.status === 'paid' ? 'green' : p.status === 'overdue' ? 'red' : 'orange'}`}>{(p.status || '').toUpperCase()}</span></td>
                      <td onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm btn-outline" onClick={() => { setActive(p); printPurchase(p) }} title="Print">🖨️</button>
                          <button className="btn btn-sm btn-outline" onClick={() => openEdit(p)}>✏️</button>
                          <button className="btn btn-sm btn-danger" onClick={() => del(p._id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
        {active && (
          <div className="card" style={{ padding: 16, height: 'fit-content', position: 'sticky', top: 60 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Purchase #{active.purchaseNo}</div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button className="btn btn-xs btn-outline" onClick={() => printPurchase(active)}>🖨️</button>
                <button className="btn btn-xs btn-primary" onClick={() => openEdit(active)}>✏️</button>
                <button className="btn btn-xs btn-gray" onClick={() => setActive(null)}>✕</button>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{active.supplier?.name}</div>
              <div style={{ fontSize: 11, color: '#757575' }}>{active.date} · {active.paymentType}</div>
            </div>
            <table style={{ fontSize: 12, marginBottom: 10 }}>
              <thead><tr><th>Item</th><th>Qty</th><th>Total</th></tr></thead>
              <tbody>{(active.items || []).filter(it => it.name).map((it, i) => { const r = calcItem(it); return <tr key={i}><td>{it.name}</td><td>{it.qty}</td><td style={{ fontWeight: 600 }}>₹{r.total.toFixed(0)}</td></tr> })}</tbody>
            </table>
            <div style={{ borderTop: '1px solid #EEE', paddingTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}><span>Grand Total</span><b style={{ color: '#1565C0', fontSize: 16 }}>₹{(active.grandTotal || 0).toLocaleString()}</b></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="page-wrap">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, position: 'sticky', top: 0, background: '#F5F5F5', zIndex: 10, padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-gray btn-sm" onClick={() => setShowForm(false)}>← Back</button>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{editId ? 'Edit Purchase' : 'New Purchase'}</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={save}>💾 Save Purchase</button>
      </div>
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Purchase No</label><input className="form-input" value={form.purchaseNo} onChange={e => ff({ purchaseNo: e.target.value })} style={{ fontWeight: 700 }} /></div>
          <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.date} onChange={e => ff({ date: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Payment Type</label><select className="form-select" value={form.paymentType} onChange={e => ff({ paymentType: e.target.value })}>{['Cash', 'Credit', 'UPI', 'Cheque', 'Bank Transfer'].map(p => <option key={p}>{p}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={form.status} onChange={e => ff({ status: e.target.value })}>{['paid', 'pending', 'overdue'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}</select></div>
        </div>
      </div>
      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#1565C0' }}>🏭 Supplier Details</div>
        <div className="form-grid">
          <div className="form-group col-2" style={{ position: 'relative' }}>
            <label className="form-label">Supplier Name *</label>
            <input className="form-input" placeholder="Search or enter supplier..." value={form.suppSearch} onChange={e => onSuppSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && form.suppSearch && !form.supplier) { ff({ supplier: { name: form.suppSearch, mobile: '', gstin: '', address: '' } }); setSuppSugg([]) } }}
              onBlur={() => setTimeout(() => { if (form.suppSearch && !form.supplier) ff({ supplier: { name: form.suppSearch, mobile: '', gstin: '', address: '' } }); setSuppSugg([]) }, 200)} />
            {suppSugg.length > 0 && <div className="autocomplete">{suppSugg.map((s, i) => (
              <div key={i} className="autocomplete-item" onMouseDown={() => { 
                if (s.isNew) {
                  ff({ supplier: { name: s.name, mobile: '', gstin: '', address: '' }, suppSearch: s.name })
                } else {
                  ff({ supplier: s, suppSearch: s.name })
                }
                setSuppSugg([]) 
              }}>
                {s.isNew ? (
                  <div className="ac-name" style={{ color: '#1565C0', fontWeight: 600 }}>+ Add "{s.name}" as New Supplier</div>
                ) : (
                  <>
                    <div className="ac-name">{s.name}</div>
                    <div className="ac-sub">{s.mobile}</div>
                  </>
                )}
              </div>
            ))}</div>}
          </div>
          <div className="form-group"><label className="form-label">Mobile</label><input className="form-input" value={form.supplier?.mobile || ''} onChange={e => ff({ supplier: { ...form.supplier || { name: form.suppSearch }, mobile: e.target.value } })} /></div>
          <div className="form-group"><label className="form-label">GSTIN</label><input className="form-input" value={form.supplier?.gstin || ''} onChange={e => ff({ supplier: { ...form.supplier || { name: form.suppSearch }, gstin: e.target.value.toUpperCase() } })} /></div>
          <div className="form-group col-2"><label className="form-label">Address</label><input className="form-input" value={form.supplier?.address || ''} onChange={e => ff({ supplier: { ...form.supplier || { name: form.suppSearch }, address: e.target.value } })} /></div>
        </div>
      </div>
      <div className="card" style={{ padding: 16, marginBottom: 12, overflow: 'visible' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: '#1565C0' }}>📦 Items</div>
        <div style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 100 }}>
          <table style={{ minWidth: 700, borderCollapse: 'collapse' }}>
            <thead><tr><th>#</th><th style={{ minWidth: 180 }}>Item</th><th>HSN</th><th>Qty</th><th>Unit</th><th>Rate(₹)</th><th>Disc%</th><th>GST%</th><th>Amount</th><th></th></tr></thead>
            <tbody>
              {form.items.map((item, idx) => {
                const r = calcItem(item)
                return (
                  <tr key={item.id} style={{ position: 'relative', zIndex: form.items.length - idx + 10, borderBottom: '1px solid #F5F5F5' }}>
                    <td style={{ color: '#9E9E9E', textAlign: 'center', padding: '4px 6px' }}>{idx + 1}</td>
                    <td style={{ position: 'relative', overflow: 'visible', padding: '4px 6px' }}>
                      <input className="form-input" style={{ fontSize: 12 }} placeholder="Search product..." value={item.name} onChange={e => searchProduct(idx, e.target.value)}
                        onBlur={() => setTimeout(() => setProdSugg(p => ({ ...p, [idx]: [] })), 200)} />
                      {(prodSugg[idx] || []).length > 0 && <div className="autocomplete" style={{ minWidth: 260 }}>{prodSugg[idx].map((p, i) => (
                        <div key={i} className="autocomplete-item" onMouseDown={() => selectProduct(idx, p)}>
                          {p.isNew ? (
                            <div className="ac-name" style={{ color: '#1565C0', fontWeight: 600 }}>+ Add "{p.name}" as New Product</div>
                          ) : (
                            <>
                              <div className="ac-name">{p.name}</div>
                              <div className="ac-sub">HSN:{p.hsn} · Cost:₹{p.cost || p.price} · GST:{p.gst}%</div>
                            </>
                          )}
                        </div>
                      ))}</div>}
                    </td>
                    <td style={{ padding: '4px 6px' }}><input className="form-input" style={{ fontSize: 11 }} value={item.hsn} onChange={e => updateItem(idx, 'hsn', e.target.value)} /></td>
                    <td style={{ padding: '4px 6px' }}><NumInput value={item.qty} onChange={v => updateItem(idx, 'qty', v)} min="0" className="form-input" style={{ width: '100%' }} /></td>
                    <td style={{ padding: '4px 6px' }}><select className="form-select" style={{ fontSize: 12 }} value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></td>
                    <td style={{ padding: '4px 6px' }}><NumInput value={item.price} onChange={v => updateItem(idx, 'price', v)} min="0" className="form-input" style={{ width: '100%' }} /></td>
                    <td style={{ padding: '4px 6px' }}><NumInput value={item.discount} onChange={v => updateItem(idx, 'discount', v)} min="0" max="100" className="form-input" style={{ width: '100%' }} /></td>
                    <td style={{ padding: '4px 6px' }}><select className="form-select" style={{ fontSize: 12 }} value={item.gstRate} onChange={e => updateItem(idx, 'gstRate', parseFloat(e.target.value))}>{GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}</select></td>
                    <td style={{ fontWeight: 700, color: '#1565C0', padding: '4px 6px' }}>₹{r.total.toFixed(2)}</td>
                    <td style={{ padding: '4px 6px' }}><button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C62828', fontSize: 16 }} onClick={() => removeItem(idx)}>✕</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <button className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={addItem}>+ Add Item</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        <div>
          <div className="form-group"><label className="form-label">Notes</label><textarea style={{ width: '100%', padding: '8px 10px', border: '1px solid #E0E0E0', borderRadius: 4, fontSize: 13, minHeight: 80, resize: 'vertical' }} value={form.notes} onChange={e => ff({ notes: e.target.value })} placeholder="Notes..." /></div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          {[['Taxable', `₹${sub.toFixed(2)}`], ['SGST', `₹${(gst / 2).toFixed(2)}`], ['CGST', `₹${(gst / 2).toFixed(2)}`]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}><span style={{ color: '#757575' }}>{l}</span><span>{v}</span></div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ color: '#757575', fontSize: 13 }}>Transport</span>
            <NumInput value={form.transport} onChange={v => ff({ transport: v })} style={{ width: 90, padding: '4px 8px', border: '1px solid #E0E0E0', borderRadius: 4, fontSize: 12, textAlign: 'right' }} className="" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}><span style={{ color: '#757575' }}>Round Off</span><span>{ro >= 0 ? '+' : ''}{ro.toFixed(2)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #E0E0E0', paddingTop: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Grand Total</span>
            <span style={{ fontWeight: 800, fontSize: 18, color: '#1565C0' }}>₹{grand.toFixed(2)}</span>
          </div>
          <button style={{ width: '100%', marginTop: 12, padding: '10px', background: '#1565C0', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 700, cursor: 'pointer' }} onClick={save}>💾 Save Purchase</button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// INVENTORY — localStorage based
// ════════════════════════════════════════════════════════════════
const emptyProd = { name: '', sku: '', cat: 'General', hsn: '', unit: 'Nos', stock: 0, addStock: 0, min: 5, price: 0, cost: 0, gst: 18, bar: '' }

export function Inventory() {
  const activeFYInv = getActiveFY()
  const fyROInv = isFYClosed(activeFYInv)
  const [products, setProducts] = useState([])
  const [loading, setLoadingInv] = useState(true)
  useEffect(() => { loadProducts() }, [])
  async function loadProducts() {
    setLoadingInv(true)
    try { const { data } = await getProducts(); setProducts(data || []) }
    catch (err) { console.error('Load products error:', err) }
    setLoadingInv(false)
  }
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [view, setView] = useState('table')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyProd)
  const [selected, setSelected] = useState([])
  const [msg, setMsg] = useState('')
  const [customCats, setCustomCats] = useState([])
  const [allCats, setAllCats] = useState(ICATS)
  
  useEffect(() => {
    getSettings().then(res => {
      if (res.data?.inventoryCategories) {
        setAllCats(res.data.inventoryCategories)
      }
    })
  }, [])

  const fileRef = useRef()

  const filtered = products.filter(p => {
    const ms = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.includes(search)
    const mc = !filterCat || p.cat === filterCat
    const ml = !lowOnly || (p.stock + (p.addStock || 0)) <= p.min
    return ms && mc && ml
  })
  const lowCount = products.filter(p => (p.stock + (p.addStock || 0)) <= p.min).length
  const totalVal = products.reduce((s, p) => s + (p.stock + (p.addStock || 0)) * p.cost, 0)

  function openAdd() { setForm({ ...emptyProd, sku: `SKU${String(products.length + 1).padStart(3, '0')}` }); setEditId(null); setShowModal(true) }
  function openEdit(p) { setForm({ ...p }); setEditId(p._id); setShowModal(true) }
  async function save() {
    if (fyROInv) { alert(`FY ${getFYLabel(activeFYInv)} is closed. Read-only.`); return }
    if (!form.name) { alert('Name required'); return }
    try {
      if (editId) await updateProduct(editId, form)
      else await createProduct(form)
      await loadProducts()
      setShowModal(false)
    } catch (err) { alert('Save failed: ' + (err.response?.data?.message || err.message)) }
  }
  async function del(id) {
    if (fyROInv) { alert(`FY ${getFYLabel(activeFYInv)} is closed. Cannot delete.`); return }
    if (confirm('Delete?')) {
      try { await deleteProduct(id); await loadProducts() }
      catch (err) { alert('Delete failed: ' + err.message) }
    }
  }
  async function bulkDelete() {
    if (selected.length && confirm(`Delete ${selected.length} items?`)) {
      try {
        await Promise.all(selected.map(id => deleteProduct(id)))
        await loadProducts()
        setSelected([])
      } catch (err) { alert('Bulk delete failed: ' + err.message) }
    }
  }
  function toggleSelect(id) { setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }

  function importCSV(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const lines = evt.target.result.split('\n').filter(l => l.trim())
        const hdr = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
        const get = (v, k) => v[hdr.indexOf(k)]?.replace(/"/g, '').trim() || ''
        const imported = lines.slice(1).map((line, i) => {
          const v = line.split(',')
          return { id: Date.now() + i, name: get(v, 'Name'), sku: get(v, 'SKU'), cat: get(v, 'Category') || 'General', hsn: get(v, 'HSN'), unit: get(v, 'Unit') || 'Nos', stock: parseFloat(get(v, 'OpeningStock') || get(v, 'Stock')) || 0, addStock: parseFloat(get(v, 'AddStock')) || 0, min: parseFloat(get(v, 'MinStock')) || 5, price: parseFloat(get(v, 'SalePrice')) || 0, cost: parseFloat(get(v, 'CostPrice')) || 0, gst: parseFloat(get(v, 'GSTPercent')) || 18, bar: get(v, 'Barcode') }
        }).filter(p => p.name)
        setProducts(prev => [...prev, ...imported])
        setMsg(`✅ ${imported.length} products imported!`); setTimeout(() => setMsg(''), 3000)
      } catch { setMsg('❌ Import failed'); setTimeout(() => setMsg(''), 3000) }
    }
    reader.readAsText(file); e.target.value = ''
  }
  function exportCSVFn() {
    exportCSVFile([['Name', 'SKU', 'Category', 'HSN', 'Unit', 'OpeningStock', 'AddStock', 'MinStock', 'CostPrice', 'SalePrice', 'GSTPercent', 'Barcode'], ...products.map(p => [p.name, p.sku || '', p.cat, p.hsn || '', p.unit, p.stock, p.addStock || 0, p.min, p.cost, p.price, p.gst, p.bar || ''])], 'inventory.csv')
  }
  function exportPDFfn() {
    const rows = products.map(p => { const total = p.stock + (p.addStock || 0); return `<tr><td>${p.name}</td><td>${p.sku || ''}</td><td>${p.cat}</td><td>${p.stock}</td><td>${p.addStock || 0}</td><td>${total} ${p.unit}</td><td>${p.min}</td><td>₹${p.price.toLocaleString()}</td><td style="color:${total === 0 ? 'red' : total <= p.min ? 'orange' : 'green'}">${total === 0 ? 'Out' : total <= p.min ? 'Low' : 'OK'}</td></tr>` }).join('')
    exportPDFWindow(`<h2>Inventory Report</h2><p>Total Products: ${products.length} | Low Stock: ${lowCount} | Total Value: ₹${totalVal.toLocaleString()}</p><table><thead><tr><th>Name</th><th>SKU</th><th>Category</th><th>Opening</th><th>Add</th><th>Total</th><th>Min</th><th>Sale Price</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`, 'Inventory Report')
  }

  const stockBadge = p => { const total = p.stock + (p.addStock || 0); return total === 0 ? <span className="badge badge-red">Out of Stock</span> : total <= p.min ? <span className="badge badge-orange">Low Stock</span> : <span className="badge badge-green">In Stock</span> }

  return (
    <div className="page-wrap">
      {msg && <div style={{ padding: '8px 14px', background: msg.startsWith('✅') ? '#E8F5E9' : '#FFEBEE', color: msg.startsWith('✅') ? '#2E7D32' : '#C62828', borderRadius: 4, marginBottom: 12, fontWeight: 600, fontSize: 13 }}>{msg}</div>}
      <div className="page-head">
        <div><div className="page-title">Inventory</div><div className="page-subtitle">Manage products & stock</div></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={importCSV} />
          <button className="btn btn-gray btn-sm" onClick={() => fileRef.current.click()}>📥 Import CSV</button>
          <button className="btn btn-gray btn-sm" onClick={exportCSVFn}>📊 Export CSV</button>
          <button className="btn btn-gray btn-sm" onClick={exportPDFfn}>📄 Export PDF</button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Product</button>
        </div>
      </div>
      <div className="stat-row" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {[['📦', 'Total Products', products.length, '#1565C0', '#E3F2FD'], ['📊', 'Total Stock', products.reduce((s, p) => s + p.stock + (p.addStock || 0), 0).toLocaleString(), '#6A1B9A', '#F3E5F5'], ['💰', 'Inventory Value', '₹' + (totalVal / 100000).toFixed(1) + 'L', '#2E7D32', '#E8F5E9'], ['⚠️', 'Low Stock', lowCount, '#C62828', '#FFEBEE']].map(([icon, label, val, color, bg]) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: bg, fontSize: 22 }}>{icon}</div>
            <div><div className="stat-val" style={{ color }}>{val}</div><div className="stat-label">{label}</div></div>
          </div>
        ))}
      </div>
      <div className="filter-bar">
        <div className="search-wrap"><span className="search-icon">🔍</span><input placeholder="Search name, SKU..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="form-select" style={{ width: 160 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}><option value="">All Categories</option>{allCats.map(c => <option key={c}>{c}</option>)}</select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}><input type="checkbox" checked={lowOnly} onChange={e => setLowOnly(e.target.checked)} /> Low Stock Only</label>
        {selected.length > 0 && <button className="btn btn-danger btn-sm" onClick={bulkDelete}>🗑️ Delete ({selected.length})</button>}
        <div className="toggle-group" style={{ marginLeft: 'auto' }}>
          <button className={`toggle-btn ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>☰ Table</button>
          <button className={`toggle-btn ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>⊞ Grid</button>
        </div>
      </div>
      {view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 12 }}>
          {filtered.map(p => (
            <div key={p._id || p.id} className="card" style={{ padding: 14, border: selected.includes(p._id || p.id) ? '2px solid #1976D2' : '1px solid #E0E0E0', cursor: 'pointer' }} onClick={() => toggleSelect(p._id || p.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, background: '#E3F2FD', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📦</div>
                {stockBadge(p)}
              </div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
              <div style={{ fontSize: 11, color: '#757575', marginBottom: 8 }}>{p.sku} · {p.cat}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>Total: <b style={{ color: (p.stock + (p.addStock || 0)) <= p.min ? '#C62828' : '#2E7D32' }}>{p.stock + (p.addStock || 0)}</b></span>
                <span style={{ color: '#1565C0', fontWeight: 700 }}>₹{p.price.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }} onClick={e => e.stopPropagation()}>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => openEdit(p)}>✏️ Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => del(p._id || p.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="tbl-wrap">
            <table>
              <thead><tr>
                <th style={{ width: 36 }}><input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={() => setSelected(selected.length === filtered.length ? [] : filtered.map(p => p._id || p.id))} /></th>
                <th>Product</th><th>SKU</th><th>Category</th><th>Opening</th><th>Added</th><th>Total</th><th>Cost</th><th>Sale Price</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 ? <tr><td colSpan={11}><div className="empty-state"><div className="icon">📦</div><p>No products found</p></div></td></tr>
                  : filtered.map(p => (
                    <tr key={p._id || p.id} style={{ background: selected.includes(p._id || p.id) ? '#E3F2FD' : (p.stock + (p.addStock || 0)) <= p.min ? '#FFF8E1' : '' }}>
                      <td><input type="checkbox" checked={selected.includes(p._id || p.id)} onChange={() => toggleSelect(p._id || p.id)} /></td>
                      <td><div style={{ fontWeight: 600 }}>{p.name}</div><div style={{ fontSize: 10, color: '#9E9E9E' }}>{p.bar}</div></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#1565C0', fontWeight: 600 }}>{p.sku}</td>
                      <td><span className="badge badge-blue">{p.cat}</span></td>
                      <td style={{ fontWeight: 600, color: '#757575' }}>{p.stock}</td>
                      <td style={{ fontWeight: 600, color: '#1565C0' }}>{(p.addStock || 0)}</td>
                      <td><span style={{ fontWeight: 700, color: (p.stock + (p.addStock || 0)) === 0 ? '#C62828' : (p.stock + (p.addStock || 0)) <= p.min ? '#E65100' : '#2E7D32' }}>{p.stock + (p.addStock || 0)}</span> <span style={{ color: '#9E9E9E', fontSize: 11 }}>{p.unit}</span><div style={{ fontSize: 10, color: '#BDBDBD' }}>Min:{p.min}</div></td>
                      <td>₹{p.cost.toLocaleString()}</td>
                      <td style={{ fontWeight: 700, color: '#1565C0' }}>₹{p.price.toLocaleString()}</td>
                      <td>{stockBadge(p)}</td>
                      <td><div style={{ display: 'flex', gap: 4 }}><button className="btn btn-sm btn-outline" onClick={() => openEdit(p)}>✏️</button><button className="btn btn-sm btn-danger" onClick={() => del(p._id || p.id)}>🗑️</button></div></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '8px 14px', fontSize: 12, color: '#9E9E9E', borderTop: '1px solid #F5F5F5' }}>Showing {filtered.length} of {products.length} products</div>
        </div>
      )}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header"><div className="modal-title">{editId ? '✏️ Edit Product' : '+ Add Product'}</div><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group col-2"><label className="form-label">Product Name *</label><input className="form-input" value={form.name} onChange={e => ff({ name: e.target.value })} placeholder="Enter product name" /></div>
                <div className="form-group"><label className="form-label">SKU</label><input className="form-input" value={form.sku} onChange={e => ff({ sku: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Category</label>
                  <select className="form-select" value={form.cat} onChange={e => ff({ cat: e.target.value })}>
                    {allCats.map(c => <option key={c}>{c}</option>)}
                    <option value="__new__">+ Add New Category</option>
                  </select>
                  {form.cat === '__new__' && <input className="form-input" style={{ marginTop: 6 }} placeholder="New category name" onBlur={async e => { if (e.target.value) { 
                    const newCats = [...allCats, e.target.value]; 
                    setAllCats(newCats); 
                    ff({ cat: e.target.value });
                    try { await saveSettings({ inventoryCategories: newCats }) } catch(err){ console.error(err) }
                  } else ff({ cat: 'General' }) }} autoFocus />}
                </div>
                <div className="form-group"><label className="form-label">HSN Code</label><input className="form-input" value={form.hsn} onChange={e => ff({ hsn: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Unit</label><select className="form-select" value={form.unit} onChange={e => ff({ unit: e.target.value })}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Opening Stock</label><NumInput value={form.stock} onChange={v => ff({ stock: v })} min="0" className="form-input" /></div>
                <div className="form-group"><label className="form-label">Add Stock (+)</label><NumInput value={form.addStock} onChange={v => ff({ addStock: v })} min="0" className="form-input" /></div>
                <div className="form-group"><label className="form-label">Min Stock Alert</label><NumInput value={form.min} onChange={v => ff({ min: v })} min="0" className="form-input" /></div>
                <div className="form-group"><label className="form-label">Cost Price (₹)</label><NumInput value={form.cost} onChange={v => ff({ cost: v })} min="0" className="form-input" /></div>
                <div className="form-group"><label className="form-label">Sale Price (₹)</label><NumInput value={form.price} onChange={v => ff({ price: v })} min="0" className="form-input" /></div>
                <div className="form-group"><label className="form-label">GST Rate</label><select className="form-select" value={form.gst} onChange={e => ff({ gst: parseFloat(e.target.value) })}>{[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}</select></div>
                <div className="form-group col-2"><label className="form-label">Barcode</label><input className="form-input" value={form.bar} onChange={e => ff({ bar: e.target.value })} /></div>
              </div>
              {form.price > 0 && form.cost > 0 && <div style={{ padding: '8px 12px', background: '#E8F5E9', borderRadius: 4, fontSize: 12, color: '#2E7D32', marginTop: 4 }}>Profit: ₹{(form.price - form.cost).toLocaleString()} ({(((form.price - form.cost) / form.price) * 100).toFixed(1)}%)</div>}
            </div>
            <div className="modal-footer"><button className="btn btn-gray" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>{editId ? 'Update' : 'Add Product'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// PARTIES — localStorage based
// ════════════════════════════════════════════════════════════════
const emptyParty = { type: 'customer', name: '', mobile: '', gstin: '', address: '', city: '', state: 'Tamil Nadu', email: '', balance: 0 }

export function Parties() {
  const activeFYP = getActiveFY()
  const fyROP = isFYClosed(activeFYP)
  const [customersData, setCustomersData] = useState([])
  const [suppliersData, setSuppliersData] = useState([])
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyParty)
  const [selected, setSelected] = useState([])
  const ff = v => setForm(p => ({ ...p, ...v }))

  useEffect(() => { loadParties() }, [])

  async function loadParties() {
    try {
      const [custRes, suppRes] = await Promise.all([
        getCustomers().catch(() => ({ data: [] })),
        getSuppliers().catch(() => ({ data: [] })),
      ])
      setCustomersData(custRes.data || [])
      setSuppliersData(suppRes.data || [])
    } catch (err) { console.error('Load parties error:', err) }
  }

  const parties = [...customersData.map(c => ({ ...c, type: 'customer' })), ...suppliersData.map(s => ({ ...s, type: 'supplier' }))]

  const filtered = parties.filter(p => {
    const ms = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.mobile || '').includes(search)
    const mt = tab === 'all' || p.type === tab
    return ms && mt
  })
  function openAdd(type) { setForm({ ...emptyParty, type: type || 'customer' }); setEditId(null); setShowModal(true) }
  function openEdit(p) { setForm({ ...p }); setEditId(p._id); setShowModal(true) }
  async function save() {
    if (!form.name) { alert('Name required'); return }
    try {
      if (form.type === 'customer') {
        if (editId) await updateCustomer(editId, form)
        else await createCustomer(form)
      } else {
        if (editId) await updateSupplier(editId, form)
        else await createSupplier(form)
      }
      await loadParties()
      setShowModal(false)
    } catch (err) { alert('Save failed: ' + (err.response?.data?.message || err.message)) }
  }
  async function del(id) {
    if (confirm('Delete?')) {
      const party = parties.find(p => p._id === id || p.id === id)
      if (!party) return
      try {
        if (party.type === 'customer') await deleteCustomer(id)
        else await deleteSupplier(id)
        await loadParties()
      } catch (err) { alert('Delete failed: ' + err.message) }
    }
  }
  async function bulkDelete() {
    if (selected.length && confirm(`Delete ${selected.length}?`)) {
      try {
        const toDelete = parties.filter(p => selected.includes(p._id || p.id))
        await Promise.all(toDelete.map(p => p.type === 'customer' ? deleteCustomer(p._id || p.id) : deleteSupplier(p._id || p.id)))
        await loadParties()
        setSelected([])
      } catch (err) { alert('Bulk delete failed: ' + err.message) }
    }
  }

  function exportExcel() {
    exportCSVFile([['Type', 'Name', 'Mobile', 'Email', 'GSTIN', 'Address', 'City', 'State', 'Balance'], ...filtered.map(p => [p.type, p.name, p.mobile || '', p.email || '', p.gstin || '', p.address || '', p.city || '', p.state || '', p.balance || 0])], 'parties.csv')
  }
  function exportPDFFn() {
    const rows = filtered.map(p => `<tr><td>${p.type}</td><td>${p.name}</td><td>${p.mobile || ''}</td><td>${p.gstin || ''}</td><td>${p.city || ''}</td></tr>`).join('')
    exportPDFWindow(`<h2>Party Statement</h2><p>${filtered.length} parties</p><table><thead><tr><th>Type</th><th>Name</th><th>Mobile</th><th>GSTIN</th><th>City</th></tr></thead><tbody>${rows}</tbody></table>`, 'Party Statement')
  }

  const customers = parties.filter(p => p.type === 'customer')
  const suppliers = parties.filter(p => p.type === 'supplier')

  return (
    <div className="page-wrap">
      <div className="page-head">
        <div><div className="page-title">Parties</div><div className="page-subtitle">{customers.length} customers · {suppliers.length} suppliers</div></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-gray btn-sm" onClick={exportExcel}>📊 Export Excel</button>
          <button className="btn btn-gray btn-sm" onClick={exportPDFFn}>📄 Export PDF</button>
          {selected.length > 0 && <button className="btn btn-danger btn-sm" onClick={bulkDelete}>🗑️ Delete ({selected.length})</button>}
          <button className="btn btn-outline btn-sm" onClick={() => openAdd('supplier')}>+ Add Supplier</button>
          <button className="btn btn-primary" onClick={() => openAdd('customer')}>+ Add Customer</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[['all', 'All'], ['customer', 'Customers'], ['supplier', 'Suppliers']].map(([v, l]) => (
          <button key={v} className={`filter-btn ${tab === v ? 'active' : ''}`} onClick={() => setTab(v)}>{l}</button>
        ))}
      </div>
      <div className="filter-bar">
        <div className="search-wrap"><span className="search-icon">🔍</span><input placeholder="Search name, mobile..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th style={{ width: 36 }}><input type="checkbox" checked={selected.length === filtered.length && filtered.length > 0} onChange={() => setSelected(selected.length === filtered.length ? [] : filtered.map(p => p._id || p.id))} /></th>
              <th>Type</th><th>Name</th><th>Mobile</th><th>GSTIN</th><th>City</th><th>Balance</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={8}><div className="empty-state"><div className="icon">👥</div><p>No parties found</p></div></td></tr>
                : filtered.map(p => (
                  <tr key={p._id || p.id} style={{ background: selected.includes(p._id || p.id) ? '#E3F2FD' : '' }}>
                    <td><input type="checkbox" checked={selected.includes(p._id || p.id)} onChange={() => setSelected(s => s.includes(p._id || p.id) ? s.filter(x => x !== (p._id || p.id)) : [...s, (p._id || p.id)])} /></td>
                    <td><span className={`badge badge-${p.type === 'customer' ? 'blue' : 'orange'}`}>{p.type === 'customer' ? 'Customer' : 'Supplier'}</span></td>
                    <td><div style={{ fontWeight: 600 }}>{p.name}</div>{p.email && <div style={{ fontSize: 11, color: '#9E9E9E' }}>{p.email}</div>}</td>
                    <td>{p.mobile || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.gstin || '—'}</td>
                    <td>{p.city || '—'}</td>
                    <td style={{ fontWeight: 600, color: p.balance >= 0 ? '#2E7D32' : '#C62828' }}>₹{(p.balance || 0).toLocaleString()}</td>
                    <td><div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-outline" onClick={() => openEdit(p)}>✏️</button>
                      <button className="btn btn-sm btn-danger" onClick={() => del(p._id || p.id)}>🗑️</button>
                    </div></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header"><div className="modal-title">{editId ? '✏️ Edit' : '+'} {form.type === 'customer' ? 'Customer' : 'Supplier'}</div><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label className="form-label">Type</label><select className="form-select" value={form.type} onChange={e => ff({ type: e.target.value })}><option value="customer">Customer</option><option value="supplier">Supplier</option></select></div>
                <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => ff({ name: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Mobile</label><input className="form-input" value={form.mobile} onChange={e => ff({ mobile: e.target.value })} maxLength={10} /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => ff({ email: e.target.value })} /></div>
                <div className="form-group col-2"><label className="form-label">GSTIN</label><input className="form-input" value={form.gstin} onChange={e => ff({ gstin: e.target.value.toUpperCase() })} maxLength={15} /></div>
                <div className="form-group col-2"><label className="form-label">Address</label><textarea style={{ width: '100%', padding: '8px 10px', border: '1px solid #E0E0E0', borderRadius: 4, fontSize: 13, minHeight: 60 }} value={form.address} onChange={e => ff({ address: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">City</label><input className="form-input" value={form.city} onChange={e => ff({ city: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">State</label><select className="form-select" value={form.state} onChange={e => ff({ state: e.target.value })}>{STATES.map(s => <option key={s}>{s}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Opening Balance (₹)</label><NumInput value={form.balance} onChange={v => ff({ balance: v })} className="form-input" /></div>
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-gray" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>{editId ? 'Update' : 'Save'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// EXPENSES — localStorage based
// ════════════════════════════════════════════════════════════════
const emptyExp = { name: '', cat: 'Rent', amount: 0, date: TODAY, note: '', payMode: 'Cash' }

export function Expenses() {
  const [activeFYE, setActiveFY] = useState(getActiveFY())
  useEffect(() => {
    const h = (e) => setActiveFY(e.detail.fy)
    window.addEventListener('fy_changed', h)
    return () => window.removeEventListener('fy_changed', h)
  }, [])
  const fyROE = isFYClosed(activeFYE)
  const [expenses, setExpenses] = useState([])
  useEffect(() => { loadExpenses() }, [activeFYE])
  async function loadExpenses() {
    try { const { data } = await getExpenses(); setExpenses(data || []) }
    catch (err) { console.error('Load expenses error:', err) }
  }
  const [search, setSearch] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [dateMode, setDateMode] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ ...emptyExp, date: getDefaultDateForFY(activeFYE) })
  const [allCats, setAllCats] = useState(ECATS)
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [customCats, setCustomCats] = useState(lsGet('inv_ecats'))
  
  useEffect(() => {
    getSettings().then(res => {
      if (res.data?.expenseCategories) {
        setAllCats(res.data.expenseCategories)
      }
    })
  }, [])

  const today = new Date()

  function applyDateFilter(mode) {
    setDateMode(mode)
    if (mode === 'month') { const y = today.getFullYear(), m = String(today.getMonth() + 1).padStart(2, '0'); setFilterFrom(`${y}-${m}-01`); setFilterTo(today.toISOString().split('T')[0]) }
    else if (mode === 'year') { const fy = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear(); setFilterFrom(`${fy}-04-01`); setFilterTo(`${fy + 1}-03-31`) }
  }

  const filtered = expenses.filter(e => {
    const ms = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.cat.toLowerCase().includes(search.toLowerCase())
    return ms && (!filterFrom || e.date >= filterFrom) && (!filterTo || e.date <= filterTo)
  })
  const total = filtered.reduce((s, e) => s + (e.amount || 0), 0)
  const catTotals = {}
  filtered.forEach(e => { catTotals[e.cat] = (catTotals[e.cat] || 0) + (e.amount || 0) })

  function openAdd() { setForm(emptyExp); setEditId(null); setShowModal(true) }
  function openEdit(e) { setForm({ ...e }); setEditId(e._id); setShowModal(true) }
  async function save() {
    if (fyROE) { alert(`FY ${getFYLabel(activeFYE)} is closed. Read-only.`); return }
    if (!validateDateInFY(form.date, activeFYE)) { const r = getFYRange(activeFYE); alert(`Date must be between ${r.from} and ${r.to} for FY ${getFYLabel(activeFYE)}`); return }
    if (!form.name) { alert('Name required'); return }
    if (!form.amount) { alert('Amount required'); return }
    try {
      if (editId) await updateExpense(editId, form)
      else await createExpense(form)
      await loadExpenses()
      setShowModal(false)
    } catch (err) { alert('Save failed: ' + (err.response?.data?.message || err.message)) }
  }
  async function del(id) {
    if (fyROE) { alert(`FY ${getFYLabel(activeFYE)} is closed. Cannot delete.`); return }
    if (confirm('Delete?')) {
      try { await deleteExpense(id); await loadExpenses() }
      catch (err) { alert('Delete failed: ' + err.message) }
    }
  }

  function exportExcel() {
    exportCSVFile([['Name', 'Category', 'Amount', 'Date', 'Note', 'Pay Mode'], ...filtered.map(e => [e.name, e.cat, e.amount, e.date, e.note || '', e.payMode || ''])], 'expenses.csv')
  }
  function exportPDFFn() {
    const rows = filtered.map(e => `<tr><td>${e.name}</td><td>${e.cat}</td><td>₹${e.amount.toLocaleString()}</td><td>${e.date}</td><td>${e.payMode || ''}</td></tr>`).join('')
    exportPDFWindow(`<h2>Expense Report</h2><p>Total: ₹${total.toLocaleString()} | ${filtered.length} records</p><table><thead><tr><th>Name</th><th>Category</th><th>Amount</th><th>Date</th><th>Pay Mode</th></tr></thead><tbody>${rows}</tbody></table>`, 'Expense Report')
  }

  const CAT_COLORS = ['#1565C0', '#2E7D32', '#E65100', '#C62828', '#6A1B9A', '#00695C', '#AD1457', '#37474F', '#558B2F', '#4527A0']
  const catColor = c => { const i = allCats.indexOf(c) % CAT_COLORS.length; return CAT_COLORS[i >= 0 ? i : 0] }

  return (
    <div className="page-wrap">
      <div className="page-head">
        <div><div className="page-title">Expenses</div><div className="page-subtitle">Total: ₹{total.toLocaleString()}</div></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className={`filter-btn${dateMode === 'month' ? ' active' : ''}`} onClick={() => applyDateFilter('month')}>This Month</button>
          <button className={`filter-btn${dateMode === 'year' ? ' active' : ''}`} onClick={() => applyDateFilter('year')}>This Year</button>
          <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setDateMode('') }} style={{ padding: '5px 8px', border: '1px solid #BDBDBD', borderRadius: 4, fontSize: 12 }} />
          <span style={{ alignSelf: 'center', fontSize: 12, color: '#757575' }}>to</span>
          <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setDateMode('') }} style={{ padding: '5px 8px', border: '1px solid #BDBDBD', borderRadius: 4, fontSize: 12 }} />
          {(filterFrom || filterTo) && <button className="btn btn-gray btn-sm" onClick={() => { setFilterFrom(''); setFilterTo(''); setDateMode('') }}>✕</button>}
          <button className="btn btn-gray btn-sm" onClick={exportExcel}>📊 Export Excel</button>
          <button className="btn btn-gray btn-sm" onClick={exportPDFFn}>📄 Export PDF</button>
          <button className="btn btn-primary" onClick={openAdd}>+ Add Expense</button>
        </div>
      </div>
      <div className="filter-bar">
        <div className="search-wrap"><span className="search-icon">🔍</span><input placeholder="Search expense name, category..." value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([cat, amt]) => (
          <div key={cat} style={{ padding: '6px 12px', borderRadius: 16, fontSize: 12, background: catColor(cat) + '22', color: catColor(cat), fontWeight: 600, border: `1px solid ${catColor(cat)}44` }}>
            {cat}: ₹{amt.toLocaleString()}
          </div>
        ))}
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Name</th><th>Category</th><th>Amount</th><th>Date</th><th>Pay Mode</th><th>Note</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={7}><div className="empty-state"><div className="icon">💸</div><p>No expenses found</p></div></td></tr>
                : filtered.map(e => (
                  <tr key={e._id || e.id}>
                    <td style={{ fontWeight: 600 }}>{e.name}</td>
                    <td><span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: catColor(e.cat) + '22', color: catColor(e.cat) }}>{e.cat}</span></td>
                    <td style={{ fontWeight: 700, color: '#C62828' }}>₹{(e.amount || 0).toLocaleString()}</td>
                    <td style={{ color: '#757575' }}>{e.date}</td>
                    <td><span className="badge badge-gray">{e.payMode || 'Cash'}</span></td>
                    <td style={{ fontSize: 12, color: '#757575' }}>{e.note || '—'}</td>
                    <td><div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-sm btn-outline" onClick={() => openEdit(e)}>✏️</button>
                      <button className="btn btn-sm btn-danger" onClick={() => del(e._id || e.id)}>🗑️</button>
                    </div></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header"><div className="modal-title">{editId ? '✏️ Edit Expense' : '+ Add Expense'}</div><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group col-2"><label className="form-label">Expense Name *</label><input className="form-input" value={form.name} onChange={e => ff({ name: e.target.value })} placeholder="e.g. Office Rent March" /></div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select className="form-select" value={form.cat} onChange={e => { if (e.target.value === '__new__') setShowNewCat(true); else ff({ cat: e.target.value }) }}>
                      {[...allCats, ...customCats].map(c => <option key={c}>{c}</option>)}
                      <option value="__new__">➕ Add New Category</option>
                    </select>
                  </div>
                  {showNewCat && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <input className="form-input" placeholder="New category name" value={newCatInput} onChange={e => setNewCatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newCatInput) { setCustomCats(p => { const n = [...p, newCatInput]; lsSet('inv_ecats', n); return n }); ff({ cat: newCatInput }); setNewCatInput(''); setShowNewCat(false) } }} />
                      <button className="btn btn-sm btn-primary" onClick={() => { if (newCatInput) { setCustomCats(p => { const n = [...p, newCatInput]; lsSet('inv_ecats', n); return n }); ff({ cat: newCatInput }); setNewCatInput(''); setShowNewCat(false) } }}>💾 Save</button>
                      <button className="btn btn-sm btn-gray" onClick={() => { setShowNewCat(false); setNewCatInput('') }}>✕</button>
                    </div>
                  )}
                </div>
                <div className="form-group"><label className="form-label">Pay Mode</label><select className="form-select" value={form.payMode} onChange={e => ff({ payMode: e.target.value })}>{['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'].map(p => <option key={p}>{p}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Amount (₹) *</label><NumInput value={form.amount} onChange={v => ff({ amount: v })} min="0" className="form-input" /></div>
                <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.date} onChange={e => ff({ date: e.target.value })} /></div>
                <div className="form-group col-2"><label className="form-label">Note</label><textarea style={{ width: '100%', padding: '8px 10px', border: '1px solid #E0E0E0', borderRadius: 4, fontSize: 13, minHeight: 60 }} value={form.note} onChange={e => ff({ note: e.target.value })} /></div>
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-gray" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>{editId ? 'Update' : 'Add Expense'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// STAFF — Owner/Manager only, with login restriction
// ════════════════════════════════════════════════════════════════

export function Staff() {
  const currentUser = JSON.parse(localStorage.getItem('inv_user') || '{}')
  const isOwnerOrMgr = ['owner', 'manager'].includes((currentUser.role || '').toLowerCase())

  const [activeFYStaff, setActiveFY] = useState(getActiveFY())
  useEffect(() => {
    const h = (e) => setActiveFY(e.detail.fy)
    window.addEventListener('fy_changed', h)
    return () => window.removeEventListener('fy_changed', h)
  }, [])
  const [staffList, setStaffList] = useState([])
  useEffect(() => { loadStaff() }, [currentUser, activeFYStaff])
  async function loadStaff() {
    try { const { data } = await getStaff(); setStaffList(data || []) }
    catch (err) { console.error('Load staff error:', err) }
  }
  const [showModal, setShowModal] = useState(false)
  const [showAtt, setShowAtt] = useState(null)
  const [showPass, setShowPass] = useState(false)
  const [editId, setEditId] = useState(null)
  const [attMonth, setAttMonth] = useState(TODAY.slice(0, 7))
  const [attDate, setAttDate] = useState(TODAY)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ name: '', role: 'Staff', dept: 'General', mobile: '', password: '', email: '', salary: 0, joinDate: TODAY, address: '', active: true })
  const ff = v => setForm(p => ({ ...p, ...v }))

  async function saveStaff() {
    if (!form.name) { alert('Name required'); return }
    if (!form.mobile) { alert('Mobile required'); return }
    try {
      if (editId) await updateStaff(editId, form)
      else await createStaff(form)
      await loadStaff()
      setShowModal(false); setMsg('✅ Staff saved!'); setTimeout(() => setMsg(''), 3000)
    } catch (err) { alert('Save failed: ' + (err.response?.data?.message || err.message)) }
  }
  async function delStaff(id) {
    if (confirm('Delete?')) {
      try { await deleteStaff(id); await loadStaff() }
      catch (err) { alert('Delete failed: ' + err.message) }
    }
  }
  async function markAtt(staffId, date, status) {
    try {
      await markAttendance(staffId, { date, status })
      await loadStaff()
    } catch (err) { console.error('Attendance error:', err) }
  }
  function getAtt(staff, date) { return (staff.attendance || []).find(a => a.date === date)?.status || '' }
  function getMonthDays(ym) {
    const [y, m] = ym.split('-').map(Number)
    const days = []; const dt = new Date(y, m - 1, 1)
    while (dt.getMonth() === m - 1) { days.push(dt.toISOString().split('T')[0]); dt.setDate(dt.getDate() + 1) }
    return days
  }
  const days = getMonthDays(attMonth)

  if (!isOwnerOrMgr) return (
    <div className="page-wrap">
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Access Restricted</div>
        <div style={{ fontSize: 14, color: '#757575', maxWidth: 400, margin: '0 auto' }}>
          Only <b>Owner</b> and <b>Manager</b> can access the Staff page.<br />
          Please login with Owner or Manager credentials.
        </div>
        <div style={{ marginTop: 20, padding: '12px 20px', background: '#FFF3E0', borderRadius: 6, display: 'inline-block', fontSize: 13 }}>
          Current role: <b style={{ color: '#E65100' }}>{currentUser.role || 'Unknown'}</b>
        </div>
      </div>
    </div>
  )

  return (
    <div className="page-wrap">
      {msg && <div style={{ padding: '8px 14px', background: '#E8F5E9', color: '#2E7D32', borderRadius: 4, marginBottom: 12, fontWeight: 600, fontSize: 13 }}>{msg}</div>}
      <div className="page-head">
        <div><div className="page-title">Staff</div><div className="page-subtitle">{staffList.filter(s => s.active).length} active members</div></div>
        <button className="btn btn-primary" onClick={() => { setForm({ name: '', role: 'Staff', dept: 'General', mobile: '', password: '', email: '', salary: 0, joinDate: TODAY, address: '', active: true }); setEditId(null); setShowModal(true) }}>+ Add Staff</button>
      </div>

      {/* Attendance Picker */}
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>📅 Mark Attendance for Date:</div>
          <input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #BDBDBD', borderRadius: 4, fontWeight: 600 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
          {staffList.filter(s => s.active).map(s => {
            const dateAtt = getAtt(s, attDate)
            return (
              <div key={s._id || s.id} className="card" style={{ padding: 12, border: '1px solid #E0E0E0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#1565C0', fontSize: 14 }}>{s.name.charAt(0)}</div>
                  <div style={{ overflow: 'hidden' }}><div style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{s.name}</div><div style={{ fontSize: 11, color: '#9E9E9E' }}>{s.role}</div></div>
                  {dateAtt && <span style={{ marginLeft: 'auto', background: ATT_BG[dateAtt], color: ATT_COLORS[dateAtt], fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>{ATT_LABELS[dateAtt]}</span>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {Object.entries(ATT_LABELS).map(([k, l]) => (
                    <button key={k} onClick={() => markAtt(s._id || s.id, attDate, k)} style={{ flex: 1, padding: '5px 2px', fontSize: 11, fontWeight: 600, border: `1px solid ${ATT_COLORS[k]}`, borderRadius: 4, background: dateAtt === k ? ATT_BG[k] : '#fff', color: ATT_COLORS[k], cursor: 'pointer' }}>{k}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Staff Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {staffList.map(s => {
          const att = s.attendance || []
          const monthAtt = att.filter(a => a.date?.startsWith(attMonth))
          const counts = { P: 0, A: 0, H: 0, HO: 0 }; monthAtt.forEach(a => { if (counts[a.status] !== undefined) counts[a.status]++ })
          return (
            <div key={s._id || s.id} className="card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#E3F2FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#1565C0', fontSize: 18 }}>{s.name.charAt(0)}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#757575' }}>{s.role} · {s.dept}</div>
                    {s.salary > 0 && <div style={{ fontSize: 11, color: '#9E9E9E' }}>₹{s.salary.toLocaleString()}/mo</div>}
                  </div>
                </div>
                <span className={`badge badge-${s.active ? 'green' : 'red'}`}>{s.active ? 'Active' : 'Inactive'}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {Object.entries(counts).map(([k, v]) => (
                  <div key={k} style={{ flex: 1, background: ATT_BG[k], color: ATT_COLORS[k], borderRadius: 4, padding: '4px', textAlign: 'center', fontSize: 11 }}>
                    <div style={{ fontWeight: 700 }}>{v}</div><div style={{ fontSize: 9 }}>{k}</div>
                  </div>
                ))}
              </div>
              {s.mobile && <div style={{ fontSize: 12, color: '#757575', marginBottom: 8 }}>📱 {s.mobile}</div>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => setShowAtt(showAtt === (s._id || s.id) ? null : (s._id || s.id))}>📅 History</button>
                <button className="btn btn-gray btn-sm" onClick={() => { setForm({ ...s, password: s.password || '' }); setEditId(s._id || s.id); setShowModal(true) }}>✏️</button>
                <button className="btn btn-danger btn-sm" onClick={() => delStaff(s._id || s.id)}>🗑️</button>
              </div>
              {showAtt === (s._id || s.id) && (
                <div style={{ marginTop: 10, borderTop: '1px solid #F5F5F5', paddingTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Month:</span>
                    <input type="month" value={attMonth} onChange={e => setAttMonth(e.target.value)} style={{ padding: '3px 6px', border: '1px solid #BDBDBD', borderRadius: 4, fontSize: 12 }} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {days.map(d => {
                      const a = getAtt(s, d)
                      const isPast = d <= TODAY
                      const opts = Object.keys(ATT_LABELS)
                      return (
                        <div key={d} title={`${d}: ${a ? ATT_LABELS[a] : 'Not Marked'}`}
                          style={{ width: 28, height: 28, borderRadius: 4, background: a ? ATT_BG[a] : '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: a ? ATT_COLORS[a] : '#BDBDBD', cursor: isPast ? 'pointer' : 'default', border: `1px solid ${a ? ATT_COLORS[a] + '44' : '#E0E0E0'}` }}
                          onClick={() => isPast && markAtt(s._id || s.id, d, opts[(opts.indexOf(a || 'P') + 1) % opts.length])}>
                          {d.split('-')[2]}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header"><div className="modal-title">{editId ? '✏️ Edit Staff' : '+ Add Staff'}</div><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group col-2"><label className="form-label">Full Name *</label><input className="form-input" value={form.name} onChange={e => ff({ name: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Role</label><select className="form-select" value={form.role} onChange={e => ff({ role: e.target.value })}>{ROLES.map(r => <option key={r}>{r}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Department</label><select className="form-select" value={form.dept} onChange={e => ff({ dept: e.target.value })}>{DEPTS.map(d => <option key={d}>{d}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Mobile *</label><input className="form-input" value={form.mobile} onChange={e => ff({ mobile: e.target.value })} maxLength={10} placeholder="Login mobile number" /></div>
                <div className="form-group"><label className="form-label">Password *</label>
                  <div style={{ position: 'relative' }}>
                    <input className="form-input" type={showPass ? 'text' : 'password'} value={form.password} onChange={e => ff({ password: e.target.value })} placeholder={editId ? 'New password (optional)' : 'Set login password'} />
                    <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>{showPass ? '👁️' : '👁️‍🗨️'}</button>
                  </div>
                </div>
                <div className="form-group"><label className="form-label">Join Date</label><input className="form-input" type="date" value={form.joinDate} onChange={e => ff({ joinDate: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => ff({ email: e.target.value })} /></div>
                <div className="form-group col-2"><label className="form-label">Address</label><textarea style={{ width: '100%', padding: '8px', border: '1px solid #E0E0E0', borderRadius: 4, fontSize: 13, minHeight: 60 }} value={form.address} onChange={e => ff({ address: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={form.active ? 'active' : 'inactive'} onChange={e => ff({ active: e.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
              </div>
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#E3F2FD', borderRadius: 4, fontSize: 12, color: '#1565C0' }}>
                💡 Staff login: Use mobile + password to access this app. Only Owner/Manager can view Staff page.
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-gray" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={saveStaff}>{editId ? 'Update' : 'Add Staff'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// REPORTS — localStorage based, all working
// ════════════════════════════════════════════════════════════════
export function Reports() {
  const [fromD, setFromD] = useState('')
  const [toD, setToD] = useState('')
  const [active, setActive] = useState(null)
  const [activeFYRep, setActiveFY] = useState(getActiveFY())
  useEffect(() => {
    const h = (e) => setActiveFY(e.detail.fy)
    window.addEventListener('fy_changed', h)
    return () => window.removeEventListener('fy_changed', h)
  }, [])
  const [reportData, setReportData] = useState([])
  const [rData, setRData] = useState({ inv: [], pur: [], exp: [], prod: [], par: [], cdn: [] })

  useEffect(() => {
    async function loadAll() {
      try {
        const [invR, purR, expR, prodR, custR, suppR, cdnR] = await Promise.all([
          getInvoices().catch(()=>({data:[]})), getPurchases().catch(()=>({data:[]})),
          getExpenses().catch(()=>({data:[]})), getProducts().catch(()=>({data:[]})),
          getCustomers().catch(()=>({data:[]})), getSuppliers().catch(()=>({data:[]})),
          getNotes().catch(()=>({data:[]}))
        ])
        setRData({
          inv: invR.data||[], pur: purR.data||[], exp: expR.data||[],
          prod: prodR.data||[],
          par: [...(custR.data||[]).map(c=>({...c,type:'customer'})), ...(suppR.data||[]).map(s=>({...s,type:'supplier'}))],
          cdn: cdnR.data||[]
        })
      } catch(err) { console.error('Reports load error:', err) }
    }
    loadAll()
  }, [activeFYRep])

  function getData() {
    return rData
  }
  function filterDate(items, field = 'date') {
    return items.filter(i => { const d = i[field]; return (!fromD || d >= fromD) && (!toD || d <= toD) })
  }
  function viewReport(type) {
    setActive(type)
    const { inv, pur, exp, prod, par } = getData()
    const fi = filterDate(inv), fp = filterDate(pur), fe = filterDate(exp)
    if (type === 'sale') setReportData(fi)
    else if (type === 'purchase') setReportData(fp)
    else if (type === 'expense') setReportData(fe)
    else if (type === 'stock') {
      const allSales = rData.inv
      const allPurchases = rData.pur
      const enriched = prod.map(p => {
        const saleOut = allSales.reduce((s, inv) => {
          const q = (inv.items || []).filter(it => it.name === p.name).reduce((sum, it) => sum + (it.qty || 0), 0)
          return s + q
        }, 0)
        const purMod = allPurchases.reduce((s, pur) => {
          const q = (pur.items || []).filter(it => it.name === p.name).reduce((sum, it) => sum + (it.qty || 0), 0)
          return s + q
        }, 0)
        const purchaseIn = (p.addStock || 0) + purMod
        const balance = (p.stock || 0) + purchaseIn - saleOut
        return { ...p, purchaseIn, saleOut, balance }
      })
      setReportData(enriched)
    }
    else if (type === 'party') setReportData(par)
    else if (type === 'gstr_1_all') { setReportData(fi.map(i => ({ ...i, gstType: i.customer?.gstin ? 'B2B' : 'B2C' }))) }
    else if (type === 'pl') {
      const ts = fi.reduce((s, i) => s + (i.grandTotal || 0), 0)
      const tp = fp.reduce((s, p) => s + (p.grandTotal || 0), 0)
      const te = fe.reduce((s, e) => s + (e.amount || 0), 0)
      setReportData([{ label: 'Total Sale', amount: ts, color: '#2E7D32' }, { label: 'Total Purchase', amount: tp, color: '#E65100' }, { label: 'Total Expense', amount: te, color: '#C62828' }, { label: 'Gross Profit', amount: ts - tp, color: ts - tp >= 0 ? '#2E7D32' : '#C62828' }, { label: 'Net Profit', amount: ts - tp - te, color: ts - tp - te >= 0 ? '#2E7D32' : '#C62828' }])
    }
  }
  function doExportCSV() {
    if (!reportData.length) return
    if (active === 'gstr_1_all') { exportGSTRReadyExcel(); return }
    let rows = []
    if (active === 'sale') rows = [['Invoice#', 'Date', 'Customer', 'GSTIN', 'Payment', 'Amount', 'Status'], ...reportData.map(i => [i.invoiceNo, i.date, i.customer?.name || i.custSearch || '', i.customer?.gstin || '', i.paymentType, i.grandTotal || 0, i.status])]
    else if (active === 'purchase') rows = [['Purchase#', 'Date', 'Supplier', 'Payment', 'Amount', 'Status'], ...reportData.map(p => [p.purchaseNo, p.date, p.supplier?.name || '', p.paymentType, p.grandTotal || 0, p.status])]
    else if (active === 'expense') rows = [['Name', 'Category', 'Amount', 'Date', 'PayMode'], ...reportData.map(e => [e.name, e.cat, e.amount, e.date, e.payMode || ''])]
    else if (active === 'stock') rows = [['Product ID', 'Product Name', 'SKU', 'Purchase In', 'Sale Out', 'Total Balance Stock', 'Purchase Price Value', 'Sale Value', 'Status'], ...reportData.map(p => [p.id || '', p.name || '', p.sku || '', p.purchaseIn || 0, p.saleOut || 0, p.balance || 0, (p.balance || 0) * (p.cost || 0), (p.balance || 0) * (p.price || 0), p.balance === 0 ? 'Out of Stock' : p.balance <= (p.min || 0) ? 'Low Stock' : 'In Stock'])]
    else if (active === 'party') rows = [['Type', 'Name', 'Mobile', 'GSTIN', 'City'], ...reportData.map(p => [p.type || '', p.name, p.mobile || '', p.gstin || '', p.city || ''])]
    else if (active === 'pl') rows = [['Item', 'Amount'], ...reportData.map(r => [r.label, r.amount])]
    if (rows.length) exportCSVFile(rows, `${active}-report.csv`)
  }

  function exportGSTRReadyExcel() {
    if (!window.XLSX) { alert('Export library loading...'); return }
    const { inv, cdn } = getData()
    const fi = filterDate(inv)
    const fc = filterDate(cdn, 'date')
    const biz = getBiz()
    const activeFY = getActiveFY()
    const fyLabel = getFYLabel(activeFY)

    const b2b = fi.filter(i => i.customer?.gstin)
    const b2cl = fi.filter(i => !i.customer?.gstin && (i.grandTotal || 0) > 250000 && i.stateOfSupply !== biz.state)
    const b2cs = fi.filter(i => !i.customer?.gstin && !b2cl.includes(i))
    const cdnr = fc.filter(n => { const party = rData.par.find(p => p.name === n.partyName); return party?.gstin })
    const cdnur = fc.filter(n => !cdnr.includes(n))
    const exports = fi.filter(i => i.stateOfSupply === 'Export' || i.invoiceType === 'Export')

    const wb = XLSX.utils.book_new()
    const addSheet = (name, columns, dataRows, totalCols = []) => {
      const aoa = [[biz.businessName || 'Invoxira Cloud'], [`GSTIN: ${biz.gstin || 'N/A'} | Financial Year: ${fyLabel}`], [`${biz.address || ''}, ${biz.city || ''}, ${biz.state || ''}`], [], columns, ...dataRows]
      if (dataRows.length > 0 && totalCols.length > 0) {
        const total = Array(columns.length).fill('')
        total[0] = 'TOTAL'
        totalCols.forEach(idx => {
          const sum = dataRows.reduce((a, b) => a + (parseFloat(b[idx]) || 0), 0)
          total[idx] = parseFloat(sum.toFixed(2))
        })
        aoa.push(total)
      }
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      const colWidths = columns.map((col, i) => {
        let maxLen = col.toString().length
        dataRows.forEach(row => { const v = row[i]?.toString() || ''; if (v.length > maxLen) maxLen = v.length })
        return { wch: Math.min(Math.max(maxLen + 2, 8), 50) }
      })
      ws['!cols'] = colWidths
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } }, { s: { r: 2, c: 0 }, e: { r: 2, c: columns.length - 1 } }]
      XLSX.utils.book_append_sheet(wb, ws, name)
    }

    addSheet('B2B', ['GSTIN of Receiver', 'Receiver Name', 'Invoice Number', 'Invoice Date', 'Invoice Value', 'Place of Supply', 'Reverse Charge', 'Invoice Type', 'E-Commerce GSTIN', 'Rate', 'Taxable Value', 'CGST Amount', 'SGST Amount', 'IGST Amount', 'Cess Amount'], b2b.flatMap(i => (i.items || []).map(it => { const r = calcItem(it); const isInter = i.stateOfSupply !== biz.state; return [i.customer?.gstin || '', i.customer?.name || '', i.invoiceNo, i.date, i.grandTotal || 0, i.stateOfSupply || '', 'N', 'Regular', '', it.gstRate, r.taxable, isInter ? 0 : r.gstAmt / 2, isInter ? 0 : r.gstAmt / 2, isInter ? r.gstAmt : 0, 0] })), [4, 10, 11, 12, 13])
    addSheet('B2CL', ['Invoice Number', 'Invoice Date', 'Invoice Value', 'Place of Supply', 'Rate', 'Taxable Value', 'IGST Amount', 'Cess Amount'], b2cl.flatMap(i => (i.items || []).map(it => { const r = calcItem(it); return [i.invoiceNo, i.date, i.grandTotal || 0, i.stateOfSupply || '', it.gstRate, r.taxable, r.gstAmt, 0] })), [2, 5, 6])
    
    const b2csSummaryObj = {}
    b2cs.forEach(i => { const isInter = i.stateOfSupply !== biz.state; (i.items || []).forEach(it => { const key = `${i.stateOfSupply}_${it.gstRate}`; const r = calcItem(it); if (!b2csSummaryObj[key]) b2csSummaryObj[key] = { pos: i.stateOfSupply, rate: it.gstRate, taxable: 0, cgst: 0, sgst: 0, igst: 0 }; b2csSummaryObj[key].taxable += r.taxable; if (isInter) b2csSummaryObj[key].igst += r.gstAmt; else { b2csSummaryObj[key].cgst += r.gstAmt/2; b2csSummaryObj[key].sgst += r.gstAmt/2 } }) })
    addSheet('B2CS', ['Place of Supply', 'Rate', 'Taxable Value', 'CGST Amount', 'SGST Amount', 'IGST Amount', 'Cess Amount'], Object.values(b2csSummaryObj).map(s => [s.pos, s.rate, s.taxable, s.cgst, s.sgst, s.igst, 0]), [2, 3, 4, 5])

    addSheet('CDNR', ['GSTIN of Receiver', 'Receiver Name', 'Note Type (Credit/Debit)', 'Note Number', 'Note Date', 'Original Invoice Number', 'Original Invoice Date', 'Note Value', 'Rate', 'Taxable Value', 'CGST Amount', 'SGST Amount', 'IGST Amount', 'Cess Amount'], cdnr.map(n => { const party = rData.par.find(p => p.name === n.partyName); const isInter = n.stateOfSupply ? n.stateOfSupply !== biz.state : (party?.state !== biz.state); const v = (n.amount || 0); const tx = v/1.18; const g = v-tx; return [party?.gstin || '', n.partyName, n.type === 'Credit Note' ? 'C' : 'D', n.number, n.date, n.refInvoice || '', '', v, 18, tx, isInter ? 0 : g / 2, isInter ? 0 : g / 2, isInter ? g : 0, 0] }), [7, 9, 10, 11, 12])
    addSheet('CDNUR', ['Note Type (Credit/Debit)', 'Note Number', 'Note Date', 'Customer Name', 'Place of Supply', 'Note Value', 'Rate', 'Taxable Value', 'IGST Amount', 'Cess Amount'], cdnur.map(n => { const v = (n.amount || 0); const tx = v/1.18; return [n.type === 'Credit Note' ? 'C' : 'D', n.number, n.date, n.partyName, n.stateOfSupply || biz.state, v, 18, tx, v-tx, 0] }), [5, 7, 8])
    addSheet('Exports', ['Export Type (With/Without Payment)', 'Invoice Number', 'Invoice Date', 'Invoice Value', 'Port Code', 'Shipping Bill Number', 'Shipping Bill Date', 'Rate', 'Taxable Value', 'IGST Amount'], exports.flatMap(i => (i.items || []).map(it => [i.exportType || 'WPAY', i.invoiceNo, i.date, i.grandTotal, i.portCode || '', i.shippingBillNo || '', i.shippingBillDate || '', it.gstRate, calcItem(it).taxable, calcItem(it).gstAmt])), [3, 8, 9])

    const hsnMap = {}
    fi.forEach(i => (i.items || []).forEach(it => { if (!it.hsn) return; const r = calcItem(it); const m = hsnMap[it.hsn] || (hsnMap[it.hsn] = { hsn: it.hsn, desc: it.name, unit: it.unit, qty: 0, val: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 }); m.qty += (it.qty || 0); m.val += (r.total || 0); m.taxable += (r.taxable || 0); if (i.stateOfSupply !== biz.state) m.igst += r.gstAmt; else { m.cgst += r.gstAmt / 2; m.sgst += r.gstAmt / 2 } }))
    addSheet('HSN', ['HSN', 'Description', 'Unit', 'Total Quantity', 'Total Value', 'Taxable Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount'], Object.values(hsnMap).map(m => [m.hsn, m.desc, m.unit, m.qty, m.val, m.taxable, m.igst, m.cgst, m.sgst, 0]), [3, 4, 5, 6, 7, 8])

    const invNos = fi.map(i => i.invoiceNo).sort()
    const dMin = invNos[0] || '', dMax = invNos[invNos.length - 1] || ''
    addSheet('DOCS', ['Nature of Document', 'Sr. No. From', 'Sr. No. To', 'Total Number', 'Cancelled', 'Net Issued'], [['Invoices for outward supply', dMin, dMax, invNos.length, 0, invNos.length]])

    addSheet('Detailed', ['Invoice Number', 'Invoice Date', 'Customer Name', 'GSTIN', 'State of Supply', 'Item Name', 'HSN Code', 'Quantity', 'Rate', 'Taxable Value', 'GST Rate', 'CGST Amount', 'SGST Amount', 'IGST Amount', 'Total Amount'], fi.flatMap(i => (i.items || []).map(it => { const r = calcItem(it); const isInter = i.stateOfSupply !== biz.state; return [i.invoiceNo, i.date, i.customer?.name || '', i.customer?.gstin || '', i.stateOfSupply || '', it.name, it.hsn || '', it.qty, it.price, r.taxable, it.gstRate, isInter ? 0 : r.gstAmt/2, isInter ? 0 : r.gstAmt/2, isInter ? r.gstAmt : 0, r.total] })))

    XLSX.writeFile(wb, `GSTR1_Report_${fyLabel}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  function doExportPDF() {
    if (!reportData.length) return
    const biz = getBiz()
    let tableHTML = ''
    if (active === 'sale') tableHTML = `<table><thead><tr><th>Invoice#</th><th>Date</th><th>Customer</th><th>Payment</th><th>Amount</th><th>Status</th></tr></thead><tbody>${reportData.map(i => `<tr><td>#${i.invoiceNo}</td><td>${i.date}</td><td>${i.customer?.name || i.custSearch || ''}</td><td>${i.paymentType}</td><td>₹${(i.grandTotal || 0).toLocaleString()}</td><td>${i.status}</td></tr>`).join('')}</tbody></table>`
    else if (active === 'purchase') tableHTML = `<table><thead><tr><th>Purchase#</th><th>Date</th><th>Supplier</th><th>Payment</th><th>Amount</th><th>Status</th></tr></thead><tbody>${reportData.map(p => `<tr><td>#${p.purchaseNo}</td><td>${p.date}</td><td>${p.supplier?.name || ''}</td><td>${p.paymentType}</td><td>₹${(p.grandTotal || 0).toLocaleString()}</td><td>${p.status}</td></tr>`).join('')}</tbody></table>`
    else if (active === 'expense') tableHTML = `<table><thead><tr><th>Name</th><th>Category</th><th>Amount</th><th>Date</th></tr></thead><tbody>${reportData.map(e => `<tr><td>${e.name}</td><td>${e.cat}</td><td>₹${(e.amount || 0).toLocaleString()}</td><td>${e.date}</td></tr>`).join('')}</tbody></table>`
    else if (active === 'stock') tableHTML = `<table><thead><tr><th>Product ID</th><th>Product Name</th><th>SKU</th><th>Purchase In</th><th>Sale Out</th><th>Balance</th><th>Purchase Value</th><th>Sale Value</th><th>Status</th></tr></thead><tbody>${reportData.map(p => `<tr><td>${p.id || ''}</td><td>${p.name || ''}</td><td>${p.sku || ''}</td><td>${p.purchaseIn || 0}</td><td>${p.saleOut || 0}</td><td>${p.balance || 0}</td><td>₹${((p.balance || 0) * (p.cost || 0)).toLocaleString()}</td><td>₹${((p.balance || 0) * (p.price || 0)).toLocaleString()}</td><td>${p.balance === 0 ? 'Out' : p.balance <= (p.min || 0) ? 'Low' : 'OK'}</td></tr>`).join('')}</tbody></table>`
    else if (active === 'party') tableHTML = `<table><thead><tr><th>Type</th><th>Name</th><th>Mobile</th><th>GSTIN</th><th>City</th></tr></thead><tbody>${reportData.map(p => `<tr><td>${p.type || ''}</td><td>${p.name}</td><td>${p.mobile || ''}</td><td>${p.gstin || ''}</td><td>${p.city || ''}</td></tr>`).join('')}</tbody></table>`
    else if (active === 'pl') tableHTML = `<table><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody>${reportData.map(r => `<tr><td>${r.label}</td><td style="color:${r.color};font-weight:700">₹${r.amount.toLocaleString()}</td></tr>`).join('')}</tbody></table>`
    const title = REPORT_LIST.find(r => r.id === active)?.title || active
    exportPDFWindow(`<h2>${biz.businessName || 'Invoxira Cloud'}</h2><h3>${title} ${fromD ? `(${fromD} to ${toD || 'now'})` : ''}</h3><p>${reportData.length} records</p>${tableHTML}`, title)
  }

  const REPORT_LIST = [
    { id: 'sale', icon: '🧾', title: 'Sale Report', desc: 'All sale invoices' },
    { id: 'purchase', icon: '🛒', title: 'Purchase Report', desc: 'All purchase bills' },
    { id: 'expense', icon: '💸', title: 'Expense Report', desc: 'All expenses' },
    { id: 'stock', icon: '📦', title: 'Stock Report', desc: 'Inventory & value' },
    { id: 'party', icon: '👥', title: 'Party Statement', desc: 'Customers & suppliers' },
    { id: 'gstr_1_all', icon: '🏛️', title: 'GSTR-1 All', desc: 'View GST info & download 9-Sheet Excel' },
    { id: 'pl', icon: '📈', title: 'Profit & Loss', desc: 'Business P&L summary' },
  ]

  return (
    <div className="page-wrap">
      <div className="page-head">
        <div><div className="page-title">Reports</div><div className="page-subtitle">Business analytics & exports</div></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" value={fromD} onChange={e => setFromD(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #BDBDBD', borderRadius: 4, fontSize: 12 }} />
          <span style={{ fontSize: 12, color: '#757575' }}>to</span>
          <input type="date" value={toD} onChange={e => setToD(e.target.value)} style={{ padding: '5px 8px', border: '1px solid #BDBDBD', borderRadius: 4, fontSize: 12 }} />
          {active && <>
            <button className="btn btn-primary btn-sm" onClick={doExportCSV}>📊 Export Excel</button>
            <button className="btn btn-gray btn-sm" onClick={doExportPDF}>📄 Export PDF</button>
          </>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 12, marginBottom: 20 }}>
        {REPORT_LIST.map(r => (
          <div key={r.id} className="card" style={{ padding: 16, cursor: 'pointer', border: active === r.id ? '2px solid #1976D2' : '1px solid #E0E0E0' }} onClick={() => viewReport(r.id)}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{r.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{r.title}</div>
            <div style={{ fontSize: 11, color: '#9E9E9E', marginBottom: 10 }}>{r.desc}</div>
            <button className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}>📋 View</button>
          </div>
        ))}
      </div>
      {active && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F5F5F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700 }}>{REPORT_LIST.find(r => r.id === active)?.title} <span style={{ color: '#9E9E9E', fontWeight: 400, fontSize: 12 }}>({reportData.length} records)</span></span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={doExportCSV}>📊 Export Excel</button>
              <button className="btn btn-gray btn-sm" onClick={doExportPDF}>📄 Export PDF</button>
              <button className="btn btn-gray btn-sm" onClick={() => setActive(null)}>✕ Close</button>
            </div>
          </div>
          {reportData.length === 0 ? <div className="empty-state"><div className="icon">📊</div><p>No data for selected period</p></div> : (
            <div className="tbl-wrap">
              {active === 'sale' && <table><thead><tr><th>Invoice#</th><th>Date</th><th>Customer</th><th>Payment</th><th>Amount</th><th>Status</th></tr></thead><tbody>{reportData.map((i, x) => <tr key={x}><td style={{ fontWeight: 600 }}>#{i.invoiceNo}</td><td>{i.date}</td><td>{i.customer?.name || i.custSearch || '—'}</td><td>{i.paymentType}</td><td style={{ fontWeight: 700 }}>₹{(i.grandTotal || 0).toLocaleString()}</td><td><span className={`badge badge-${i.status === 'paid' ? 'green' : i.status === 'overdue' ? 'red' : 'orange'}`}>{(i.status || '').toUpperCase()}</span></td></tr>)}</tbody></table>}
              {active === 'purchase' && <table><thead><tr><th>Purchase#</th><th>Date</th><th>Supplier</th><th>Payment</th><th>Amount</th><th>Status</th></tr></thead><tbody>{reportData.map((p, x) => <tr key={x}><td style={{ fontWeight: 600 }}>#{p.purchaseNo}</td><td>{p.date}</td><td>{p.supplier?.name || '—'}</td><td>{p.paymentType}</td><td style={{ fontWeight: 700 }}>₹{(p.grandTotal || 0).toLocaleString()}</td><td><span className={`badge badge-${p.status === 'paid' ? 'green' : p.status === 'overdue' ? 'red' : 'orange'}`}>{(p.status || '').toUpperCase()}</span></td></tr>)}</tbody></table>}
              {active === 'expense' && <table><thead><tr><th>Name</th><th>Category</th><th>Amount</th><th>Date</th><th>Pay Mode</th></tr></thead><tbody>{reportData.map((e, x) => <tr key={x}><td style={{ fontWeight: 600 }}>{e.name}</td><td><span className="badge badge-purple">{e.cat}</span></td><td style={{ fontWeight: 700, color: '#C62828' }}>₹{(e.amount || 0).toLocaleString()}</td><td>{e.date}</td><td>{e.payMode || 'Cash'}</td></tr>)}</tbody></table>}
              {active === 'stock' && (
                <table>
                  <thead>
                    <tr>
                      <th>Product ID</th>
                      <th>Product Name</th>
                      <th>SKU</th>
                      <th>Purchase In</th>
                      <th>Sale Out</th>
                      <th>Total Balance Stock</th>
                      <th>Purchase Price Value</th>
                      <th>Sale Value</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((p, x) => (
                      <tr key={x}>
                        <td style={{ fontSize: 11, color: '#757575' }}>{p.id}</td>
                        <td style={{ fontWeight: 600 }}>{p.name || ''}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.sku || ''}</td>
                        <td style={{ fontWeight: 600, color: '#1565C0' }}>{p.purchaseIn || 0}</td>
                        <td style={{ fontWeight: 600, color: '#C62828' }}>{p.saleOut || 0}</td>
                        <td style={{ fontWeight: 700, color: p.balance === 0 ? '#C62828' : p.balance <= p.min ? '#E65100' : '#2E7D32' }}>{p.balance || 0}</td>
                        <td style={{ fontWeight: 600, color: '#2E7D32' }}>₹{((p.balance || 0) * (p.cost || 0)).toLocaleString()}</td>
                        <td style={{ fontWeight: 600, color: '#1565C0' }}>₹{((p.balance || 0) * (p.price || 0)).toLocaleString()}</td>
                        <td>{p.balance === 0 ? <span className="badge badge-red">Out</span> : p.balance <= (p.min || 0) ? <span className="badge badge-orange">Low</span> : <span className="badge badge-green">OK</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {active === 'party' && <table><thead><tr><th>Type</th><th>Name</th><th>Mobile</th><th>GSTIN</th><th>City</th></tr></thead><tbody>{reportData.map((p, x) => <tr key={x}><td><span className={`badge badge-${p.type === 'customer' ? 'blue' : 'orange'}`}>{p.type || ''}</span></td><td style={{ fontWeight: 600 }}>{p.name}</td><td>{p.mobile || '—'}</td><td style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.gstin || '—'}</td><td>{p.city || '—'}</td></tr>)}</tbody></table>}
              {active === 'gstr_1_all' && <table><thead><tr><th>GST Type</th><th>Invoice#</th><th>Date</th><th>Customer</th><th>GSTIN</th><th>Amount</th><th>Status</th></tr></thead><tbody>{reportData.map((i, x) => <tr key={x}><td><span className={`badge badge-${i.gstType === 'B2B' ? 'blue' : 'green'}`}>{i.gstType}</span></td><td style={{ fontWeight: 600 }}>#{i.invoiceNo}</td><td>{i.date}</td><td>{i.customer?.name || '—'}</td><td style={{ fontFamily: 'monospace', fontSize: 11 }}>{i.customer?.gstin || '—'}</td><td style={{ fontWeight: 700 }}>₹{(i.grandTotal || 0).toLocaleString()}</td><td><span className={`badge badge-${i.status === 'paid' ? 'green' : i.status === 'overdue' ? 'red' : 'orange'}`}>{(i.status || '').toUpperCase()}</span></td></tr>)}</tbody></table>}
              {active === 'pl' && <table><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody>{reportData.map((r, x) => <tr key={x}><td style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</td><td style={{ fontWeight: 800, color: r.color, fontSize: 16 }}>₹{r.amount.toLocaleString()}</td></tr>)}</tbody></table>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// PRINT THEMES
// ════════════════════════════════════════════════════════════════
const THEMES = [
  { id: 'padmavathi', name: 'Sri Padmavathi Classic', header: '#fff', headerText: '#000', accent: '#000', tableBg: '#f8f8f8', layout: 'classic' },
  { id: 'blue', name: 'Blue Corporate', header: '#1565C0', headerText: '#fff', accent: '#1565C0', tableBg: '#E3F2FD', layout: 'corporate' },
  { id: 'green', name: 'Green Eco', header: '#2E7D32', headerText: '#fff', accent: '#2E7D32', tableBg: '#E8F5E9', layout: 'eco' },
  { id: 'red', name: 'Royal Red', header: '#B71C1C', headerText: '#fff', accent: '#B71C1C', tableBg: '#FFEBEE', layout: 'royal' },
  { id: 'purple', name: 'Purple Elite', header: '#6A1B9A', headerText: '#fff', accent: '#6A1B9A', tableBg: '#F3E5F5', layout: 'elite' },
  { id: 'dark', name: 'Modern Dark', header: '#212121', headerText: '#FFD600', accent: '#FFD600', tableBg: '#424242', layout: 'dark' },
  { id: 'orange', name: 'Warm Sunset', header: '#E65100', headerText: '#fff', accent: '#E65100', tableBg: '#FFF3E0', layout: 'sunset' },
  { id: 'teal', name: 'Teal Ocean', header: '#00695C', headerText: '#fff', accent: '#00695C', tableBg: '#E0F2F1', layout: 'ocean' },
  { id: 'pink', name: 'Rose Gold', header: '#880E4F', headerText: '#fff', accent: '#880E4F', tableBg: '#FCE4EC', layout: 'rosegold' },
  { id: 'minimal', name: 'Minimal Clean', header: '#fff', headerText: '#212121', accent: '#212121', tableBg: '#fff', layout: 'minimal' },
]

function ThemePreview({ theme, biz }) {
  const co = biz.businessName || 'My Company'
  // Each theme renders a truly unique preview layout
  if (theme.layout === 'classic') {
    // Classic bordered, centered header, traditional look
    return (<div style={{ fontSize: 9 }}>
      <div style={{ textAlign: 'center', padding: '10px 12px', borderBottom: '2px double #000' }}>
        <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' }}>{co}</div>
        <div style={{ fontSize: 8, color: '#555', marginTop: 2 }}>GSTIN: 33XXXXX · Ph: 98765XXXXX</div>
        <div style={{ fontSize: 10, fontWeight: 700, marginTop: 6, border: '1px solid #000', display: 'inline-block', padding: '1px 14px', letterSpacing: 2 }}>TAX INVOICE</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 12px', borderBottom: '1px solid #ccc', fontSize: 8 }}>
        <span><b>Bill To:</b> Sample Customer</span><span><b>Inv#</b> 001 · <b>Date:</b> 01/04/2026</span>
      </div>
      <div style={{ padding: '4px 12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ borderBottom: '1px solid #000', borderTop: '1px solid #000' }}><th style={{ padding: '2px 4px', textAlign: 'left', fontSize: 8 }}>Item</th><th style={{ textAlign: 'center', fontSize: 8 }}>Qty</th><th style={{ textAlign: 'right', fontSize: 8 }}>Rate</th><th style={{ textAlign: 'right', fontSize: 8 }}>Amount</th></tr></thead>
          <tbody><tr><td style={{ padding: '2px 4px', fontSize: 8 }}>Cement 50kg</td><td style={{ textAlign: 'center', fontSize: 8 }}>20</td><td style={{ textAlign: 'right', fontSize: 8 }}>₹290</td><td style={{ textAlign: 'right', fontSize: 8, fontWeight: 700 }}>₹5,800</td></tr></tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 12px', borderTop: '2px double #000', fontWeight: 800, fontSize: 10 }}>
        <span>GRAND TOTAL</span><span>₹6,200</span>
      </div>
    </div>)
  }
  if (theme.layout === 'corporate') {
    // Left accent bar, sidebar-style info, modern corporate
    return (<div style={{ fontSize: 9, display: 'flex', minHeight: 145 }}>
      <div style={{ width: 6, background: 'linear-gradient(to bottom, #1565C0, #0D47A1)', borderRadius: '4px 0 0 4px', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ background: '#1565C0', color: '#fff', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div style={{ fontWeight: 800, fontSize: 13 }}>{co}</div><div style={{ fontSize: 8, opacity: 0.8 }}>GSTIN: 33XXXXX</div></div>
          <div style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 3, fontSize: 9, fontWeight: 700 }}>TAX INVOICE</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderBottom: '1px solid #E3F2FD' }}>
          <div style={{ padding: '5px 12px', borderRight: '1px solid #E3F2FD', background: '#F5F9FF' }}><div style={{ fontSize: 7, color: '#1565C0', fontWeight: 700, textTransform: 'uppercase' }}>Bill To</div><div style={{ fontWeight: 600, fontSize: 9 }}>Sample Customer</div></div>
          <div style={{ padding: '5px 12px', background: '#F5F9FF' }}><div style={{ fontSize: 7, color: '#1565C0', fontWeight: 700, textTransform: 'uppercase' }}>Invoice Details</div><div style={{ fontSize: 8 }}>#001 · 01/04/2026</div></div>
        </div>
        <div style={{ padding: '4px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #E3F2FD', fontSize: 8 }}><span>Cement 50kg × 20</span><span style={{ fontWeight: 700 }}>₹5,800</span></div>
        </div>
        <div style={{ background: '#1565C0', color: '#fff', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, borderRadius: '0 0 4px 0' }}>
          <span>GRAND TOTAL</span><span>₹6,200</span>
        </div>
      </div>
    </div>)
  }
  if (theme.layout === 'eco') {
    // Rounded corners, pill-shaped elements, nature feel
    return (<div style={{ fontSize: 9, background: '#fafff9' }}>
      <div style={{ background: 'linear-gradient(135deg, #2E7D32, #43A047)', color: '#fff', padding: '10px 14px', borderRadius: '6px 6px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ fontWeight: 800, fontSize: 12 }}>🌿 {co}</div><div style={{ fontSize: 7, opacity: 0.8 }}>Eco Friendly Invoice</div></div>
        <div style={{ background: 'rgba(255,255,255,0.25)', padding: '4px 12px', borderRadius: 20, fontSize: 9, fontWeight: 700 }}>TAX INVOICE</div>
      </div>
      <div style={{ padding: '6px 14px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ background: '#E8F5E9', padding: '2px 8px', borderRadius: 10, fontSize: 8, fontWeight: 600, color: '#2E7D32' }}>📋 #001</span>
        <span style={{ background: '#E8F5E9', padding: '2px 8px', borderRadius: 10, fontSize: 8, fontWeight: 600, color: '#2E7D32' }}>👤 Sample Customer</span>
        <span style={{ background: '#E8F5E9', padding: '2px 8px', borderRadius: 10, fontSize: 8, fontWeight: 600, color: '#2E7D32' }}>📅 01/04/2026</span>
      </div>
      <div style={{ margin: '2px 14px', background: '#E8F5E9', borderRadius: 6, padding: '4px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, padding: '2px 0' }}><span>Cement 50kg (×20)</span><b>₹5,800</b></div>
      </div>
      <div style={{ margin: '6px 14px 10px', background: '#2E7D32', color: '#fff', padding: '7px 12px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 10 }}>
        <span>TOTAL</span><span>₹6,200</span>
      </div>
    </div>)
  }
  if (theme.layout === 'royal') {
    // Ornate borders, serif-like feel, premium red
    return (<div style={{ fontSize: 9, border: '2px solid #B71C1C', margin: 2 }}>
      <div style={{ borderBottom: '3px double #B71C1C', padding: '8px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: 7, color: '#B71C1C', letterSpacing: 4, fontWeight: 600 }}>★ ROYAL INVOICE ★</div>
        <div style={{ fontWeight: 900, fontSize: 15, color: '#B71C1C', marginTop: 2, fontFamily: 'Georgia, serif' }}>{co}</div>
        <div style={{ fontSize: 8, color: '#777', marginTop: 1 }}>GSTIN: 33XXXXX · Trusted Since 2020</div>
      </div>
      <div style={{ display: 'flex', borderBottom: '1px solid #FFCDD2' }}>
        <div style={{ flex: 1, padding: '5px 12px', borderRight: '1px solid #FFCDD2' }}><div style={{ fontSize: 7, color: '#B71C1C', fontWeight: 700 }}>BILLED TO</div><div style={{ fontWeight: 600, fontSize: 9 }}>Sample Customer</div></div>
        <div style={{ padding: '5px 12px', textAlign: 'right' }}><div style={{ fontSize: 7, color: '#B71C1C', fontWeight: 700 }}>INV #001</div><div style={{ fontSize: 8 }}>01/04/2026</div></div>
      </div>
      <div style={{ padding: '3px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, padding: '3px 0', borderBottom: '1px dotted #FFCDD2' }}><span>Cement 50kg × 20</span><b>₹5,800</b></div>
      </div>
      <div style={{ background: '#B71C1C', color: '#fff', padding: '6px 12px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 11 }}>
        <span>GRAND TOTAL</span><span>₹6,200</span>
      </div>
    </div>)
  }
  if (theme.layout === 'elite') {
    // Diagonal header, gradient accent, luxury card
    return (<div style={{ fontSize: 9, overflow: 'hidden' }}>
      <div style={{ background: 'linear-gradient(135deg, #6A1B9A 0%, #9C27B0 50%, #CE93D8 100%)', color: '#fff', padding: '12px 14px', position: 'relative' }}>
        <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 0.5 }}>{co}</div>
        <div style={{ fontSize: 8, opacity: 0.75, marginTop: 1 }}>GSTIN: 33XXXXX</div>
        <div style={{ position: 'absolute', right: 12, top: 8, background: 'rgba(255,255,255,0.2)', padding: '6px 14px', borderRadius: 4, fontWeight: 800, fontSize: 10, backdropFilter: 'blur(4px)' }}>TAX INVOICE</div>
      </div>
      <div style={{ background: '#F3E5F5', padding: '5px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 8

, borderLeft: '4px solid #6A1B9A' }}>
        <span><b>Bill To:</b> Sample Customer</span><span><b>#001</b> · 01/04/2026</span>
      </div>
      <div style={{ padding: '4px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, padding: '4px 0', borderBottom: '1px solid #F3E5F5' }}><span style={{ color: '#6A1B9A' }}>● Cement 50kg × 20</span><b>₹5,800</b></div>
      </div>
      <div style={{ background: 'linear-gradient(90deg, #6A1B9A, #9C27B0)', color: '#fff', padding: '7px 14px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 11 }}>
        <span>TOTAL</span><span>₹6,200</span>
      </div>
    </div>)
  }
  if (theme.layout === 'dark') {
    // Dark mode, neon-gold accents, sleek modern
    return (<div style={{ fontSize: 9, background: '#1a1a1a', color: '#e0e0e0', borderRadius: 6 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ fontWeight: 900, fontSize: 14, color: '#FFD600' }}>{co}</div><div style={{ fontSize: 7, color: '#777' }}>GSTIN: 33XXXXX</div></div>
        <div style={{ border: '1px solid #FFD600', color: '#FFD600', padding: '3px 10px', borderRadius: 3, fontWeight: 700, fontSize: 9 }}>TAX INVOICE</div>
      </div>
      <div style={{ padding: '5px 14px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', fontSize: 8 }}>
        <span style={{ color: '#aaa' }}>👤 Sample Customer</span><span style={{ color: '#FFD600' }}>#001</span>
      </div>
      <div style={{ padding: '4px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, padding: '4px 0', borderBottom: '1px solid #333' }}><span style={{ color: '#bbb' }}>Cement 50kg × 20</span><span style={{ color: '#FFD600', fontWeight: 700 }}>₹5,800</span></div>
      </div>
      <div style={{ padding: '8px 14px', borderTop: '1px solid #FFD600', display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 11, color: '#FFD600', borderRadius: '0 0 6px 6px' }}>
        <span>TOTAL</span><span>₹6,200</span>
      </div>
    </div>)
  }
  if (theme.layout === 'sunset') {
    // Warm gradient header, card-style items, playful
    return (<div style={{ fontSize: 9 }}>
      <div style={{ background: 'linear-gradient(to right, #E65100, #FF8F00, #FFB300)', color: '#fff', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div><div style={{ fontWeight: 900, fontSize: 13 }}>{co}</div><div style={{ fontSize: 7, opacity: 0.85 }}>GSTIN: 33XXXXX</div></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1 }}>INVOICE</div><div style={{ fontSize: 7, opacity: 0.8 }}>#001 · 01/04/2026</div></div>
      </div>
      <div style={{ padding: '5px 14px', background: '#FFF8E1', borderBottom: '2px solid #FFB300', fontSize: 8 }}>
        <b style={{ color: '#E65100' }}>Bill To:</b> Sample Customer · GSTIN: 33BXXX
      </div>
      <div style={{ padding: '5px 14px' }}>
        <div style={{ background: '#FFF3E0', borderRadius: 6, padding: '5px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 8, border: '1px solid #FFE0B2' }}>
          <div><b>Cement 50kg</b><br /><span style={{ color: '#999', fontSize: 7 }}>Qty: 20 · Rate: ₹290</span></div>
          <b style={{ fontSize: 10, color: '#E65100' }}>₹5,800</b>
        </div>
      </div>
      <div style={{ margin: '4px 14px 8px', background: '#E65100', color: '#fff', padding: '7px 12px', borderRadius: 6, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 11 }}>
        <span>TOTAL</span><span>₹6,200</span>
      </div>
    </div>)
  }
  if (theme.layout === 'ocean') {
    // Wave accent, horizontal stripes, oceanic feel
    return (<div style={{ fontSize: 9 }}>
      <div style={{ background: '#00695C', color: '#fff', padding: '8px 14px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: -8, right: -10, width: 80, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', bottom: -5, right: 30, width: 60, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ fontWeight: 800, fontSize: 12, position: 'relative' }}>{co}</div>
        <div style={{ fontSize: 7, opacity: 0.7, position: 'relative' }}>GSTIN: 33XXXXX</div>
      </div>
      <div style={{ display: 'flex', borderBottom: '3px solid #00695C' }}>
        <div style={{ flex: 1, padding: '5px 14px', background: '#E0F2F1' }}><div style={{ fontSize: 7, color: '#00695C', fontWeight: 700 }}>CUSTOMER</div><div style={{ fontWeight: 600 }}>Sample Customer</div></div>
        <div style={{ padding: '5px 14px', background: '#B2DFDB', textAlign: 'center' }}><div style={{ fontSize: 7, color: '#00695C', fontWeight: 700 }}>INVOICE</div><div style={{ fontWeight: 800, fontSize: 11, color: '#00695C' }}>#001</div></div>
      </div>
      <div style={{ padding: '3px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #E0F2F1', fontSize: 8 }}><span>Cement 50kg × 20</span><b style={{ color: '#00695C' }}>₹5,800</b></div>
      </div>
      <div style={{ background: 'linear-gradient(to right, #00695C, #00897B)', color: '#fff', padding: '7px 14px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 11 }}>
        <span>TOTAL</span><span>₹6,200</span>
      </div>
    </div>)
  }
  if (theme.layout === 'rosegold') {
    // Elegant, thin borders, feminine aesthetic, centered
    return (<div style={{ fontSize: 9, background: '#FFF9FB' }}>
      <div style={{ textAlign: 'center', padding: '10px 14px', borderBottom: '1px solid #F8BBD0' }}>
        <div style={{ fontWeight: 300, fontSize: 8, letterSpacing: 5, color: '#880E4F', textTransform: 'uppercase' }}>Tax Invoice</div>
        <div style={{ fontWeight: 800, fontSize: 15, color: '#880E4F', marginTop: 2, fontFamily: 'Georgia, serif' }}>{co}</div>
        <div style={{ fontSize: 7, color: '#C2185B', marginTop: 1 }}>GSTIN: 33XXXXX · Contact: 98765XXXXX</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', padding: '5px 14px', borderBottom: '1px solid #FCE4EC', fontSize: 8, color: '#880E4F' }}>
        <span>📋 <b>#001</b></span>
        <span>📅 01/04/2026</span>
        <span>👤 Sample Customer</span>
      </div>
      <div style={{ padding: '4px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderLeft: '3px solid #F48FB1', marginBottom: 2, fontSize: 8, background: '#FCE4EC', borderRadius: '0 4px 4px 0' }}><span>Cement 50kg × 20</span><b>₹5,800</b></div>
      </div>
      <div style={{ textAlign: 'center', padding: '8px 14px', borderTop: '1px solid #F8BBD0' }}>
        <div style={{ fontSize: 8, color: '#880E4F' }}>Grand Total</div>
        <div style={{ fontWeight: 900, fontSize: 16, color: '#880E4F' }}>₹6,200</div>
      </div>
    </div>)
  }
  // minimal layout — default
  return (<div style={{ fontSize: 9 }}>
    <div style={{ padding: '12px 14px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: '#222' }}>{co}</div>
      <div style={{ fontSize: 8, color: '#999' }}>GSTIN: 33XXXXX</div>
    </div>
    <div style={{ padding: '4px 14px', fontSize: 8, color: '#666' }}>
      <b style={{ color: '#333' }}>Invoice</b> #001 &nbsp;·&nbsp; 01/04/2026 &nbsp;·&nbsp; Sample Customer
    </div>
    <div style={{ padding: '3px 14px', borderTop: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, padding: '4px 0' }}><span style={{ color: '#444' }}>Cement 50kg × 20</span><b>₹5,800</b></div>
    </div>
    <div style={{ padding: '8px 14px', borderTop: '2px solid #222', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 11 }}>
      <span>TOTAL</span><span>₹6,200</span>
    </div>
  </div>)
}

export function PrintThemes() {
  const [selected, setSelected] = useState('classic')
  const biz = getBiz()
  
  useEffect(() => {
    getSettings().then(res => {
      if (res.data?.printTheme) setSelected(res.data.printTheme || 'classic')
    })
  }, [])

  async function apply(id) { 
    setSelected(id)
    try { 
      await saveSettings({ printTheme: id })
      alert(`✅ Theme "${THEMES.find(t => t.id === id)?.name}" applied!`) 
    } catch(err) { alert('Failed to save theme setting') }
  }
  return (
    <div className="page-wrap">
      <div className="page-head">
        <div><div className="page-title">Print Themes</div><div className="page-subtitle">Choose your invoice style · Active: <b style={{ color: '#1565C0' }}>{THEMES.find(t => t.id === selected)?.name}</b></div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 18 }}>
        {THEMES.map(theme => (
          <div key={theme.id} className="card" style={{ overflow: 'hidden', border: selected === theme.id ? '3px solid #1976D2' : '1px solid #E0E0E0', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', borderRadius: 8 }}
            onClick={() => apply(theme.id)}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}>
            {/* Unique preview per theme */}
            <ThemePreview theme={theme} biz={biz} />
            {/* Footer with name + active badge */}
            <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{theme.name}</span>
              {selected === theme.id
                ? <span style={{ background: '#E3F2FD', color: '#1565C0', padding: '4px 12px', borderRadius: 14, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>✓ Active</span>
                : <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); apply(theme.id) }}>Apply</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// SETTINGS — saves to localStorage + backend
// ════════════════════════════════════════════════════════════════
export function Settings() {
  const currentUser = JSON.parse(localStorage.getItem('inv_user') || '{}')
  const canAccess = ['owner', 'manager'].includes((currentUser.role || '').toLowerCase())

  if (!canAccess) return (
    <div className="page-wrap">
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Access Restricted</div>
        <div style={{ fontSize: 14, color: '#757575', maxWidth: 400, margin: '0 auto' }}>
          Only <b>Owner</b> and <b>Manager</b> can access Profile.<br />Please login with Owner or Manager credentials.
        </div>
        <div style={{ marginTop: 20, padding: '12px 20px', background: '#FFF3E0', borderRadius: 6, display: 'inline-block', fontSize: 13 }}>
          Current role: <b style={{ color: '#E65100' }}>{currentUser.role || 'Unknown'}</b>
        </div>
      </div>
    </div>
  )

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState(() => ({ businessName: 'Invoxira Cloud', ownerName: '', gstin: '', mobile: '', email: '', address: '', city: '', state: 'Tamil Nadu', pincode: '', logo: '', signature: '', bankName: '', accountNo: '', ifsc: '', upi: '', ...getBiz() }))

  
  useEffect(() => {
    getSettings().then(res => {
      if (res.data) setForm(p => ({ ...p, ...res.data }))
    }).catch(console.error)
  }, [])

  const ff = v => setForm(p => ({ ...p, ...v }))
  const logoRef = useRef()
  const signatureRef = useRef()

  async function save() {
    setSaving(true)
    try {
      await saveSettings(form)
      localStorage.setItem('inv_biz', JSON.stringify(form))
      localStorage.setItem('bizcloud_biz_profile', JSON.stringify(form))
      window.dispatchEvent(new Event('biz_updated'))
      setMsg('✅ Profile saved!'); setTimeout(() => setMsg(''), 3000)
    } catch (e) {
      console.error('Save failed:', e)
      alert('❌ Save failed: ' + (e.response?.data?.message || e.message))
    } finally {
      setSaving(false)
    }
  }


  function compressImage(file, callback) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        const max = 1200 // Max dimension
        if (width > max || height > max) {
          if (width > height) { height *= max / width; width = max }
          else { width *= max / height; height = max }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/webp', 0.8) // Use WebP for better compression
        callback(dataUrl)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  }
  function handleLogo(e) {
    const file = e.target.files[0]; if (!file) return
    if (file.size > 1048576) { alert('Logo too large. Use image under 1MB'); return }
    compressImage(file, (dataUrl) => ff({ logo: dataUrl }))
  }
  function handleSignature(e) {
    const file = e.target.files[0]; if (!file) return
    if (file.size > 1048576) { alert('Signature too large. Use image under 1MB'); return }
    compressImage(file, (dataUrl) => ff({ signature: dataUrl }))
  }

  return (
    <div className="page-wrap">
      {msg && <div style={{ padding: '8px 14px', background: '#E8F5E9', color: '#2E7D32', borderRadius: 4, marginBottom: 12, fontWeight: 600, fontSize: 13 }}>{msg}</div>}
      <div className="page-head">
        <div><div className="page-title">Profile</div><div className="page-subtitle">Business profile & bank details</div></div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '⏳ Saving...' : '💾 Save Profile'}</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#1565C0' }}>🏢 Business Profile</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="form-label">Business Logo</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                <div style={{ width: 60, height: 60, borderRadius: 8, border: '2px solid #E0E0E0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F5F5' }}>
                  {form.logo ? <img src={form.logo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>🏢</span>}
                </div>
                <div>
                  <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogo} />
                  <button className="btn btn-outline btn-sm" onClick={() => logoRef.current.click()}>📁 Choose Logo</button>
                  {form.logo && <button className="btn btn-gray btn-sm" style={{ marginLeft: 6 }} onClick={() => ff({ logo: '' })}>🗑️ Remove</button>}
                  <div style={{ fontSize: 10, color: '#9E9E9E', marginTop: 4 }}>PNG/JPG under 1MB</div>
                </div>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Company / Business Name *</label><input className="form-input" value={form.businessName} onChange={e => ff({ businessName: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Owner Name</label><input className="form-input" value={form.ownerName} onChange={e => ff({ ownerName: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">GSTIN</label><input className="form-input" value={form.gstin} onChange={e => ff({ gstin: e.target.value.toUpperCase() })} maxLength={15} placeholder="15-digit GSTIN" /></div>
            <div className="form-group"><label className="form-label">Mobile</label><input className="form-input" value={form.mobile} onChange={e => ff({ mobile: e.target.value })} maxLength={10} /></div>
            <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => ff({ email: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Address</label><textarea style={{ width: '100%', padding: '8px 10px', border: '1px solid #E0E0E0', borderRadius: 4, fontSize: 13, minHeight: 70 }} value={form.address} onChange={e => ff({ address: e.target.value })} /></div>
            <div>
              <label className="form-label">Authorized Signature</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                <div style={{ width: 120, height: 60, borderRadius: 8, border: '2px solid #E0E0E0', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F5F5' }}>
                  {form.signature ? <img src={form.signature} alt="signature" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: 18, color: '#9E9E9E' }}>SIGN HERE</span>}
                </div>
                <div>
                  <input ref={signatureRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSignature} />
                  <button className="btn btn-outline btn-sm" onClick={() => signatureRef.current.click()}>🖋️ Change Signature</button>
                  {form.signature && <button className="btn btn-gray btn-sm" style={{ marginLeft: 6 }} onClick={() => ff({ signature: '' })}>🗑️ Remove</button>}
                  <div style={{ fontSize: 10, color: '#9E9E9E', marginTop: 4 }}>PNG/JPG under 1MB (Transparent recommended)</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group"><label className="form-label">City</label><input className="form-input" value={form.city} onChange={e => ff({ city: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Pincode</label><input className="form-input" value={form.pincode} onChange={e => ff({ pincode: e.target.value })} maxLength={6} /></div>
            </div>
            <div className="form-group"><label className="form-label">State</label><select className="form-select" value={form.state} onChange={e => ff({ state: e.target.value })}>{STATES.map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#2E7D32' }}>🏦 Bank Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group"><label className="form-label">Bank Name</label><input className="form-input" value={form.bankName} onChange={e => ff({ bankName: e.target.value })} placeholder="e.g. CANARA BANK" /></div>
            <div className="form-group"><label className="form-label">Account Number</label><input className="form-input" value={form.accountNo} onChange={e => ff({ accountNo: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">IFSC Code</label><input className="form-input" value={form.ifsc} onChange={e => ff({ ifsc: e.target.value.toUpperCase() })} placeholder="CNRB0002926" /></div>
            <div className="form-group"><label className="form-label">UPI ID / Account Holder Name</label><input className="form-input" value={form.upi} onChange={e => ff({ upi: e.target.value })} /></div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving} style={{ padding: '10px 28px' }}>
          {saving ? '⏳ Saving...' : '💾 Save Profile'}
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// FY CLOSING PAGE
// ════════════════════════════════════════════════════════════════
export function FYClosing() {
  const [allYears, setAllYears] = useState([])
  const [activeFY, setActiveFYState] = useState(getActiveFY())
  const [closing, setClosing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showArchive, setShowArchive] = useState(null)

  const from = activeFY.slice(0, 4) + '-04-01'
  const to = activeFY.slice(5) + '-03-31'

  useEffect(() => {
    import('../utils/fy').then(m => setAllYears(m.getAllStoredYears()))
    const handler = (e) => {
      setActiveFYState(e.detail.fy)
      import('../utils/fy').then(m => setAllYears(m.getAllStoredYears()))
    }
    window.addEventListener('fy_changed', handler)
    return () => window.removeEventListener('fy_changed', handler)
  }, [])

  function handleClose() {
    if (!isOwnerOrManager()) { alert('Only Owner/Manager can close financial year'); return }
    setShowModal(true)
  }

  function confirmClose() {
    setClosing(true)
    import('../utils/fy').then(m => {
      const result = m.closeFinancialYear(activeFY)
      setClosing(false)
      setShowModal(false)
      if (result.success) {
        alert(`✅ ${result.message}`)
        setAllYears(m.getAllStoredYears())
      } else {
        alert(`❌ ${result.message}`)
      }
    })
  }

  return (
    <div className="page-wrap">
      <div className="page-head">
        <div><div className="page-title">FY Closing & Archives</div><div className="page-subtitle">Close financial years and view historical data</div></div>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: '#1565C0' }}>🔒 Close Current Financial Year</div>
        <div style={{ background: '#FFF3E0', borderRadius: 8, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#E65100', fontWeight: 600, marginBottom: 2 }}>ACTIVE FINANCIAL YEAR</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#E65100' }}>FY {getFYLabel(activeFY)}</div>
              <div style={{ fontSize: 12, color: '#E65100', marginTop: 4 }}>{from} to {to}</div>
            </div>
            <div>
              {!isFYClosed(activeFY) ? (
                <button onClick={handleClose} style={{ padding: '10px 18px', background: '#E65100', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  🔒 Close Financial Year {getFYLabel(activeFY)}
                </button>
              ) : (
                <div style={{ padding: '8px 14px', background: '#FFE0B2', color: '#D84315', borderRadius: 6, fontWeight: 700 }}>
                  ✅ Already Closed
                </div>
              )}
            </div>
          </div>
          <p style={{ marginTop: 12, fontSize: 13, color: '#6A1B9A', fontWeight: 600 }}>Note: Even after closing, you can still edit records if needed!</p>
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: '#424242' }}>All Financial Years</div>
        </div>
        <FinancialYearManager />
      </div>

      {/* Close FY Confirmation Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, maxWidth: 480, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>🔒</div>
            <div style={{ fontWeight: 800, fontSize: 18, textAlign: 'center', marginBottom: 8 }}>Close Financial Year?</div>
            <div style={{ fontSize: 13, color: '#757575', textAlign: 'center', marginBottom: 6 }}>FY {getFYLabel(activeFY)} · {from} to {to}</div>
            <div style={{ background: '#FFF3E0', borderRadius: 6, padding: 14, marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: '#E65100', marginBottom: 6 }}>⚠️ Before you close:</div>
              <ul style={{ paddingLeft: 18, color: '#616161', lineHeight: 2 }}>
                <li>A frozen snapshot of this year will be saved to your Archives.</li>
                <li>You can access this snapshot anytime.</li>
                <li>Active data will remain editable!</li>
                <li>A new financial year will start automatically.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button disabled={closing} onClick={() => setShowModal(false)} className="btn btn-gray">Cancel</button>
              <button disabled={closing} onClick={confirmClose} className="btn btn-primary" style={{ background: '#D84315' }}>
                {closing ? 'Closing...' : 'Yes, Close Year'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// CREDIT / DEBIT NOTE — localStorage based
// ════════════════════════════════════════════════════════════════
const CDN_TYPES = ['Credit Note', 'Debit Note']
const emptyCDN = { type: 'Credit Note', number: '', date: TODAY, partyName: '', reason: '', refInvoice: '', amount: 0, notes: '' }

export function CreditDebitNote() {
  const [activeFYCDN, setActiveFY] = useState(getActiveFY())
  useEffect(() => {
    const h = (e) => setActiveFY(e.detail.fy)
    window.addEventListener('fy_changed', h)
    return () => window.removeEventListener('fy_changed', h)
  }, [])
  const fyROCDN = isFYClosed(activeFYCDN)
  const [notes, setNotes] = useState([])
  
  useEffect(() => { loadNotes() }, [activeFYCDN])
  async function loadNotes() {
    try { const { data } = await getNotes(); setNotes(data || []) }
    catch (err) { console.error('Load notes error:', err) }
  }
  

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ ...emptyCDN, date: getDefaultDateForFY(activeFYCDN) })
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [msg, setMsg] = useState('')
  const ff = v => setForm(p => ({ ...p, ...v }))

  function nextNo() {
    if (!notes.length) return 'CDN-001'
    const max = Math.max(...notes.map(n => parseInt((n.number || '').replace(/\D/g, '')) || 0))
    return `CDN-${String(max + 1).padStart(3, '0')}`
  }

  function openAdd() {
    setForm({ ...emptyCDN, number: nextNo(), date: getDefaultDateForFY(activeFYCDN) })
    setEditId(null)
    setShowModal(true)
  }
  function openEdit(n) {
    setForm({ ...n })
    setEditId(n._id || n.id)
    setShowModal(true)
  }
  async function save() {
    if (fyROCDN) { alert(`FY ${getFYLabel(activeFYCDN)} is closed. Read-only.`); return }
    if (!validateDateInFY(form.date, activeFYCDN)) { const r = getFYRange(activeFYCDN); alert(`Date must be between ${r.from} and ${r.to} for FY ${getFYLabel(activeFYCDN)}`); return }
    if (!form.partyName) { alert('Party name required'); return }
    if (!form.amount) { alert('Amount required'); return }
    try {
      if (editId) await updateNote(editId, form)
      else await createNote(form)
      await loadNotes()
      setShowModal(false)
      setMsg('✅ Saved!')
      setTimeout(() => setMsg(''), 3000)
    } catch (err) { alert('Save failed: ' + (err.response?.data?.message || err.message)) }
  }
  async function del(id) {
    if (fyROCDN) { alert(`FY ${getFYLabel(activeFYCDN)} is closed. Cannot delete.`); return }
    if (confirm('Delete this note?')) {
      try {
        await deleteNote(id)
        await loadNotes()
        setMsg('🗑️ Deleted')
        setTimeout(() => setMsg(''), 2000)
      } catch (err) { alert('Delete failed: ' + err.message) }
    }
  }

  const filtered = notes.filter(n => {
    const ms = !search || n.partyName.toLowerCase().includes(search.toLowerCase()) || (n.number || '').includes(search)
    const mt = filterType === 'all' || n.type === filterType
    return ms && mt
  })

  const totalCredit = notes.filter(n => n.type === 'Credit Note').reduce((s, n) => s + (n.amount || 0), 0)
  const totalDebit = notes.filter(n => n.type === 'Debit Note').reduce((s, n) => s + (n.amount || 0), 0)

  return (
    <div className="page-wrap">
      {msg && <div style={{ padding: '8px 14px', background: msg.startsWith('✅') ? '#E8F5E9' : '#FFEBEE', color: msg.startsWith('✅') ? '#2E7D32' : '#C62828', borderRadius: 4, marginBottom: 12, fontWeight: 600, fontSize: 13 }}>{msg}</div>}
      {fyROCDN && <div style={{ padding: '8px 14px', background: '#FFF3E0', color: '#E65100', borderRadius: 4, marginBottom: 12, fontWeight: 600, fontSize: 13 }}>🔒 FY {getFYLabel(activeFYCDN)} is closed. View only.</div>}
      <div className="page-head">
        <div><div className="page-title">Credit / Debit Notes</div><div className="page-subtitle">{notes.length} notes</div></div>
        <button className="btn btn-primary" onClick={openAdd}>+ New Note</button>
      </div>
      <div className="stat-row" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        {[
          ['📝', 'Total Notes', notes.length, '#1565C0', '#E3F2FD'],
          ['💚', 'Credit Notes', `₹${totalCredit.toLocaleString()}`, '#2E7D32', '#E8F5E9'],
          ['💛', 'Debit Notes', `₹${totalDebit.toLocaleString()}`, '#E65100', '#FFF3E0'],
        ].map(([icon, label, val, color, bg]) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: bg, fontSize: 22 }}>{icon}</div>
            <div><div className="stat-val" style={{ color }}>{val}</div><div className="stat-label">{label}</div></div>
          </div>
        ))}
      </div>
      <div className="filter-bar">
        <div className="search-wrap"><span className="search-icon">🔍</span><input placeholder="Search party, note number..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['all', 'All'], ['Credit Note', 'Credit'], ['Debit Note', 'Debit']].map(([v, l]) => (
            <button key={v} className={`filter-btn ${filterType === v ? 'active' : ''}`} onClick={() => setFilterType(v)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Note #</th><th>Type</th><th>Date</th><th>Party</th><th>Ref Invoice</th><th>Amount</th><th>Reason</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? <tr><td colSpan={8}><div className="empty-state"><div className="icon">📝</div><p>No credit/debit notes found</p></div></td></tr>
                : filtered.map(n => (
                  <tr key={n._id || n.id}>
                    <td style={{ fontWeight: 700, color: '#1565C0' }}>{n.number}</td>
                    <td><span className={`badge badge-${n.type === 'Credit Note' ? 'green' : 'orange'}`}>{n.type}</span></td>
                    <td style={{ color: '#757575' }}>{n.date}</td>
                    <td style={{ fontWeight: 600 }}>{n.partyName}</td>
                    <td style={{ fontSize: 12, color: '#757575' }}>{n.refInvoice || '—'}</td>
                    <td style={{ fontWeight: 700, color: n.type === 'Credit Note' ? '#2E7D32' : '#E65100' }}>₹{(n.amount || 0).toLocaleString()}</td>
                    <td style={{ fontSize: 12, color: '#757575' }}>{n.reason || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => openEdit(n)}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={() => del(n._id || n.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header"><div className="modal-title">{editId ? '✏️ Edit Note' : '+ New Note'}</div><button className="modal-close" onClick={() => setShowModal(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group"><label className="form-label">Type</label><select className="form-select" value={form.type} onChange={e => ff({ type: e.target.value })}>{CDN_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                <div className="form-group"><label className="form-label">Note Number</label><input className="form-input" value={form.number} onChange={e => ff({ number: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.date} onChange={e => ff({ date: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Party Name *</label><input className="form-input" value={form.partyName} onChange={e => ff({ partyName: e.target.value })} placeholder="Customer or Supplier name" /></div>
                <div className="form-group"><label className="form-label">Reference Invoice</label><input className="form-input" value={form.refInvoice} onChange={e => ff({ refInvoice: e.target.value })} placeholder="Original invoice number" /></div>
                <div className="form-group"><label className="form-label">Amount (₹) *</label><NumInput value={form.amount} onChange={v => ff({ amount: v })} min="0" className="form-input" /></div>
                <div className="form-group col-2"><label className="form-label">Reason</label><input className="form-input" value={form.reason} onChange={e => ff({ reason: e.target.value })} placeholder="e.g. Goods returned, Price difference" /></div>
                <div className="form-group col-2"><label className="form-label">Notes</label><textarea style={{ width: '100%', padding: '8px 10px', border: '1px solid #E0E0E0', borderRadius: 4, fontSize: 13, minHeight: 60 }} value={form.notes} onChange={e => ff({ notes: e.target.value })} /></div>
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-gray" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>{editId ? 'Update' : 'Save Note'}</button></div>
          </div>
        </div>
      )}
    </div>
  )
}