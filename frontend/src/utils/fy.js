// ═══════════════════════════════════════════════════════════════
// FINANCIAL YEAR UTILITIES
// Financial Year: April 1 → March 31
// Storage key format: inv_{year}_sales, inv_{year}_purchases ...
// ═══════════════════════════════════════════════════════════════

/**
 * Get financial year string for a given date
 * e.g. April 2025 → March 2026 = "2025_2026"
 */
export function getFinancialYear(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  const month = d.getMonth() // 0=Jan ... 11=Dec
  const year  = d.getFullYear()
  // April (3) onwards = new FY starts
  const fyStart = month >= 3 ? year : year - 1
  return `${fyStart}_${fyStart + 1}`
}

/**
 * Get FY label for display e.g. "2025-26"
 */
export function getFYLabel(fy) {
  if (!fy) return ''
  const [start, end] = fy.split('_')
  return `${start}-${String(end).slice(2)}`  // "2025-26"
}

/**
 * Get FY date range
 */
export function getFYRange(fy) {
  const [start] = fy.split('_')
  return {
    from: `${start}-04-01`,
    to:   `${parseInt(start) + 1}-03-31`
  }
}

/**
 * Get a default 'today' date that falls safely inside the selected FY.
 */
export function getDefaultDateForFY(fy) {
  const today = new Date().toISOString().split('T')[0]
  if (!fy) return today
  const range = getFYRange(fy)
  if (today >= range.from && today <= range.to) return today
  return range.to // If outside the year, fallback to March 31st of that FY
}

/**
 * Validate if a given date falls inside the given FY.
 */
export function validateDateInFY(dateStr, fy) {
  if (!dateStr || !fy) return true
  const range = getFYRange(fy)
  return dateStr >= range.from && dateStr <= range.to
}

/**
 * Get localStorage key for a module + year
 * e.g. getStorageKey('purchases', '2025_2026') → 'inv_2025_2026_purchases'
 */
export function getStorageKey(moduleName, fy) {
  if (!fy) fy = getFinancialYear()
  return `inv_${fy}_${moduleName}`
}

/**
 * Get all financial years that have data stored
 */
export function getAllStoredYears() {
  const years = new Set()
  // Current and last 5 years
  const now = new Date()
  for (let i = 0; i <= 5; i++) {
    const d = new Date(now.getFullYear() - i, now.getMonth(), 1)
    years.add(getFinancialYear(d))
  }
  // Also scan localStorage for any existing keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    const match = key?.match(/^inv_(\d{4}_\d{4})_/)
    if (match) years.add(match[1])
    // Also check archive keys
    const archMatch = key?.match(/^archive_(\d{4}_\d{4})/)
    if (archMatch) years.add(archMatch[1])
  }
  return Array.from(years).sort().reverse() // newest first
}

/**
 * Read data from localStorage for a module + year
 */
export function fyGet(moduleName, fy) {
  const key = getStorageKey(moduleName, fy)
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}

/**
 * Write data to localStorage for a module + year
 */
export function fySet(moduleName, fy, data) {
  const key = getStorageKey(moduleName, fy)
  localStorage.setItem(key, JSON.stringify(data))
}

/**
 * Check if a financial year is closed (read-only)
 */
export function isFYClosed(fy) {
  const closedYears = JSON.parse(localStorage.getItem('inv_closed_years') || '[]')
  return closedYears.includes(fy)
}

/**
 * Close a financial year — archives data and marks as closed
 * Returns { success, message }
 */
export function closeFinancialYear(fy) {
  if (isFYClosed(fy)) return { success: false, message: 'Year is already closed.' }
  const currentFY = getFinancialYear()
  if (fy === currentFY) {
    // Check if FY is actually over (past March 31)
    const { to } = getFYRange(fy)
    if (new Date() <= new Date(to)) {
      // Allow closing mid-year with warning (handled in UI)
    }
  }
  // Archive all modules
  const MODULES = ['sales', 'purchases', 'expenses', 'parties', 'inventory', 'cdn']
  const archive  = { fy, closedAt: new Date().toISOString(), modules: {} }
  MODULES.forEach(mod => {
    archive.modules[mod] = fyGet(mod, fy)
  })
  // Save archive
  localStorage.setItem(`archive_${fy}`, JSON.stringify(archive))
  // Mark year as closed
  const closed = JSON.parse(localStorage.getItem('inv_closed_years') || '[]')
  if (!closed.includes(fy)) closed.push(fy)
  localStorage.setItem('inv_closed_years', JSON.stringify(closed))
  return { success: true, message: `Financial Year ${getFYLabel(fy)} closed successfully.` }
}

/**
 * Get archived data for a closed FY
 */
export function getArchive(fy) {
  try { return JSON.parse(localStorage.getItem(`archive_${fy}`) || 'null') } catch { return null }
}

/**
 * Migrate old flat data (inv_sales etc.) to year-based keys
 * Call once on first load to migrate existing data
 */
export function migrateOldData() {
  const migrated = localStorage.getItem('inv_fy_migrated')
  if (migrated) return // already done

  const currentFY = getFinancialYear()
  const OLD_MAP = {
    'inv_invoices':   'sales',
    'bizcloud_invoices': 'sales',
    'inv_purchases':  'purchases',
    'inv_expenses':   'expenses',
    'inv_parties':    'parties',
    'inv_products':   'inventory',
    'inv_cdn':        'cdn',
  }

  Object.entries(OLD_MAP).forEach(([oldKey, module]) => {
    const existing = localStorage.getItem(oldKey)
    if (!existing) return
    try {
      const data = JSON.parse(existing)
      if (!Array.isArray(data) || data.length === 0) return
      // Only migrate if new key doesn't exist yet
      const newKey = getStorageKey(module, currentFY)
      const newData = JSON.parse(localStorage.getItem(newKey) || '[]')
      if (newData.length === 0) {
        localStorage.setItem(newKey, existing)
        console.log(`Migrated ${oldKey} → ${newKey} (${data.length} records)`)
      }
    } catch {}
  })

  localStorage.setItem('inv_fy_migrated', 'true')
}

/**
 * Get current active FY from localStorage (user-selected or auto)
 */
export function getActiveFY() {
  return localStorage.getItem('inv_active_fy') || getFinancialYear()
}

/**
 * Set active FY
 */
export function setActiveFY(fy) {
  localStorage.setItem('inv_active_fy', fy)
  window.dispatchEvent(new CustomEvent('fy_changed', { detail: { fy } }))
}

// Role check helper
export function isOwnerOrManager() {
  const user = JSON.parse(localStorage.getItem('inv_user') || '{}')
  return ['owner', 'manager'].includes((user.role || '').toLowerCase())
}