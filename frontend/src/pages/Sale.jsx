import { useState, useRef, useEffect } from 'react'
import { getActiveFY, getFYLabel, isFYClosed, getDefaultDateForFY, validateDateInFY, getFYRange } from '../utils/fy'
import { getInvoices, getNextInvNo, createInvoice, updateInvoice, deleteInvoice, getProducts, createProduct, updateProduct, getCustomers, createCustomer } from '../api'

// ── NumInput — fixes 0→01 issue ────────────────────────────────
function NumInput({ value, onChange, ...props }) {
  return (
    <input {...props} type="number"
      value={value === 0 ? '' : value}
      placeholder="0"
      onFocus={e => e.target.select()}
      onBlur={e => { if (e.target.value === '' || e.target.value === undefined) onChange(0) }}
      onChange={e => { const n = parseFloat(e.target.value); onChange(isNaN(n) ? 0 : n) }}
    />
  )
}

const emptyItem = () => ({ id: Date.now()+Math.random(), name:'', hsn:'', qty:1, unit:'Nos', price:0, discount:0, gstRate:18 })
const UNITS  = ['Nos','Kg','Ltr','Mtr','Box','Pcs','Set','Pair','Bag','Bundle']
const GSTR   = [0,5,12,18,28]
const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal']
const STATE_GST = {'01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh','05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh','10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur','15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal','20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat','27':'Maharashtra','29':'Karnataka','30':'Goa','32':'Kerala','33':'Tamil Nadu','36':'Telangana'}

const SEED_CUSTOMERS = []
const SEED_PRODUCTS  = []

function calcItem(it) {
  const taxable = (it.qty||0)*(it.price||0)*(1-(it.discount||0)/100)
  const gstAmt  = taxable*((it.gstRate||0)/100)
  return { taxable, gstAmt, total: taxable+gstAmt }
}
function calcInv(form) {
  const items    = (form.items||[]).map(calcItem)
  const sub      = items.reduce((s,i)=>s+i.taxable,0)
  const gst      = items.reduce((s,i)=>s+i.gstAmt,0)
  const tr       = parseFloat(form.transport||0)
  const preTotal = sub+gst+tr
  const ro       = Math.round(preTotal)-preTotal
  const grand    = preTotal+ro
  return { items, sub, gst, tr, ro, grand }
}
function amtWords(n) {
  const a=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const b=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  function w(n){ if(n<20)return a[n]; if(n<100)return b[Math.floor(n/10)]+(n%10?' '+a[n%10]:''); if(n<1000)return a[Math.floor(n/100)]+' Hundred'+(n%100?' '+w(n%100):''); if(n<100000)return w(Math.floor(n/1000))+' Thousand'+(n%1000?' '+w(n%1000):''); if(n<10000000)return w(Math.floor(n/100000))+' Lakh'+(n%100000?' '+w(n%100000):''); return w(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+w(n%10000000):'') }
  const i=Math.floor(n), d=Math.round((n-i)*100)
  return (w(i)||'Zero')+' Rupees'+(d?' and '+w(d)+' Paise':'')+' Only'
}

const INIT_FORM = (activeFY) => ({
  invoiceNo:'', date:getDefaultDateForFY(activeFY), dueDate:'',
  paymentType:'Credit', status:'pending', custSearch:'', customer:null,
  items:[emptyItem()], transport:0, received:0,
  stateOfSupply:'Tamil Nadu', shipTo:'', poNo:'', eWayBill:'', vehicleNo:'', notes:'',
  termsConditions:'Thanks for doing business with us!'
})

export default function Sale() {
  const [activeFY, setActiveFY] = useState(getActiveFY())
  useEffect(() => {
    const h = (e) => setActiveFY(e.detail.fy)
    window.addEventListener('fy_changed', h)
    return () => window.removeEventListener('fy_changed', h)
  }, [])
  const [invoices, setInvoices] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [allCustomers, setAllCustomers] = useState([])
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState(INIT_FORM(activeFY))
  const [editId,     setEditId]     = useState(null)
  const [active,     setActive]     = useState(null)
  const [custSugg,   setCustSugg]   = useState([])
  const [itemSuggs,  setItemSuggs]  = useState({})
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo,   setFilterTo]   = useState('')
  const [filterMode, setFilterMode] = useState('')
  const [filterStat, setFilterStat] = useState('')
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const biz = JSON.parse(localStorage.getItem('inv_biz') || localStorage.getItem('bizcloud_biz_profile') || '{}')

  useEffect(() => {
    loadInvoices()
    loadProducts()
    loadCustomers()
  }, [activeFY])

  async function loadInvoices() {
    setLoading(true)
    try {
      const { data } = await getInvoices()
      setInvoices(data || [])
    } catch (err) { console.error('Load invoices error:', err) }
    setLoading(false)
  }
  async function loadProducts() {
    try { const { data } = await getProducts(); setAllProducts(data || []) } catch {}
  }
  async function loadCustomers() {
    try { const { data } = await getCustomers(); setAllCustomers(data || []) } catch {}
  }

  async function fetchNextNo() {
    try { const { data } = await getNextInvNo(); return data.next || '1' }
    catch { return String((invoices.length ? Math.max(...invoices.map(i=>parseInt(i.invoiceNo)||0)) : 0) + 1) }
  }

  const now = new Date()
  const fy  = now.getMonth()<3 ? now.getFullYear()-1 : now.getFullYear()
  function applyQuick(mode) {
    setFilterMode(mode)
    if (mode==='month') { setFilterFrom(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`); setFilterTo(new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().split('T')[0]) }
    if (mode==='year')  { const r = getFYRange(activeFY); setFilterFrom(r.from); setFilterTo(r.to) }
  }

  const filtered = invoices.filter(inv=>{
    const mFrom = !filterFrom || inv.date>=filterFrom
    const mTo   = !filterTo   || inv.date<=filterTo
    const mStat = !filterStat || inv.status===filterStat
    const mSrch = !search || inv.invoiceNo?.includes(search) || (inv.customer?.name||inv.custSearch||'').toLowerCase().includes(search.toLowerCase())
    return mFrom&&mTo&&mStat&&mSrch
  })

  const totalSale = filtered.reduce((s,i)=>s+(i.grandTotal||0),0)
  const totalPaid = filtered.filter(i=>i.status==='paid').reduce((s,i)=>s+(i.grandTotal||0),0)
  const totalPend = filtered.filter(i=>i.status==='pending').reduce((s,i)=>s+(i.grandTotal||0),0)
  const totalOvd  = filtered.filter(i=>i.status==='overdue').reduce((s,i)=>s+(i.grandTotal||0),0)
  const totalGST  = filtered.reduce((s,i)=>{ const {gst}=calcInv(i); return s+gst },0)

  const sf  = v => setForm(f=>({...f,...v}))
  const sfc = v => setForm(f=>({...f,customer:{...(f.customer||{}), ...v}}))

  async function openNew() { const no = await fetchNextNo(); setForm({...INIT_FORM(activeFY), invoiceNo:no}); setEditId(null); setCustSugg([]); setItemSuggs({}); setShowForm(true) }
  function openEdit(inv){ setForm({...inv}); setEditId(inv._id||inv.invoiceNo); setCustSugg([]); setItemSuggs({}); setShowForm(true) }

  async function saveInvoice() {
    const finalCust = form.customer || (form.custSearch ? {name:form.custSearch,mobile:'',gstin:'',address:''} : null)
    if (!finalCust) { alert('Please enter customer name'); return }
    if (form.items.some(i=>!i.name)) { alert('Fill all item names'); return }
    if (!validateDateInFY(form.date, activeFY)) { const r=getFYRange(activeFY); alert(`Date must be between ${r.from} and ${r.to} for FY ${getFYLabel(activeFY)}`); return }
    if (form.dueDate && !validateDateInFY(form.dueDate, activeFY)) { const r=getFYRange(activeFY); alert(`Due Date must be between ${r.from} and ${r.to} for FY ${getFYLabel(activeFY)}`); return }
    const { grand } = calcInv(form)
    const items = form.items.map(it => {
      const { id, ...rest } = it
      return rest
    })
    const finalForm = { ...form, customer: finalCust, grandTotal: grand, custSearch: finalCust.name, items }
    try {
      // 1. Auto-Capture Customer
      const existingCust = allCustomers.find(c => 
        c.name.trim().toLowerCase() === finalCust.name.trim().toLowerCase() && 
        (c.mobile || '') === (finalCust.mobile || '') && 
        (c.address || '') === (finalCust.address || '')
      )
      if (!existingCust) {
        await createCustomer({ ...finalCust, fy: activeFY })
      }

      // 2. Auto-Capture Products & Sync Stock
      for (const it of form.items) {
        if (!it.name) continue
        const existingProd = allProducts.find(p => p.name.trim().toLowerCase() === it.name.trim().toLowerCase())
        if (existingProd) {
          // Subtract stock
          await updateProduct(existingProd._id, { ...existingProd, stock: (existingProd.stock || 0) - (it.qty || 0) })
        } else {
          // Create new product with negative stock (since it's a sale)
          await createProduct({ 
            name: it.name, hsn: it.hsn, unit: it.unit, price: it.price, gst: it.gstRate, 
            stock: 0 - (it.qty || 0), addStock: 0, cost: 0, cat: 'General', fy: activeFY 
          })
        }
      }

      if (editId) {
        const { data } = await updateInvoice(editId, finalForm)
        setActive(data); 
      } else {
        const { data } = await createInvoice(finalForm)
        setActive(data)
      }
      await loadInvoices()
      await loadProducts()
      await loadCustomers()
      setShowForm(false)
    } catch (err) {
      alert(err.response?.data?.message || 'Save failed: ' + err.message)
    }
  }

  async function delInvoice(id) {
    if (!confirm('Delete this invoice?')) return
    try {
      await deleteInvoice(id)
      await loadInvoices()
      if (active?._id===id) setActive(null)
    } catch (err) { alert('Delete failed: ' + err.message) }
  }
  async function bulkDelete() {
    if (!selected.length||!confirm(`Delete ${selected.length} invoices?`)) return
    try {
      await Promise.all(selected.map(id => deleteInvoice(id)))
      await loadInvoices()
      setSelected([])
    } catch (err) { alert('Bulk delete failed: ' + err.message) }
  }

  function updateItem(id,key,val){ setForm(f=>({...f,items:f.items.map(it=>it.id===id?{...it,[key]:val}:it)})) }
  function addItem(){ setForm(f=>({...f,items:[...f.items,emptyItem()]})) }
  function delItem(id){ setForm(f=>({...f,items:f.items.filter(it=>it.id!==id)})) }

  function pickProduct(itemId,prod) {
    updateItem(itemId,'name',prod.name); updateItem(itemId,'hsn',prod.hsn||'')
    updateItem(itemId,'price',prod.price||0); updateItem(itemId,'gstRate',prod.gst||18)
    updateItem(itemId,'unit',prod.unit||'Nos'); setItemSuggs(s=>({...s,[itemId]:[]}))
  }
  function onItemSearch(itemId,val) {
    updateItem(itemId,'name',val)
    const allP = [...SEED_PRODUCTS, ...allProducts]
    const filtered = val.length>0?allP.filter(p=>p.name.toLowerCase().includes(val.toLowerCase())).slice(0,6):[]
    if (val.length > 0 && !filtered.find(p => p.name.toLowerCase() === val.toLowerCase())) {
      filtered.push({ _id: 'new', name: val, isNew: true })
    }
    setItemSuggs(s=>({...s,[itemId]:filtered}))
  }
  function onCustSearch(v) {
    sf({custSearch:v,customer:null})
    const allC = [...SEED_CUSTOMERS,...allCustomers]
    const filtered = v.length>0?allC.filter(c=>c.name.toLowerCase().includes(v.toLowerCase())||c.mobile?.includes(v)).slice(0,6):[]
    if (v.length > 0 && !filtered.find(c => c.name.toLowerCase() === v.toLowerCase())) {
      filtered.push({ _id: 'new', name: v, isNew: true })
    }
    setCustSugg(filtered)
  }

  // ── PRINT — Vyapar-style template matching PDF ──────────────
  function openPrint(inv) {
    const { items, sub, gst, tr, ro, grand } = calcInv(inv)
    const received = parseFloat(inv.received||0)
    const balance  = grand - received
    const logo     = biz.logo || null
    const initial  = (biz.businessName||'I').split(' ').map(w=>w[0]).join('').substring(0,3).toUpperCase()
    const rows = inv.items.map((it,i)=>{
      const r=calcItem(it)
      return `<tr>
        <td style="text-align:center">${i+1}</td>
        <td><b>${it.name}</b>${it.hsn?`<br><span style="font-size:9px;color:#666">HSN: ${it.hsn}</span>`:''}</td>
        <td style="text-align:center">${it.qty}</td>
        <td style="text-align:center">${it.unit}</td>
        <td style="text-align:right">₹ ${(it.price||0).toFixed(2)}</td>
        <td style="text-align:right">₹ ${r.gstAmt.toFixed(2)}<br><span style="font-size:9px">(${it.gstRate}.0%)</span></td>
        <td style="text-align:right"><b>₹ ${r.total.toFixed(2)}</b></td>
      </tr>`
    }).join('')
    const selectedThemeId = localStorage.getItem('inv_print_theme') || 'padmavathi'
    const THEMES = [
      { id: 'padmavathi', header: '#fff', headerText: '#000', accent: '#000', tableBg: '#f8f8f8', layout: 'classic', font: 'Arial, sans-serif', titleBorder: '2px double #000' },
      { id: 'blue', header: '#1565C0', headerText: '#fff', accent: '#1565C0', tableBg: '#E3F2FD', layout: 'corporate', font: "'Segoe UI', Arial, sans-serif", titleBorder: '3px solid #1565C0' },
      { id: 'green', header: '#2E7D32', headerText: '#fff', accent: '#2E7D32', tableBg: '#E8F5E9', layout: 'eco', font: "'Segoe UI', Arial, sans-serif", titleBorder: '2px solid #2E7D32' },
      { id: 'red', header: '#B71C1C', headerText: '#fff', accent: '#B71C1C', tableBg: '#FFEBEE', layout: 'royal', font: 'Georgia, serif', titleBorder: '3px double #B71C1C' },
      { id: 'purple', header: '#6A1B9A', headerText: '#fff', accent: '#6A1B9A', tableBg: '#F3E5F5', layout: 'elite', font: "'Segoe UI', Arial, sans-serif", titleBorder: '2px solid #6A1B9A' },
      { id: 'dark', header: '#212121', headerText: '#FFD600', accent: '#FFD600', tableBg: '#2a2a2a', layout: 'dark', font: "'Courier New', monospace", titleBorder: '1px solid #FFD600' },
      { id: 'orange', header: '#E65100', headerText: '#fff', accent: '#E65100', tableBg: '#FFF3E0', layout: 'sunset', font: "'Segoe UI', Arial, sans-serif", titleBorder: '3px solid #E65100' },
      { id: 'teal', header: '#00695C', headerText: '#fff', accent: '#00695C', tableBg: '#E0F2F1', layout: 'ocean', font: "'Segoe UI', Arial, sans-serif", titleBorder: '2px solid #00695C' },
      { id: 'pink', header: '#880E4F', headerText: '#fff', accent: '#880E4F', tableBg: '#FCE4EC', layout: 'rosegold', font: 'Georgia, serif', titleBorder: '1px solid #F8BBD0' },
      { id: 'minimal', header: '#fff', headerText: '#212121', accent: '#212121', tableBg: '#fafafa', layout: 'minimal', font: "'Helvetica Neue', Arial, sans-serif", titleBorder: '1px solid #eee' }
    ]
    const th = THEMES.find(t => t.id === selectedThemeId) || THEMES[0]
    const isDark = th.layout === 'dark'
    const bodyBg = isDark ? '#1a1a1a' : '#fff'
    const bodyColor = isDark ? '#e0e0e0' : '#333'
    const borderColor = isDark ? '#444' : '#ccc'
    const lightBorder = isDark ? '#333' : '#eee'

    // Layout-specific header HTML
    let headerHTML = ''
    if (th.layout === 'classic') {
      // Centered, traditional, double borders
      headerHTML = `<div style="text-align:center;padding:12px 0 10px;border-bottom:2px double #000">
        ${logo?`<img src="${logo}" style="height:50px;margin-bottom:4px"><br>`:''}
        <div style="font-size:20px;font-weight:900;letter-spacing:1px;text-transform:uppercase">${biz.businessName||'Invoxira Cloud'}</div>
        <div style="font-size:10px;color:#555;margin-top:3px">${biz.address||''}${biz.city?`, ${biz.city}`:''}${biz.state?`, ${biz.state}`:''}</div>
        <div style="font-size:10px;color:#555">${biz.mobile?`Ph: ${biz.mobile}`:''} ${biz.email?`· ${biz.email}`:''} ${biz.gstin?`· GSTIN: ${biz.gstin}`:''}</div>
        <div style="font-size:12px;font-weight:700;margin-top:8px;border:1px solid #000;display:inline-block;padding:2px 20px;letter-spacing:3px">TAX INVOICE</div>
      </div>`
    } else if (th.layout === 'corporate') {
      // Left accent bar + modern grid
      headerHTML = `<div style="display:flex;border-bottom:3px solid ${th.accent}">
        <div style="width:6px;background:linear-gradient(to bottom,${th.header},${th.accent})"></div>
        <div style="flex:1;padding:12px 16px;background:${th.header};color:${th.headerText};display:flex;justify-content:space-between;align-items:center">
          <div>${logo?`<img src="${logo}" style="height:40px;margin-right:10px;vertical-align:middle">`:''}
            <span style="font-size:18px;font-weight:800">${biz.businessName||'Invoxira Cloud'}</span>
            <div style="font-size:9px;opacity:0.8;margin-top:2px">${biz.address||''} ${biz.city?`· ${biz.city}`:''} · GSTIN: ${biz.gstin||'N/A'}</div>
          </div>
          <div style="background:rgba(255,255,255,0.2);padding:6px 16px;border-radius:4px;font-weight:700;font-size:12px">TAX INVOICE</div>
        </div>
      </div>`
    } else if (th.layout === 'eco') {
      // Green gradient, rounded, eco-friendly
      headerHTML = `<div style="background:linear-gradient(135deg,${th.header},#43A047);color:${th.headerText};padding:14px 18px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center">
        <div>${logo?`<img src="${logo}" style="height:40px;margin-right:10px;vertical-align:middle">`:''}
          <span style="font-size:17px;font-weight:800">🌿 ${biz.businessName||'Invoxira Cloud'}</span>
          <div style="font-size:9px;opacity:0.8;margin-top:2px">${biz.address||''} · GSTIN: ${biz.gstin||'N/A'}</div>
        </div>
        <div style="background:rgba(255,255,255,0.25);padding:6px 16px;border-radius:20px;font-weight:700;font-size:11px">TAX INVOICE</div>
      </div>`
    } else if (th.layout === 'royal') {
      // Ornate, serif, double borders
      headerHTML = `<div style="border:2px solid ${th.accent};padding:0;margin-bottom:0">
        <div style="text-align:center;padding:14px 16px;border-bottom:3px double ${th.accent}">
          <div style="font-size:8px;color:${th.accent};letter-spacing:5px;font-weight:600">★ ROYAL INVOICE ★</div>
          ${logo?`<img src="${logo}" style="height:45px;margin:4px 0"><br>`:''}
          <div style="font-size:20px;font-weight:900;color:${th.accent};font-family:Georgia,serif">${biz.businessName||'Invoxira Cloud'}</div>
          <div style="font-size:9px;color:#777;margin-top:2px">${biz.address||''} · ${biz.gstin?`GSTIN: ${biz.gstin}`:''}</div>
          <div style="font-size:9px;color:#999;margin-top:1px">Trusted Excellence</div>
        </div>
      </div>`
    } else if (th.layout === 'elite') {
      // Gradient, floating badge
      headerHTML = `<div style="background:linear-gradient(135deg,${th.header} 0%,#9C27B0 50%,#CE93D8 100%);color:${th.headerText};padding:16px 18px;position:relative">
        ${logo?`<img src="${logo}" style="height:40px;margin-right:10px;vertical-align:middle">`:''}
        <span style="font-size:18px;font-weight:900;letter-spacing:0.5px">${biz.businessName||'Invoxira Cloud'}</span>
        <div style="font-size:9px;opacity:0.75;margin-top:3px">${biz.address||''} · GSTIN: ${biz.gstin||'N/A'} · ${biz.mobile||''}</div>
        <div style="position:absolute;right:18px;top:12px;background:rgba(255,255,255,0.2);padding:8px 18px;border-radius:4px;font-weight:800;font-size:12px">TAX INVOICE</div>
      </div>`
    } else if (th.layout === 'dark') {
      // Dark mode, gold accent
      headerHTML = `<div style="background:#1a1a1a;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #FFD600">
        <div>${logo?`<img src="${logo}" style="height:40px;margin-right:10px;vertical-align:middle;filter:brightness(1.2)">`:''}
          <span style="font-size:18px;font-weight:900;color:#FFD600">${biz.businessName||'Invoxira Cloud'}</span>
          <div style="font-size:9px;color:#888;margin-top:2px">${biz.address||''} · GSTIN: ${biz.gstin||'N/A'}</div>
        </div>
        <div style="border:1px solid #FFD600;color:#FFD600;padding:6px 14px;border-radius:3px;font-weight:700;font-size:11px">TAX INVOICE</div>
      </div>`
    } else if (th.layout === 'sunset') {
      // Warm gradient, large title
      headerHTML = `<div style="background:linear-gradient(to right,#E65100,#FF8F00,#FFB300);color:#fff;padding:16px 18px;display:flex;justify-content:space-between;align-items:flex-end">
        <div>${logo?`<img src="${logo}" style="height:40px;margin-right:10px;vertical-align:middle">`:''}
          <span style="font-size:17px;font-weight:900">${biz.businessName||'Invoxira Cloud'}</span>
          <div style="font-size:9px;opacity:0.85;margin-top:2px">${biz.address||''} · GSTIN: ${biz.gstin||'N/A'}</div>
        </div>
        <div style="text-align:right"><div style="font-weight:800;font-size:22px;line-height:1">INVOICE</div><div style="font-size:8px;opacity:0.8">#${inv.invoiceNo} · ${inv.date}</div></div>
      </div>`
    } else if (th.layout === 'ocean') {
      // Wave patterns, teal split
      headerHTML = `<div style="background:${th.header};color:${th.headerText};padding:14px 18px;position:relative;overflow:hidden">
        <div style="position:absolute;bottom:-10px;right:-10px;width:100px;height:50px;border-radius:50%;background:rgba(255,255,255,0.08)"></div>
        <div style="position:absolute;bottom:-5px;right:40px;width:70px;height:35px;border-radius:50%;background:rgba(255,255,255,0.05)"></div>
        ${logo?`<img src="${logo}" style="height:40px;margin-right:10px;vertical-align:middle;position:relative">`:''}
        <span style="font-size:17px;font-weight:800;position:relative">${biz.businessName||'Invoxira Cloud'}</span>
        <div style="font-size:9px;opacity:0.7;margin-top:2px;position:relative">${biz.address||''} · GSTIN: ${biz.gstin||'N/A'} · ${biz.mobile||''}</div>
      </div>`
    } else if (th.layout === 'rosegold') {
      // Centered elegant, serif
      headerHTML = `<div style="text-align:center;padding:14px 18px;border-bottom:1px solid #F8BBD0;background:#FFF9FB">
        <div style="font-weight:300;font-size:9px;letter-spacing:6px;color:${th.accent};text-transform:uppercase">Tax Invoice</div>
        ${logo?`<img src="${logo}" style="height:45px;margin:4px 0"><br>`:''}
        <div style="font-size:20px;font-weight:800;color:${th.accent};font-family:Georgia,serif;margin-top:2px">${biz.businessName||'Invoxira Cloud'}</div>
        <div style="font-size:9px;color:#C2185B;margin-top:2px">${biz.address||''} · GSTIN: ${biz.gstin||'N/A'} · ${biz.mobile||''}</div>
      </div>`
    } else {
      // Minimal — clean, ultra-simple
      headerHTML = `<div style="padding:14px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:baseline">
        <div>${logo?`<img src="${logo}" style="height:35px;margin-right:10px;vertical-align:middle">`:''}
          <span style="font-size:18px;font-weight:800;color:#222">${biz.businessName||'Invoxira Cloud'}</span>
          <div style="font-size:9px;color:#999;margin-top:2px">${biz.address||''} · GSTIN: ${biz.gstin||'N/A'}</div>
        </div>
        <div style="font-size:9px;color:#999">TAX INVOICE</div>
      </div>`
    }

    // Layout-specific title (some layouts embed it in header already)
    const showTitle = !['sunset','rosegold','classic'].includes(th.layout)
    const titleHTML = showTitle ? `<div style="text-align:center;font-size:14px;font-weight:bold;color:${isDark?'#FFD600':th.header==='#fff'?'#333':th.header};padding:8px 0;border-bottom:${th.titleBorder};margin-bottom:10px">${th.layout==='royal'?'★ Tax Invoice ★':'Tax Invoice'}</div>` : (th.layout==='classic'?'<div style="height:8px"></div>':'')

    const w = window.open('','_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice #${inv.invoiceNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:${th.font};font-size:11px;color:${bodyColor};padding:14px;background:${bodyBg}}
  table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11px}
  table thead tr{background:${th.header};color:${th.headerText}}
  table th{padding:7px 8px;text-align:left;font-weight:600}
  table td{padding:6px 8px;border-bottom:1px solid ${lightBorder};vertical-align:middle}
  table tbody tr:nth-child(even){background:${th.tableBg}}
  .total-row{background:${isDark?'#333':'#f5f5f5'}!important;color:${isDark?'#FFD600':'#333'};font-weight:bold}
  @page{margin:10mm}
  @media print{button{display:none}}
</style></head><body>

${headerHTML}
${titleHTML}

<!-- INFO GRID -->
<div style="display:grid;grid-template-columns:2fr 1.5fr 1.5fr 1.5fr;border:1px solid ${borderColor};margin-bottom:10px;${isDark?'background:#222':''}">
  <div style="padding:8px 10px;border-right:1px solid ${borderColor}">
    <div style="font-size:9px;font-weight:bold;text-transform:uppercase;color:${isDark?th.accent:'#555'};margin-bottom:4px">Bill To</div>
    <div style="font-size:11px;line-height:1.5">
      <b>${inv.customer?.name||inv.custSearch||''}</b><br>
      ${inv.customer?.address||''}<br>
      ${inv.customer?.mobile?`Contact: ${inv.customer.mobile}`:''}<br>
      ${inv.customer?.gstin?`GSTIN: ${inv.customer.gstin}`:''}
    </div>
  </div>
  <div style="padding:8px 10px;border-right:1px solid ${borderColor}">
    <div style="font-size:9px;font-weight:bold;text-transform:uppercase;color:${isDark?th.accent:'#555'};margin-bottom:4px">Ship To</div>
    <div style="font-size:11px">${inv.shipTo||'—'}</div>
  </div>
  <div style="padding:8px 10px;border-right:1px solid ${borderColor}">
    <div style="font-size:9px;font-weight:bold;text-transform:uppercase;color:${isDark?th.accent:'#555'};margin-bottom:4px">Transport</div>
    <div style="font-size:11px">${inv.vehicleNo?`Vehicle: ${inv.vehicleNo}`:'—'}${inv.eWayBill?`<br>E-Way: ${inv.eWayBill}`:''}</div>
  </div>
  <div style="padding:8px 10px">
    <div style="font-size:9px;font-weight:bold;text-transform:uppercase;color:${isDark?th.accent:'#555'};margin-bottom:4px">Invoice Details</div>
    <div style="font-size:11px">No.: <b>${inv.invoiceNo}</b><br>Date: ${inv.date}<br>${inv.dueDate?`Due: ${inv.dueDate}<br>`:''}Supply: ${inv.stateOfSupply||'Tamil Nadu'}</div>
  </div>
</div>

<!-- ITEMS TABLE -->
<table>
  <thead><tr>
    <th style="width:30px;text-align:center">#</th>
    <th>Item name</th>
    <th style="text-align:center">Qty</th>
    <th style="text-align:center">Unit</th>
    <th style="text-align:right">Rate</th>
    <th style="text-align:right">GST</th>
    <th style="text-align:right">Amount</th>
  </tr></thead>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td colspan="2"><b>Total</b></td>
      <td style="text-align:center">${inv.items.reduce((s,it)=>s+(it.qty||0),0)}</td>
      <td></td>
      <td style="text-align:right"><b>₹ ${sub.toFixed(2)}</b></td>
      <td style="text-align:right"><b>₹ ${gst.toFixed(2)}</b></td>
      <td style="text-align:right"><b>₹ ${(sub+gst).toFixed(2)}</b></td>
    </tr>
  </tbody>
</table>

<!-- SUMMARY -->
<div style="display:flex;justify-content:space-between;border:1px solid ${borderColor};border-radius:2px;margin-bottom:8px;${isDark?'background:#222':''}">
  <div style="flex:1;padding:8px 12px;border-right:1px solid ${lightBorder}">
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px"><span>SGST</span><b>₹ ${(gst/2).toFixed(2)}</b></div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px"><span>CGST</span><b>₹ ${(gst/2).toFixed(2)}</b></div>
    ${tr>0?`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px"><span>Transport</span><b>₹ ${tr.toFixed(2)}</b></div>`:''}
    ${ro!==0?`<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px"><span>Round Off</span><b>${ro>=0?'+':'-'}₹ ${Math.abs(ro).toFixed(2)}</b></div>`:''}
  </div>
  <div style="flex:1;padding:8px 12px;background:${isDark?'#2a2a2a':'#fcfcfc'}">
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${lightBorder};margin-bottom:4px;color:${isDark?'#FFD600':th.accent};font-size:13px">
      <b>Grand Total</b><b style="font-size:16px">₹ ${grand.toFixed(2)}</b>
    </div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px"><span>Received</span><b>₹ ${received.toFixed(2)}</b></div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:11px;color:#C62828"><b>Balance Due</b><b>₹ ${balance.toFixed(2)}</b></div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:10px;color:${isDark?'#888':'#666'}"><span>Payment:</span><b>${inv.paymentType}</b></div>
  </div>
</div>

<!-- AMOUNT IN WORDS -->
<div style="padding:8px 12px;border:1px solid ${borderColor};border-radius:2px;margin-bottom:8px;font-size:10px;${isDark?'background:#222':''}">
  <b>Amount in Words:</b> <span style="font-style:italic">${amtWords(grand)}</span>
</div>

<!-- TERMS -->
<div style="margin-top:4px;font-size:10px;color:${isDark?'#999':'#555'}">
  <b>Terms & Conditions:</b><br>${inv.termsConditions||'Thanks for doing business with us!'}
  ${inv.notes?`<br>Notes: ${inv.notes}`:''}
</div>

<!-- FOOTER -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding-top:10px;border-top:1px solid ${borderColor};margin-top:8px">
  <div style="font-size:10px;line-height:1.7">
    <b>Pay To:</b><br>
    ${biz.bankName?`Bank: ${biz.bankName}`:''}${biz.city?`, ${biz.city}`:''}<br>
    ${biz.accountNo?`A/c: ${biz.accountNo}<br>`:''}
    ${biz.ifsc?`IFSC: ${biz.ifsc}<br>`:''}
    ${biz.ownerName?`Holder: ${biz.ownerName}`:''}
    ${biz.upi?`<br>UPI: ${biz.upi}`:''}
  </div>
  <div style="text-align:right;font-size:10px">
    <div>For: ${biz.businessName||'Invoxira Cloud'}</div>
    <div style="height:60px;display:flex;align-items:center;justify-content:flex-end">
      ${biz.signature?`<img src="${biz.signature}" style="max-height:55px;max-width:150px;object-fit:contain">`:`<div style="height:40px"></div>`}
    </div>
    <div style="border-bottom:1px solid ${isDark?'#FFD600':'#333'};width:160px;margin:0 0 4px auto"></div>
    <b>Authorized Signatory</b>
  </div>
</div>

<script>window.onload=()=>window.print()<\/script>
</body></html>`)
    w.document.close()
  }

  // ── EXPORT EXCEL (CSV) ─────────────────────────────────────
  function exportExcel() {
    const rows = [
      ['Invoice No','Date','Customer','Mobile','GSTIN','Address','Payment','Status','Sub Total','GST','Transport','Grand Total'],
      ...filtered.map(inv=>{
        const {sub,gst,tr,grand}=calcInv(inv)
        return [inv.invoiceNo,inv.date,inv.customer?.name||inv.custSearch,inv.customer?.mobile||'',inv.customer?.gstin||'',inv.customer?.address||'',inv.paymentType,inv.status,sub.toFixed(2),gst.toFixed(2),tr.toFixed(2),grand.toFixed(2)]
      })
    ]
    const csv = rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`invoices_${new Date().toISOString().split('T')[0]}.csv`; a.click()
  }

  // ── EXPORT PDF (all invoices list) ────────────────────────
  function exportPDF() {
    const rows = filtered.map((inv,i)=>{
      const {sub,gst,tr,grand}=calcInv(inv)
      return `<tr><td>${i+1}</td><td>${inv.invoiceNo}</td><td>${inv.date}</td><td>${inv.customer?.name||inv.custSearch||'—'}</td><td>${inv.paymentType}</td><td>${sub.toFixed(0)}</td><td>${gst.toFixed(0)}</td><td>${tr.toFixed(0)}</td><td><b>₹${grand.toFixed(0)}</b></td><td><span style="color:${inv.status==='paid'?'green':inv.status==='overdue'?'red':'orange'}">${inv.status}</span></td></tr>`
    }).join('')
    const w=window.open('','_blank')
    w.document.write(`<!DOCTYPE html><html><head><title>Sale Report</title>
<style>body{font-family:Arial;font-size:11px;padding:16px}h2{color:#1565C0;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#1565C0;color:#fff;padding:7px 8px;text-align:left}td{padding:6px 8px;border-bottom:1px solid #eee}tr:nth-child(even){background:#F8FBFF}.grand{font-size:14px;font-weight:bold;color:#1565C0}</style></head><body>
<h2>${biz.businessName||'Invoxira Cloud'} — Sale Report</h2>
<div style="font-size:11px;color:#666">Period: ${filterFrom||'All'} to ${filterTo||'All'} · Generated: ${new Date().toLocaleString()}</div>
<table><thead><tr><th>#</th><th>Invoice</th><th>Date</th><th>Customer</th><th>Payment</th><th>Sub Total</th><th>GST</th><th>Transport</th><th>Grand Total</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="8" style="text-align:right;font-weight:bold;padding:8px">TOTAL:</td><td class="grand">₹${filtered.reduce((s,i)=>s+(i.grandTotal||0),0).toFixed(0)}</td><td></td></tr></tfoot>
</table>
<script>window.onload=()=>window.print()</script></body></html>`)
    w.document.close()
  }

  // ── WHATSAPP ──────────────────────────────────────────────
  function sendWA(inv) {
    const {sub,gst,tr,ro,grand}=calcInv(inv)
    const received=parseFloat(inv.received||0)
    const items=inv.items.map((it,i)=>`  ${i+1}. ${it.name} | Qty:${it.qty} ${it.unit} | Rate:₹${it.price} | GST:${it.gstRate}% | Amt:₹${calcItem(it).total.toFixed(2)}`).join('\n')
    const msg=`*TAX INVOICE*\n*${biz.businessName||'Invoxira Cloud'}*\n${biz.address||''}\nGSTIN: ${biz.gstin||''}\n\n*Invoice No:* ${inv.invoiceNo}\n*Date:* ${inv.date}\n*Payment:* ${inv.paymentType}\n\n*Bill To:* ${inv.customer?.name||inv.custSearch}\n${inv.customer?.mobile?`Ph: ${inv.customer.mobile}\n`:''}${inv.customer?.address||''}\n\n*Items:*\n${items}\n\n*Sub Total:* ₹${sub.toFixed(2)}\n*SGST:* ₹${(gst/2).toFixed(2)}\n*CGST:* ₹${(gst/2).toFixed(2)}\n${tr>0?`*Transport:* ₹${tr.toFixed(2)}\n`:''}\n*GRAND TOTAL: ₹${grand.toFixed(2)}*\n*Received:* ₹${received.toFixed(2)}\n*Balance:* ₹${(grand-received).toFixed(2)}\n\nThank you! - ${biz.businessName||'Invoxira Cloud'}`
    window.open(`https://wa.me/91${inv.customer?.mobile}?text=${encodeURIComponent(msg)}`,'_blank')
  }

  const { sub,gst,tr,ro,grand } = calcInv(form)
  const fmt = n => '₹'+(n||0).toLocaleString('en-IN',{maximumFractionDigits:2})

  // ══════════════════════════════════════════════════════════
  //  LIST VIEW
  // ══════════════════════════════════════════════════════════


  if (!showForm) return (
    <div className="page-wrap">
      <div className="page-head">
        <div><div className="page-title">Sale Invoices</div><div className="page-subtitle">{invoices.length} total</div></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <button className={`filter-btn ${filterMode==='month'?'active':''}`} onClick={()=>applyQuick('month')}>This Month</button>
          <button className={`filter-btn ${filterMode==='year'?'active':''}`}  onClick={()=>applyQuick('year')}>This Year</button>
          <input type="date" value={filterFrom} onChange={e=>{setFilterFrom(e.target.value);setFilterMode('')}} style={{padding:'5px 8px',border:'1px solid #E0E0E0',borderRadius:4,fontSize:12}} />
          <span style={{fontSize:12,color:'#9E9E9E'}}>to</span>
          <input type="date" value={filterTo} onChange={e=>{setFilterTo(e.target.value);setFilterMode('')}} style={{padding:'5px 8px',border:'1px solid #E0E0E0',borderRadius:4,fontSize:12}} />
          {(filterFrom||filterTo) && <button className="btn btn-xs btn-gray" onClick={()=>{setFilterFrom('');setFilterTo('');setFilterMode('')}}>✕</button>}
          <button className="btn btn-sm btn-gray"    onClick={exportExcel}>📊 Export Excel</button>
          <button className="btn btn-sm btn-gray"    onClick={exportPDF}>📄 Export PDF</button>
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ New Sale</button>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:14}}>
        {[['Total Sales',fmt(totalSale),'#1565C0','#E3F2FD'],['Received',fmt(totalPaid),'#2E7D32','#E8F5E9'],['Pending',fmt(totalPend),'#E65100','#FFF3E0'],['Overdue',fmt(totalOvd),'#C62828','#FFEBEE'],['Total GST',fmt(totalGST),'#6A1B9A','#F3E5F5']].map(([l,v,c,bg])=>(
          <div key={l} style={{background:bg,borderRadius:6,padding:'10px 14px'}}>
            <div style={{fontSize:11,color:c,fontWeight:600}}>{l}</div>
            <div style={{fontSize:17,fontWeight:700,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="filter-bar">
        <div className="search-wrap" style={{minWidth:200}}>
          <span className="search-icon">🔍</span>
          <input placeholder="Search invoice, customer..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        {['','paid','pending','overdue'].map(s=>(
          <button key={s} className={`filter-btn ${filterStat===s?'active':''}`} onClick={()=>setFilterStat(s)}>
            {s===''?'All':s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
        {selected.length>0 && <button className="btn btn-sm btn-danger" onClick={bulkDelete}>🗑️ Delete ({selected.length})</button>}
        <span style={{marginLeft:'auto',fontSize:12,color:'#9E9E9E'}}>{filtered.length} invoices</span>
      </div>

      {/* Table + Detail */}
      <div style={{display:'grid',gridTemplateColumns:active?'1fr 360px':'1fr',gap:12}}>
        <div className="card">
          <div className="tbl-wrap">
            <table>
              <thead><tr>
                <th style={{width:36}}><input type="checkbox" checked={selected.length===filtered.length&&filtered.length>0} onChange={()=>setSelected(selected.length===filtered.length?[]:filtered.map(i=>i._id))} /></th>
                <th>Date</th><th>Invoice#</th><th>Customer</th><th>Payment</th><th>Amount</th><th>Balance</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.length===0
                  ? <tr><td colSpan={9}><div className="empty-state"><div className="icon">🧾</div><p>No invoices found</p></div></td></tr>
                  : filtered.map(inv=>{
                      const bal = (inv.grandTotal||0) - parseFloat(inv.received||0)
                      return (
                        <tr key={inv._id} style={{background:active?._id===inv._id?'#E3F2FD':selected.includes(inv._id)?'#FFF8E1':'',cursor:'pointer'}}
                          onClick={()=>setActive(active?._id===inv._id?null:inv)}>
                          <td onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selected.includes(inv._id)} onChange={()=>setSelected(s=>s.includes(inv._id)?s.filter(x=>x!==inv._id):[...s,inv._id])} /></td>
                          <td style={{fontSize:12,color:'#616161'}}>{inv.date}</td>
                          <td><span style={{fontWeight:700,color:'#1565C0'}}>#{inv.invoiceNo}</span></td>
                          <td><div style={{fontWeight:600}}>{inv.customer?.name||inv.custSearch||'—'}</div><div style={{fontSize:11,color:'#9E9E9E'}}>{inv.customer?.mobile}</div></td>
                          <td><span className="badge badge-gray">{inv.paymentType}</span></td>
                          <td style={{fontWeight:700,color:'#1565C0'}}>₹{(inv.grandTotal||0).toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                          <td style={{fontWeight:600,color:bal>0?'#C62828':'#2E7D32'}}>₹{bal.toLocaleString('en-IN',{maximumFractionDigits:0})}</td>
                          <td><span className={`badge badge-${inv.status==='paid'?'green':inv.status==='overdue'?'red':'orange'}`}>{inv.status}</span></td>
                          <td onClick={e=>e.stopPropagation()}>
                            <div style={{display:'flex',gap:3}}>
                              <button className="btn btn-xs btn-outline" onClick={()=>openPrint(inv)} title="Print">🖨️</button>
                              <button className="btn btn-xs btn-outline" onClick={()=>sendWA(inv)} title="WhatsApp">💬</button>
                              <button className="btn btn-xs btn-outline" onClick={()=>openEdit(inv)} title="Edit">✏️</button>
                              <button className="btn btn-xs btn-danger"  onClick={()=>delInvoice(inv._id)} title="Delete">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        {active && (()=>{
          const {sub,gst,tr,ro,grand}=calcInv(active)
          const bal=(active.grandTotal||0)-parseFloat(active.received||0)
          return (
            <div className="card" style={{fontSize:13,height:'fit-content',maxHeight:'82vh',overflowY:'auto'}}>
              <div style={{padding:'12px 14px',borderBottom:'1px solid #E0E0E0',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'#fff',zIndex:1}}>
                <b>Invoice #{active.invoiceNo}</b>
                <div style={{display:'flex',gap:5}}>
                  <button className="btn btn-xs btn-outline" onClick={()=>openPrint(active)}>🖨️</button>
                  <button className="btn btn-xs btn-outline" onClick={()=>sendWA(active)}>💬</button>
                  <button className="btn btn-xs btn-primary" onClick={()=>openEdit(active)}>✏️ Edit</button>
                  <button className="btn btn-xs btn-gray"   onClick={()=>setActive(null)}>✕</button>
                </div>
              </div>
              <div style={{padding:14}}>
                <div style={{fontWeight:700,fontSize:15,marginBottom:3}}>{active.customer?.name||active.custSearch}</div>
                <div style={{color:'#757575',fontSize:12,marginBottom:10}}>{active.customer?.mobile} · {active.customer?.gstin}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,padding:'8px 10px',background:'#F5F5F5',borderRadius:4,fontSize:12,marginBottom:10}}>
                  <div>Date: <b>{active.date}</b></div>
                  <div>Payment: <b>{active.paymentType}</b></div>
                  {active.dueDate&&<div>Due: <b>{active.dueDate}</b></div>}
                  <div>Status: <span className={`badge badge-${active.status==='paid'?'green':active.status==='overdue'?'red':'orange'}`}>{active.status}</span></div>
                </div>
                <table style={{marginBottom:10}}>
                  <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
                  <tbody>{active.items?.map((it,i)=>{ const r=calcItem(it); return <tr key={i}><td>{it.name}</td><td>{it.qty} {it.unit}</td><td>₹{it.price}</td><td style={{fontWeight:600}}>₹{r.total.toFixed(0)}</td></tr> })}</tbody>
                </table>
                <div style={{borderTop:'1px solid #E0E0E0',paddingTop:8}}>
                  {[['Subtotal',`₹${sub.toFixed(2)}`],['SGST',`₹${(gst/2).toFixed(2)}`],['CGST',`₹${(gst/2).toFixed(2)}`],tr>0&&['Transport',`₹${tr.toFixed(2)}`],ro!==0&&['Round Off',`${ro>=0?'+':''}${ro.toFixed(2)}`]].filter(Boolean).map(([l,v])=>(
                    <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'3px 0',fontSize:12}}><span style={{color:'#757575'}}>{l}</span><span>{v}</span></div>
                  ))}
                  <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderTop:'2px solid #1565C0',marginTop:6}}><b>Grand Total</b><b style={{color:'#1565C0',fontSize:16}}>₹{grand.toFixed(2)}</b></div>
                  <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',fontSize:12}}><span>Received</span><span style={{color:'#2E7D32',fontWeight:600}}>₹{parseFloat(active.received||0).toFixed(2)}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between',padding:'3px 0',fontSize:12}}><span>Balance</span><span style={{color:bal>0?'#C62828':'#2E7D32',fontWeight:700}}>₹{bal.toFixed(2)}</span></div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════
  //  FORM VIEW
  // ══════════════════════════════════════════════════════════
  const EMPTY_ROWS = 5
  return (
    <div className="page-wrap">
      <div style={{position:'sticky',top:0,zIndex:100,background:'#fff',borderBottom:'1px solid #E0E0E0',padding:'10px 0',marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <button className="btn btn-gray btn-sm" onClick={()=>setShowForm(false)}>← Back</button>
          <span style={{fontWeight:700,fontSize:16}}>{editId?`Edit Invoice #${editId}`:'New Sale Invoice'}</span>
        </div>
        <button className="btn btn-primary" onClick={saveInvoice}>💾 Save Invoice</button>
      </div>

      {/* Invoice meta */}
      <div className="card" style={{padding:14,marginBottom:12}}>
        <div className="form-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
          <div className="form-group"><label className="form-label">Invoice No. *</label><input className="form-input" value={form.invoiceNo} onChange={e=>sf({invoiceNo:e.target.value})} style={{fontWeight:700}} /></div>
          <div className="form-group"><label className="form-label">Date *</label><input className="form-input" type="date" value={form.date} onChange={e=>sf({date:e.target.value})} /></div>
          <div className="form-group"><label className="form-label">Due Date</label><input className="form-input" type="date" value={form.dueDate} onChange={e=>sf({dueDate:e.target.value})} /></div>
          <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={form.status} onChange={e=>sf({status:e.target.value})}><option value="pending">Pending</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select></div>
          <div className="form-group"><label className="form-label">Payment Type</label><select className="form-select" value={form.paymentType} onChange={e=>sf({paymentType:e.target.value})}>{['Cash','Credit','UPI','NEFT','Cheque'].map(p=><option key={p}>{p}</option>)}</select></div>
          <div className="form-group"><label className="form-label">State of Supply</label><select className="form-select" value={form.stateOfSupply} onChange={e=>sf({stateOfSupply:e.target.value})}>{STATES.map(s=><option key={s}>{s}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Vehicle No.</label><input className="form-input" value={form.vehicleNo} onChange={e=>sf({vehicleNo:e.target.value})} placeholder="TN01AB1234" /></div>
          <div className="form-group"><label className="form-label">E-Way Bill</label><div style={{display:'flex',gap:5}}><input className="form-input" value={form.eWayBill} onChange={e=>sf({eWayBill:e.target.value})} /><button type="button" className="btn btn-sm" style={{background:'#1976D2',color:'#fff',whiteSpace:'nowrap'}} onClick={()=>window.open('https://ewaybillgst.gov.in','_blank')}>🚚</button></div></div>
        </div>
      </div>

      {/* Customer */}
      <div className="card" style={{padding:14,marginBottom:12}}>
        <div className="section-title">Customer Details</div>
        <div className="form-grid" style={{gridTemplateColumns:'repeat(3,1fr)',marginTop:10}}>
          <div className="form-group" style={{position:'relative'}}>
            <label className="form-label">Customer Name *</label>
            <input className="form-input" placeholder="Type to search or enter name..." value={form.custSearch}
              onChange={e=>onCustSearch(e.target.value)}
              onBlur={()=>setTimeout(()=>{ setCustSugg([]); if(form.custSearch&&!form.customer) sf({customer:{name:form.custSearch,mobile:'',gstin:'',address:''}}) },200)}
              onKeyDown={e=>{ if(e.key==='Enter'&&form.custSearch){ sf({customer:{name:form.custSearch,mobile:'',gstin:'',address:''}}); setCustSugg([]) } if(e.key==='Escape') setCustSugg([]) }} />
            {custSugg.length>0&&<div className="autocomplete">{custSugg.map(c=>(
              <div key={c._id} className="autocomplete-item" onMouseDown={()=>{ 
                if (c.isNew) {
                  sf({custSearch:c.name,customer:{name:c.name,mobile:'',gstin:'',address:''}})
                } else {
                  sf({custSearch:c.name,customer:c})
                }
                setCustSugg([]) 
              }}>
                {c.isNew ? (
                  <div className="ac-name" style={{color: '#1565C0', fontWeight: 600}}>+ Add "{c.name}" as New Customer</div>
                ) : (
                  <>
                    <div className="ac-name">{c.name}</div>
                    <div className="ac-sub">{c.mobile} {c.gstin?`· ${c.gstin}`:''}</div>
                  </>
                )}
              </div>
            ))}</div>}
          </div>
          <div className="form-group"><label className="form-label">Mobile</label><input className="form-input" placeholder="10 digit mobile" value={form.customer?.mobile||''} onChange={e=>sfc({mobile:e.target.value})} /></div>
          <div className="form-group">
            <label className="form-label">GSTIN {form.customer?.gstin?.length>=2&&<span style={{fontSize:10,color:'#2E7D32',marginLeft:6}}>✅ {STATE_GST[form.customer.gstin.substring(0,2)]||''}</span>}</label>
            <div style={{display:'flex',gap:5}}><input className="form-input" placeholder="15 chars" maxLength={15} value={form.customer?.gstin||''} onChange={e=>{ const g=e.target.value.toUpperCase(); const s=STATE_GST[g.substring(0,2)]; sfc({gstin:g}); if(s)sf({stateOfSupply:s}) }} /><button type="button" className="btn btn-sm" style={{background:'#1976D2',color:'#fff'}} onClick={()=>window.open('https://services.gst.gov.in','_blank')}>🔍</button></div>
          </div>
          <div className="form-group col-2"><label className="form-label">Address</label><input className="form-input" value={form.customer?.address||''} onChange={e=>sfc({address:e.target.value})} /></div>
          <div className="form-group"><label className="form-label">Ship To</label><input className="form-input" value={form.shipTo} onChange={e=>sf({shipTo:e.target.value})} /></div>
          <div className="form-group"><label className="form-label">PO Number</label><input className="form-input" value={form.poNo} onChange={e=>sf({poNo:e.target.value})} /></div>
        </div>
      </div>

      {/* Items */}
      <div className="card" style={{marginBottom:12,overflow:'visible'}}>
        <div style={{padding:'12px 14px',borderBottom:'1px solid #E0E0E0',fontWeight:700,fontSize:13}}>Items</div>
        <div style={{overflowX:'auto',overflowY:'visible',paddingBottom:100}}>
          <table style={{minWidth:900,borderCollapse:'collapse'}}>
            <thead><tr>
              <th style={{width:32,padding:'8px 6px',background:'#1565C0',color:'#fff'}}>#</th>
              <th style={{minWidth:200,padding:'8px 6px',background:'#1565C0',color:'#fff'}}>Item Name</th>
              <th style={{width:90,padding:'8px 6px',background:'#1565C0',color:'#fff'}}>HSN</th>
              <th style={{width:65,padding:'8px 6px',background:'#1565C0',color:'#fff'}}>Qty</th>
              <th style={{width:75,padding:'8px 6px',background:'#1565C0',color:'#fff'}}>Unit</th>
              <th style={{width:95,padding:'8px 6px',background:'#1565C0',color:'#fff'}}>Rate (₹)</th>
              <th style={{width:70,padding:'8px 6px',background:'#1565C0',color:'#fff'}}>Disc%</th>
              <th style={{width:65,padding:'8px 6px',background:'#1565C0',color:'#fff'}}>GST%</th>
              <th style={{width:100,padding:'8px 6px',background:'#1565C0',color:'#fff'}}>Amount</th>
              <th style={{width:32,padding:'8px 6px',background:'#1565C0',color:'#fff'}}></th>
            </tr></thead>
            <tbody style={{position:'relative'}}>
              {[...form.items, ...Array.from({length:Math.max(0,EMPTY_ROWS-form.items.length)},()=>null)].map((item,idx)=>{
                if (!item) return (
                  <tr key={`e${idx}`} style={{opacity:0.4}}>
                    <td style={{padding:'6px',textAlign:'center',color:'#BDBDBD',fontSize:11}}>{form.items.length+idx-Math.max(0,EMPTY_ROWS-form.items.length)+1}</td>
                    <td colSpan={9} style={{padding:'5px 8px'}}><input className="form-input" placeholder="Click to add item..." style={{fontSize:12,cursor:'pointer'}} onFocus={()=>addItem()} onChange={()=>{}} value="" readOnly /></td>
                  </tr>
                )
                const r=calcItem(item); const sugg=itemSuggs[item.id]||[]
                return (
                  <tr key={item.id} style={{position:'relative',zIndex:form.items.length-idx+10,borderBottom:'1px solid #F5F5F5'}}>
                    <td style={{padding:'4px 6px',textAlign:'center',color:'#9E9E9E',fontSize:11}}>{idx+1}</td>
                    <td style={{padding:'4px 6px',position:'relative',overflow:'visible'}}>
                      <input className="form-input" style={{fontSize:13}} value={item.name} placeholder="Product name..."
                        onChange={e=>onItemSearch(item.id,e.target.value)}
                        onBlur={()=>setTimeout(()=>setItemSuggs(s=>({...s,[item.id]:[]})),200)} />
                      {sugg.length>0&&<div className="autocomplete" style={{minWidth:260}}>{sugg.map(p=>(
                        <div key={p._id} className="autocomplete-item" onMouseDown={()=>{
                          if (p.isNew) {
                            updateItem(item.id, 'name', p.name)
                          } else {
                            pickProduct(item.id, p)
                          }
                          setItemSuggs(s=>({...s,[item.id]:[]}))
                        }}>
                          {p.isNew ? (
                            <div className="ac-name" style={{color: '#1565C0', fontWeight: 600}}>+ Add "{p.name}" as New Product</div>
                          ) : (
                            <>
                              <div className="ac-name">{p.name}</div>
                              <div className="ac-sub">HSN:{p.hsn} · ₹{p.price} · GST:{p.gst}%</div>
                            </>
                          )}
                        </div>
                      ))}</div>}
                    </td>
                    <td style={{padding:'4px 6px'}}><input className="form-input" style={{fontSize:12}} value={item.hsn} onChange={e=>updateItem(item.id,'hsn',e.target.value)} /></td>
                    <td style={{padding:'4px 6px'}}><NumInput className="form-input" style={{width:'100%'}} value={item.qty} onChange={v=>updateItem(item.id,'qty',v)} min="0" /></td>
                    <td style={{padding:'4px 6px'}}><select className="form-select" value={item.unit} onChange={e=>updateItem(item.id,'unit',e.target.value)}>{UNITS.map(u=><option key={u}>{u}</option>)}</select></td>
                    <td style={{padding:'4px 6px'}}><NumInput className="form-input" style={{width:'100%'}} value={item.price} onChange={v=>updateItem(item.id,'price',v)} min="0" /></td>
                    <td style={{padding:'4px 6px'}}><NumInput className="form-input" style={{width:'100%'}} value={item.discount} onChange={v=>updateItem(item.id,'discount',v)} min="0" max="100" /></td>
                    <td style={{padding:'4px 6px'}}><select className="form-select" value={item.gstRate} onChange={e=>updateItem(item.id,'gstRate',parseFloat(e.target.value))}>{GSTR.map(g=><option key={g} value={g}>{g}%</option>)}</select></td>
                    <td style={{padding:'4px 6px',fontWeight:700,color:'#1565C0',fontSize:13}}>₹{r.total.toFixed(2)}</td>
                    <td style={{padding:'4px 6px'}}><button className="btn btn-xs btn-danger" onClick={()=>delItem(item.id)}>✕</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{padding:'10px 14px'}}><button className="btn btn-sm btn-outline" onClick={addItem}>+ Add Item</button></div>
      </div>

      {/* Summary */}
      <div className="card" style={{padding:16}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:20}}>
          <div>
            <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
              <div className="form-group"><label className="form-label">Transport Charge (₹)</label><NumInput className="form-input" value={form.transport} onChange={v=>sf({transport:v})} min="0" /></div>
              <div className="form-group"><label className="form-label">Amount Received (₹)</label><NumInput className="form-input" value={form.received} onChange={v=>sf({received:v})} min="0" /></div>
              <div className="form-group col-2"><label className="form-label">Terms & Conditions</label><input className="form-input" value={form.termsConditions} onChange={e=>sf({termsConditions:e.target.value})} /></div>
              <div className="form-group col-2"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e=>sf({notes:e.target.value})} style={{resize:'none'}} /></div>
            </div>
          </div>
          <div>
            {[['Sub Total',`₹${sub.toFixed(2)}`],['SGST',`₹${(gst/2).toFixed(2)}`],['CGST',`₹${(gst/2).toFixed(2)}`],['Transport',`₹${tr.toFixed(2)}`],['Round Off',`${ro>=0?'+':''}${ro.toFixed(2)}`]].map(([l,v])=>(
              <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #F5F5F5',fontSize:13}}><span style={{color:'#757575'}}>{l}</span><span style={{fontWeight:600}}>{v}</span></div>
            ))}
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderTop:'2px solid #1565C0',marginTop:6}}><b style={{fontSize:15}}>Grand Total</b><b style={{fontSize:19,color:'#1565C0'}}>₹{grand.toFixed(2)}</b></div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:13}}><span>Received</span><span style={{color:'#2E7D32',fontWeight:600}}>₹{parseFloat(form.received||0).toFixed(2)}</span></div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:13,marginBottom:12}}><span>Balance</span><span style={{color:'#C62828',fontWeight:700}}>₹{(grand-parseFloat(form.received||0)).toFixed(2)}</span></div>
            <div style={{fontSize:11,color:'#757575',marginBottom:12,fontStyle:'italic'}}>{amtWords(grand)}</div>
            <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',padding:12,fontSize:14}} onClick={saveInvoice}>💾 Save Invoice</button>
          </div>
        </div>
      </div>
    </div>
  )
}