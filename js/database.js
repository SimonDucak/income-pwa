// initSqlJs comes from vendor/sql-wasm-inline.js, loaded by index.html.
const DB_VERSION = 1
const DB_NAME = 'income-counter-preferences'
const STORE = 'handles'
const SCHEMA = `
CREATE TABLE IF NOT EXISTS months (
 id INTEGER PRIMARY KEY, year INTEGER NOT NULL CHECK(year BETWEEN 1900 AND 9999), month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
 income INTEGER NOT NULL DEFAULT 0 CHECK(income >= 0), created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(year, month)
);
CREATE TABLE IF NOT EXISTS expense_templates (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount >= 0),
 amount_type TEXT NOT NULL CHECK(amount_type IN ('EUR','PERCENT_INCOME','PERCENT_REMAINING')), sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS monthly_expenses (
 id INTEGER PRIMARY KEY, month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE, name TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount >= 0), amount_type TEXT NOT NULL CHECK(amount_type IN ('EUR','PERCENT_INCOME','PERCENT_REMAINING')), sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS monthly_expenses_month_order ON monthly_expenses(month_id, sort_order);
PRAGMA user_version = 1;
`

let SQL
let db
let fileHandle = null
let dirty = false
let connected = false
let filename = ''
let lastBackupReminder = Date.now()

async function initializeSql() {
  if (SQL) return
  if (typeof initSqlJs !== 'function') throw new Error('SQLite failed to load. Check that vendor/sql-asm.js is next to this site.')
  SQL = await initSqlJs()
}

function openPreferences() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function getHandle() {
  try {
    const idb = await openPreferences()
    return await new Promise((resolve, reject) => {
      const request = idb.transaction(STORE).objectStore(STORE).get('database')
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch { return null }
}
async function setHandle(handle) {
  try {
    const idb = await openPreferences()
    await new Promise((resolve, reject) => {
      const request = idb.transaction(STORE, 'readwrite').objectStore(STORE).put(handle, 'database')
      request.onsuccess = resolve
      request.onerror = () => reject(request.error)
    })
  } catch { /* Remembering a handle is optional. */ }
}

function getDb() { return db }
function getStatus() {
  return { state: !db ? 'disconnected' : (connected ? 'connected' : 'import'), dirty, filename }
}

function validate(database) {
  const version = database.exec('PRAGMA user_version')[0]?.values[0][0] || 0
  if (version > DB_VERSION) throw new Error(`This database uses a newer schema (version ${version}). Update the app to open it.`)
  if (version === 0) {
    const tables = database.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]?.values.flat() || []
    if (tables.length && !tables.includes('months')) throw new Error('This file is not an income-counter database.')
    database.run(SCHEMA)
  }
  const required = ['months', 'monthly_expenses', 'expense_templates']
  const tables = database.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]?.values.flat() || []
  if (!required.every((table) => tables.includes(table))) throw new Error('Database schema is incomplete.')
  const integrity = database.exec('PRAGMA integrity_check')[0]?.values[0][0]
  if (integrity !== 'ok') throw new Error(`Database integrity check failed: ${integrity}`)
}

async function attach(bytes, handle, name) {
  await initializeSql()
  const opened = new SQL.Database(bytes)
  validate(opened)
  db?.close()
  db = opened
  fileHandle = handle || null
  filename = name || 'Imported database'
  connected = false
  dirty = false
  if (fileHandle && fileHandle.createWritable) {
    const permission = await fileHandle.queryPermission({ mode: 'readwrite' }).catch(() => 'prompt')
    connected = permission === 'granted'
  }
  if (fileHandle) await setHandle(fileHandle)
  return getStatus()
}

async function reconnect() {
  if (!window.showOpenFilePicker) return false
  const handle = await getHandle()
  if (!handle) return false
  try {
    let permission = await handle.queryPermission({ mode: 'readwrite' })
    if (permission !== 'granted') permission = await handle.requestPermission({ mode: 'readwrite' })
    if (permission !== 'granted') return false
    const file = await handle.getFile()
    await attach(new Uint8Array(await file.arrayBuffer()), handle, file.name)
    connected = true
    return true
  } catch { return false }
}

async function openPickedFile(file) {
  return attach(new Uint8Array(await file.arrayBuffer()), null, file.name)
}
async function openHandle(handle) {
  const permission = await handle.requestPermission({ mode: 'readwrite' })
  if (permission !== 'granted') throw new Error('Write access was not granted. You can continue in export mode.')
  const file = await handle.getFile()
  await attach(new Uint8Array(await file.arrayBuffer()), handle, file.name)
  connected = true
  return getStatus()
}
async function createNewDatabase() {
  await initializeSql()
  const fresh = new SQL.Database()
  fresh.run(SCHEMA)
  db?.close()
  db = fresh
  fileHandle = null
  filename = 'New database'
  dirty = true
  connected = false
  return getStatus()
}
async function loadTemplate(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not load the database template.')
  return attach(new Uint8Array(await response.arrayBuffer()), null, 'database-template.sqlite')
}

function transaction(callback) {
  if (!db) throw new Error('Select a database first.')
  db.run('BEGIN IMMEDIATE')
  try { const result = callback(db); db.run('COMMIT'); dirty = true; return result }
  catch (error) { db.run('ROLLBACK'); throw error }
}
async function save() {
  if (!db) throw new Error('No database is connected.')
  if (!fileHandle || !connected) { dirty = true; return { written: false } }
  const writable = await fileHandle.createWritable()
  try { await writable.write(db.export()); await writable.close(); dirty = false; return { written: true } }
  catch (error) { await writable.abort?.(); connected = false; dirty = true; throw error }
}
function exportBytes() { if (!db) throw new Error('No database is connected.'); return db.export() }
async function disconnect() {
  db?.close(); db = null; fileHandle = null; connected = false; dirty = false; filename = ''
  try { const idb = await openPreferences(); await new Promise((resolve) => { const request = idb.transaction(STORE, 'readwrite').objectStore(STORE).delete('database'); request.onsuccess = resolve; request.onerror = resolve }) } catch { /* optional */ }
}
function shouldRemindBackup() {
  if (Date.now() - lastBackupReminder > 7 * 24 * 60 * 60 * 1000) { lastBackupReminder = Date.now(); return true }
  return false
}
