const app = document.querySelector('#app')
let screen = 'dashboard'
let selectedId = null
let notice = ''
let timer
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const rows = (sql, params = []) => { const database = getDb(); if (!database) return []; const r = database.exec(sql, params); return r.length ? r[0].values.map(v => Object.fromEntries(r[0].columns.map((c, i) => [c, v[i]]))) : [] }
const months = () => rows('SELECT * FROM months ORDER BY year DESC, month DESC')
const expenses = id => rows('SELECT * FROM monthly_expenses WHERE month_id=? ORDER BY sort_order,id', [id])
const selected = () => rows('SELECT * FROM months WHERE id=?', [selectedId])[0]
function toast(message, error = false) { notice = message; render(); clearTimeout(timer); timer = setTimeout(() => { notice = ''; render() }, error ? 7000 : 3500) }

function shell(content) {
  const s = getStatus()
  const status = s.state === 'connected' ? 'Connected · writable' : s.state === 'import' ? 'Import mode · export to save' : 'Not connected'
  return `<div class="app-shell"><aside class="sidebar"><a class="brand" href="#"><span class="brand-mark">i</span><span>income<span class="brand-dot">.</span><small>YOUR MONEY, IN BALANCE</small></span></a><div class="workspace-label">WORKSPACE</div><nav class="side-nav"><button data-screen="dashboard" class="nav-item ${screen === 'dashboard' ? 'active' : ''}"><span>⌂</span>Overview</button><button data-screen="history" class="nav-item ${screen === 'history' ? 'active' : ''}"><span>◷</span>History</button><button data-screen="settings" class="nav-item ${screen === 'settings' ? 'active' : ''}"><span>⚙</span>Settings</button></nav><div class="sidebar-bottom"><div class="privacy-card"><span>⌑</span><strong>Your finances stay yours.</strong><p>Private by design. Your database lives on your device.</p></div><div class="side-version">INCOME COUNTER <span>v1.0</span></div></div></aside><main class="main-content"><header class="topbar"><div class="mobile-brand"><span class="brand-mark">i</span>income<span class="brand-dot">.</span></div><div class="topbar-spacer"></div><button class="connection" data-action="connection"><i class="status-dot ${s.state}"></i>${status}</button><button class="avatar" data-screen="settings">${esc(s.filename?.[0]?.toUpperCase() || 'I')}</button></header><div class="page-wrap">${notice ? `<div class="toast">${esc(notice)}<button data-action="dismiss">×</button></div>` : ''}${content}</div><nav class="mobile-nav"><button data-screen="dashboard" class="${screen === 'dashboard' ? 'active' : ''}"><span>⌂</span>Overview</button><button data-screen="history" class="${screen === 'history' ? 'active' : ''}"><span>◷</span>History</button><button data-screen="settings" class="${screen === 'settings' ? 'active' : ''}"><span>⚙</span>Settings</button></nav></main></div>`
}

function welcome() {
  return `<section class="welcome"><div class="welcome-art"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="art-card"><span>MONTHLY BALANCE</span><strong>€ 2.840,00</strong><i></i><i></i><i></i></div><span class="spark spark-one">✳</span><span class="spark spark-two">✦</span></div><div class="welcome-body"><p class="eyebrow">A CLEARER WAY TO PLAN</p><h1>Your money,<br><em>in balance.</em></h1><p class="welcome-copy">A calm, private space to make sense of what comes in and what goes out. Your data stays on your device, always.</p><div class="welcome-actions"><button class="button button-primary" data-action="download-template">↓ &nbsp;Download a new database</button><button class="button button-secondary" data-action="pick-file">↗ &nbsp;Select an existing database</button></div><p class="welcome-footnote">⌑ &nbsp;No account needed. Works offline. Yours to keep.</p></div></section>`
}

function dashboard() {
  const all = months()
  if (!all.length) return `<div class="page-heading"><div><p class="eyebrow">YOUR OVERVIEW</p><h1>Welcome to your money.</h1></div></div>${welcome()}`
  const month = selected() || all[0]
  selectedId = month.id
  const list = expenses(month.id)
  const calc = calculate(month.income, list)
  const label = monthName(month.year, month.month)
  return `<div class="page-heading"><div><p class="eyebrow">YOUR OVERVIEW</p><h1>Good money habits, <em>made simple.</em></h1><p class="heading-sub">A little clarity goes a long way.</p></div><button class="button button-primary create-month" data-action="new-month">＋ &nbsp;Create new month</button></div><section class="month-strip"><div class="month-selector"><button class="icon-button" data-action="prev-month">‹</button><div><span class="strip-label">CURRENT MONTH</span><strong>${esc(label)}</strong></div><button class="icon-button" data-action="next-month">›</button></div><button class="text-button" data-screen="history">View history →</button></section><section class="summary-grid"><article class="metric-card income-card"><div class="metric-label"><span class="metric-icon income-icon">↗</span>MONTHLY INCOME</div><div class="metric-number">${money(month.income)}</div><button class="metric-edit" data-action="edit-income">Edit income ↗</button><div class="metric-decoration">€</div></article><article class="metric-card balance-card"><div class="balance-top"><div class="metric-label"><span class="metric-icon balance-icon">◎</span>LEFT TO LIVE ON</div><span class="balance-tag">${calc.remaining >= 0 ? 'ON TRACK' : 'OVER BUDGET'}</span></div><div class="metric-number">${money(calc.remaining)}</div><p class="balance-caption">After all your monthly expenses</p><div class="balance-progress"><span style="width:${Math.max(0, Math.min(100, month.income ? calc.remaining / month.income * 100 : 0))}%"></span></div><div class="progress-label"><span>Income remaining</span><span>${month.income ? Math.max(0, calc.remaining / month.income * 100).toFixed(0) : 0}%</span></div></article><article class="metric-card expense-card"><div class="metric-label"><span class="metric-icon expense-icon">↘</span>TOTAL EXPENSES</div><div class="metric-number">${money(calc.total)}</div><div class="expense-split"><span>Fixed <strong>${money(calc.fixed)}</strong></span><span>Percentage <strong>${money(calc.percentage)}</strong></span></div></article></section><section class="expense-section"><div class="section-heading"><div><p class="eyebrow">THE BREAKDOWN</p><h2>Your expenses <span class="count-pill">${list.length}</span></h2></div><button class="button button-secondary" data-action="add-expense">＋ Add expense</button></div>${list.length ? `<div class="expense-list"><div class="list-head"><span>EXPENSE</span><span>CALCULATION</span><span>AMOUNT</span><span>REMAINING</span><span></span></div>${list.map((row, i) => `<article class="expense-row"><div class="expense-title"><span class="row-index">${String(i + 1).padStart(2, '0')}</span><div><strong>${esc(row.name)}</strong><small>${row.amount_type === 'EUR' ? 'Fixed amount' : row.amount_type === 'PERCENT_INCOME' ? 'Of monthly income' : 'Of remaining'}</small></div></div><div class="calculation-type"><i class="type-dot ${row.amount_type.toLowerCase()}"></i>${row.amount_type === 'EUR' ? 'Fixed' : row.amount_type === 'PERCENT_INCOME' ? 'Income' : 'Remaining'}</div><div class="expense-amount"><strong>${amountText(row.amount, row.amount_type)}</strong><small>${row.amount_type === 'EUR' ? 'EUR' : 'PERCENT'}</small></div><div class="remaining-value">${money(calc.rows[i].remaining)}</div><div class="row-controls"><button class="tiny-button" data-action="move-up" data-id="${row.id}" ${i === 0 ? 'disabled' : ''}>↑</button><button class="tiny-button" data-action="move-down" data-id="${row.id}" ${i === list.length - 1 ? 'disabled' : ''}>↓</button><button class="dots-button" data-action="edit-expense" data-id="${row.id}">•••</button></div></article>`).join('')}</div>` : `<div class="empty-expenses"><span>✳</span><strong>A fresh start.</strong><p>Add your first expense and we’ll keep the numbers in line.</p><button class="text-button" data-action="add-expense">Add an expense →</button></div>`}<div class="order-note">↕ &nbsp;Use arrows to reorder. Remaining percentage expenses use the balance at their position.</div></section><footer class="page-footer"><span>Made for a little more peace of mind.</span><span>Private by design · Always yours</span></footer>`
}

function history() {
  const all = months()
  if (!all.length) return `<div class="page-heading"><div><p class="eyebrow">YOUR TIMELINE</p><h1>Month by month.</h1></div></div><div class="empty-panel">Your saved months will appear here.</div>`
  const month = selected() || all[0]
  selectedId = month.id
  const list = expenses(month.id)
  const calc = calculate(month.income, list)
  return `<div class="page-heading"><div><p class="eyebrow">YOUR TIMELINE</p><h1>Month by month.</h1><p class="heading-sub">A little perspective makes progress visible.</p></div></div><section class="history-layout"><div class="history-list"><div class="history-list-heading">ALL MONTHS <span>${all.length}</span></div>${all.map(m => { const c = calculate(m.income, expenses(m.id)); return `<button class="history-item ${m.id === month.id ? 'selected' : ''}" data-action="select-month" data-id="${m.id}"><span class="history-date"><b>${new Date(m.year, m.month - 1, 1).toLocaleString('en', { month: 'short' })}</b><small>${m.year}</small></span><span class="history-item-title">${monthName(m.year, m.month)}<small>${expenses(m.id).length} expenses</small></span><span class="history-balance">${money(c.remaining)}<small>remaining</small></span></button>` }).join('')}</div><article class="history-detail"><div class="history-detail-head"><div><p class="eyebrow">MONTHLY SUMMARY</p><h2>${monthName(month.year, month.month)}</h2></div><button class="button button-secondary" data-action="edit-income">Edit month</button></div><div class="history-total"><span>Remaining balance</span><strong>${money(calc.remaining)}</strong></div><div class="history-stat-grid"><div><span>Monthly income</span><strong>${money(month.income)}</strong></div><div><span>Total expenses</span><strong>${money(calc.total)}</strong></div></div><div class="history-expenses-title">EXPENSES <span>${list.length}</span></div>${list.length ? list.map((e, i) => `<div class="history-expense"><span><b>${esc(e.name)}</b><small>${amountText(e.amount, e.amount_type)}</small></span><strong>${money(calc.rows[i].calculated)}</strong></div>`).join('') : '<p class="history-no-expenses">No expenses recorded.</p>'}<div class="history-nav"><button data-action="prev-month">← Previous month</button><button data-action="next-month">Next month →</button></div></article></section>`
}

function settings() {
  const s = getStatus()
  return `<div class="page-heading"><div><p class="eyebrow">YOUR SPACE</p><h1>Made for peace of mind.</h1><p class="heading-sub">Your data belongs to you. Here’s how we keep it that way.</p></div></div><section class="settings-content"><article class="settings-card"><div class="settings-card-title"><span class="settings-icon">▣</span><div><h2>Your database</h2><p>Your financial information is stored in your own SQLite file.</p></div></div><div class="database-info"><i class="status-dot ${s.state}"></i><div><strong>${esc(s.filename || 'No database selected')}</strong><small>${s.state === 'connected' ? 'Connected & writable on this device' : s.state === 'import' ? 'Import mode · export a copy to save changes' : 'Choose a database file to get started'}</small></div><span class="state-pill ${s.state}">${s.state === 'connected' ? 'CONNECTED' : s.state === 'import' ? 'IMPORT MODE' : 'NOT CONNECTED'}</span></div><div class="settings-actions"><button class="button button-secondary" data-action="pick-file">Select database</button><button class="button button-secondary" data-action="disconnect" ${s.filename ? '' : 'disabled'}>Disconnect</button></div></article><article class="settings-card"><div class="settings-card-title"><span class="settings-icon">↓</span><div><h2>Backups & restore</h2><p>Keep a copy somewhere safe. Your exported file works independently from this app.</p></div></div><div class="settings-actions"><button class="button button-primary" data-action="export">↓ &nbsp;Export database</button><button class="button button-secondary" data-action="restore">Import / restore</button></div></article><article class="settings-card"><div class="settings-card-title"><span class="settings-icon">⌑</span><div><h2>Offline, by design</h2><p>The app shell works without internet once loaded. Your database is never cached by the app.</p></div></div><div class="privacy-note">On browsers without direct file access, changes are held in this session until exported. Export regularly to keep your own copy up to date.</div></article></section>`
}

function render() { app.innerHTML = shell(screen === 'dashboard' ? dashboard() : screen === 'history' ? history() : settings()) }

function dialog(title, body, submit = 'Save') {
  const host = document.createElement('div')
  host.innerHTML = `<div class="modal-backdrop" data-action="close-modal"><form class="modal" data-form="modal"><button type="button" class="modal-close" data-action="close-modal">×</button><p class="eyebrow">INCOME COUNTER</p><h2>${title}</h2>${body}<div class="modal-actions"><button type="button" class="button button-secondary" data-action="close-modal">Cancel</button><button class="button button-primary" type="submit">${submit}</button></div></form></div>`
  document.body.append(host.firstElementChild)
  document.querySelector('.modal input')?.focus()
}

const input = (label, name, value = '', type = 'text', hint = '') => `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value)}" ${type === 'number' ? 'min="0" step="0.01"' : ''} required>${hint ? `<small>${hint}</small>` : ''}</label>`
function incomeDialog() {
  const m = selected()
  if (!m) return
  dialog('Set your monthly income', `${input('Monthly income (€)', 'income', (m.income / 100).toFixed(2), 'number', 'Enter the amount you have available each month.')}`)
}
function expenseDialog(id = null) {
  const e = id ? expenses(selectedId).find(row => row.id === Number(id)) : null
  dialog(e ? 'Edit expense' : 'Add an expense', `${input('Expense name', 'name', e?.name || '')}<label class="field"><span>Calculation type</span><select name="amount_type"><option value="EUR" ${e?.amount_type === 'EUR' ? 'selected' : ''}>Fixed amount (€)</option><option value="PERCENT_INCOME" ${e?.amount_type === 'PERCENT_INCOME' ? 'selected' : ''}>Percentage of income</option><option value="PERCENT_REMAINING" ${e?.amount_type === 'PERCENT_REMAINING' ? 'selected' : ''}>Percentage of remaining balance</option></select></label>${input('Amount', 'amount', e ? (e.amount / 100).toFixed(2) : '', 'number', 'Percentages can be entered with up to two decimal places.')}${e ? `<input type="hidden" name="id" value="${e.id}"><button class="danger-link" type="button" data-action="delete-expense" data-id="${e.id}">Delete this expense</button>` : ''}`)
}
function monthDialog() {
  const d = new Date()
  dialog('Create a new month', `<p class="modal-copy">Start fresh or bring forward the expense setup from an earlier month. Each month keeps its own independent history.</p><label class="field"><span>Month</span><input name="month" type="month" value="${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}" required></label><label class="check-field"><input name="duplicate" type="checkbox" checked><span>Copy expenses from the latest month</span></label>`)
}
function download(data, name) {
  const blob = new Blob([data], { type: 'application/vnd.sqlite3' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function persist() { await save() }
async function pickDatabase() {
  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'SQLite database', accept: { 'application/vnd.sqlite3': ['.sqlite', '.sqlite3', '.db'] } }] })
    await openHandle(handle)
  } else {
    const picker = document.createElement('input'); picker.type = 'file'; picker.accept = '.sqlite,.sqlite3,.db,application/vnd.sqlite3'; picker.hidden = true
    document.body.append(picker)
    picker.onchange = async () => { try { if (picker.files[0]) { await openPickedFile(picker.files[0]); selectedId = months()[0]?.id || null; render(); toast('Database opened in import mode. Export to save changes.') } } catch (e) { toast(e.message, true) } finally { picker.remove() } }
    picker.click(); return
  }
  selectedId = months()[0]?.id || null; render(); toast('Your database is ready.')
}
async function startFresh() {
  await createNewDatabase()
  const now = new Date()
  transaction(db => db.run('INSERT OR IGNORE INTO months (year,month,income,created_at,updated_at) VALUES (?,?,0,?,?)', [now.getFullYear(), now.getMonth() + 1, new Date().toISOString(), new Date().toISOString()]))
  selectedId = months()[0]?.id
  download(exportBytes(), 'income-counter.sqlite')
  screen = 'dashboard'; render(); toast('Your new database is ready. Keep the downloaded file somewhere safe.')
}
async function moveExpense(id, direction) {
  const list = expenses(selectedId), index = list.findIndex(row => row.id === Number(id)), target = index + direction
  if (target < 0 || target >= list.length) return
  transaction(db => {
    const first = list[index], second = list[target]
    db.run('UPDATE monthly_expenses SET sort_order=? WHERE id=?', [second.sort_order, first.id])
    db.run('UPDATE monthly_expenses SET sort_order=? WHERE id=?', [first.sort_order, second.id])
  })
  await persist(); render()
}
async function createMonth(form) {
  const [year, month] = form.get('month').split('-').map(Number)
  const existing = rows('SELECT id FROM months WHERE year=? AND month=?', [year, month])[0]
  if (existing) { selectedId = existing.id; screen = 'dashboard'; render(); toast('That month already exists.'); return }
  const previous = months()[0]
  const now = new Date().toISOString()
  transaction(db => {
    db.run('INSERT INTO months (year,month,income,created_at,updated_at) VALUES (?,?,0,?,?)', [year, month, now, now])
    const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0]
    if (form.get('duplicate')) {
      if (previous) for (const e of expenses(previous.id)) db.run('INSERT INTO monthly_expenses (month_id,name,amount,amount_type,sort_order) VALUES (?,?,?,?,?)', [id, e.name, e.amount, e.amount_type, e.sort_order])
    }
    selectedId = id
  })
  await persist(); screen = 'dashboard'; render(); toast('Your month is ready.')
}

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-screen], [data-action]')
  if (!button) return
  if (button.dataset.screen) { screen = button.dataset.screen; render(); return }
  const action = button.dataset.action
  try {
    if (action === 'dismiss') { notice = ''; render() }
    else if (action === 'close-modal') { if (event.target === button || button.classList.contains('modal-close')) button.closest('.modal-backdrop')?.remove() }
    else if (action === 'new-month') monthDialog()
    else if (action === 'edit-income') incomeDialog()
    else if (action === 'add-expense') expenseDialog()
    else if (action === 'edit-expense') expenseDialog(button.dataset.id)
    else if (action === 'delete-expense') {
      if (confirm('Delete this expense from the month?')) { transaction(db => db.run('DELETE FROM monthly_expenses WHERE id=?', [Number(button.dataset.id)])); await persist(); document.querySelector('.modal-backdrop')?.remove(); render(); toast('Expense deleted.') }
    } else if (action === 'move-up') await moveExpense(button.dataset.id, -1)
    else if (action === 'move-down') await moveExpense(button.dataset.id, 1)
    else if (action === 'select-month') { selectedId = Number(button.dataset.id); render() }
    else if (action === 'prev-month' || action === 'next-month') {
      const all = months(), index = all.findIndex(m => m.id === selectedId), target = all[index + (action === 'prev-month' ? 1 : -1)]
      if (target) { selectedId = target.id; render() }
    } else if (action === 'download-template') await startFresh()
    else if (action === 'pick-file' || action === 'connection') await pickDatabase()
    else if (action === 'disconnect') { await disconnect(); selectedId = null; screen = 'dashboard'; render(); toast('Database disconnected.') }
    else if (action === 'export') { download(exportBytes(), `${getStatus().filename.replace(/\.[^.]+$/, '') || 'income-counter'}-backup.sqlite`); toast('Database exported.') }
    else if (action === 'restore') {
      const picker = document.createElement('input'); picker.type = 'file'; picker.accept = '.sqlite,.sqlite3,.db,application/vnd.sqlite3'; picker.hidden = true; document.body.append(picker)
      picker.onchange = async () => { try { if (picker.files[0]) { await openPickedFile(picker.files[0]); selectedId = months()[0]?.id || null; render(); toast('Database restored in import mode. Export to save changes.') } } catch (e) { toast(e.message, true) } finally { picker.remove() } }; picker.click()
    }
  } catch (error) { toast(error.message || 'Something went wrong.', true) }
})

document.addEventListener('submit', async event => {
  if (event.target.dataset.form !== 'modal') return
  event.preventDefault()
  const form = new FormData(event.target)
  try {
    if (form.has('month')) { await createMonth(form); event.target.closest('.modal-backdrop')?.remove(); return }
    if (form.has('income')) {
      const value = Math.round(Number(form.get('income')) * 100)
      if (!Number.isFinite(value) || value < 0) throw new Error('Enter a valid non-negative income.')
      transaction(db => db.run('UPDATE months SET income=?, updated_at=? WHERE id=?', [value, new Date().toISOString(), selectedId]))
    } else if (form.has('name')) {
      const name = form.get('name').trim(), amount = Math.round(Number(form.get('amount')) * 100), type = form.get('amount_type')
      if (!name) throw new Error('Enter an expense name.')
      if (!Number.isFinite(amount) || amount < 0 || ((type !== 'EUR') && amount > 10000)) throw new Error('Enter a valid amount; percentages must be between 0 and 100.')
      transaction(db => {
        if (form.has('id')) db.run('UPDATE monthly_expenses SET name=?,amount=?,amount_type=? WHERE id=?', [name, amount, type, Number(form.get('id'))])
        else db.run('INSERT INTO monthly_expenses (month_id,name,amount,amount_type,sort_order) VALUES (?,?,?,?,?)', [selectedId, name, amount, type, expenses(selectedId).length])
      })
    }
    await persist(); event.target.closest('.modal-backdrop')?.remove(); render(); toast('Changes saved.')
  } catch (error) { toast(error.message, true) }
})

async function boot() {
  render()
  try {
    const restored = await reconnect()
    if (restored && getStatus().state === 'connected') {
      selectedId = months()[0]?.id || null
      render()
    }
  } catch { /* A remembered handle may require a user gesture; settings can reconnect it. */ }
  if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {})
  }
  if (getStatus().dirty && shouldRemindBackup()) toast('A quick reminder: export a backup of your database now and then.')
}
boot()
