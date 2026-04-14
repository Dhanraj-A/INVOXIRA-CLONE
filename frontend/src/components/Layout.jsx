import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { getActiveFY, getFYLabel, isFYClosed, getAllStoredYears, setActiveFY, migrateOldData } from '../utils/fy'
import FinancialYearManager from './FinancialYearManager'

const menu = [
  { section:'TRANSACTIONS' },
  { path:'dashboard', icon:'⊞', label:'Dashboard' },
  { path:'sale',      icon:'🧾', label:'Sale' },
  { path:'purchase',  icon:'🛒', label:'Purchase' },
  { path:'expenses',  icon:'💸', label:'Expenses' },
  { section:'MANAGE' },
  { path:'inventory', icon:'📦', label:'Inventory' },
  { path:'parties',   icon:'👥', label:'Parties' },
  { section:'REPORTS & TOOLS' },
  { path:'reports',   icon:'📊', label:'Reports' },
  { path:'print',     icon:'🖨️',  label:'Print Themes' },
  { section:'UTILITIES' },
  { path:'staff',     icon:'👔', label:'Staff' },
  { path:'settings',  icon:'🏢',  label:'Profile' },
  { path:'fy-closing', icon:'🔒', label:'FY Closing' },
  { path:'cdn',       icon:'📝', label:'Credit/Debit Note' },
]

export default function Layout() {
  const nav = useNavigate()
  const loc = useLocation()
  const [biz, setBiz] = useState(() => JSON.parse(localStorage.getItem('inv_biz') || '{}'))
  const [activeFY, setActiveFYState] = useState(getActiveFY())
  const [allYears,  setAllYears]     = useState([])
  const user = JSON.parse(localStorage.getItem('inv_user') || '{}')

  useEffect(() => {
    const onUpdate = () => setBiz(JSON.parse(localStorage.getItem('inv_biz') || '{}'))
    window.addEventListener('biz_updated', onUpdate)
    // FY handler
    migrateOldData()
    setAllYears(getAllStoredYears())
    const onFY = (e) => { setActiveFYState(e.detail.fy); setAllYears(getAllStoredYears()) }
    window.addEventListener('fy_changed', onFY)
    return () => { window.removeEventListener('biz_updated', onUpdate); window.removeEventListener('fy_changed', onFY) }
  }, [])

  const bizName  = biz.businessName || 'Invoxira Cloud'
  const displayName = user.name || biz.ownerName || 'User'
  const logo     = biz.logo         || null
  const currentPath = loc.pathname.split('/')[1] || 'dashboard'

  function logout() {
    if (confirm('Logout?')) {
      localStorage.removeItem('inv_token')
      localStorage.removeItem('inv_user')
      window.location.href = '/login'
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          {logo
            ? <img src={logo} alt="logo" style={{ width:34, height:34, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
            : <div className="sidebar-logo-icon">I</div>
          }
          <div style={{ overflow:'hidden' }}>
            <div className="sidebar-logo-text" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{bizName}</div>
            <div className="sidebar-logo-sub">Business Suite</div>
          </div>
        </div>
        <nav style={{ flex:1, paddingBottom:8 }}>
          {menu.map((item, i) =>
            item.section
              ? <div key={i} className="nav-section">{item.section}</div>
              : <div key={item.path} className={`nav-item ${currentPath===item.path?'active':''}`} onClick={()=>nav(`/${item.path}`)}>
                  <span className="icon">{item.icon}</span><span>{item.label}</span>
                </div>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="nav-item" onClick={logout}><span className="icon">🚪</span><span>Logout</span></div>
        </div>
      </aside>

      <div className="main-wrap">
        <header className="topbar">
          <div className="topbar-title">{bizName}</div>
          <div style={{ flex:1 }} />
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <FinancialYearManager compact={true} />
          </div>
          <button className="topbar-btn" onClick={()=>window.location.reload()}>🔄 Sync</button>
          <button className="topbar-btn" onClick={()=>alert('No new notifications')}>🔔</button>
          <div className="topbar-user" onClick={()=>nav('/settings')} style={{ cursor:'pointer' }}>
            👤 {displayName}
          </div>
        </header>
        <main className="main-content"><Outlet /></main>
      </div>
    </div>
  )
}