// ===== State =====
const state = {
  deposits: [],        // [{ amount, pool, date, timestamp }]
  startDate: '',
  scriptUrl: '',
  currentPool: 'double',
  currentTab: 'home',
  pendingAmount: null,
  pendingPool: null,
};

// ===== Constants =====
const DOUBLE_POOL = Array.from({ length: 180 }, (_, i) => (i + 1) * 2); // 2,4,...,360
const NORMAL_POOL = Array.from({ length: 185 }, (_, i) => i + 181);     // 181,...,365
const TARGET_AMOUNT = DOUBLE_POOL.reduce((a, b) => a + b, 0) + NORMAL_POOL.reduce((a, b) => a + b, 0); // 83,085

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  renderAll();
});

// ===== Storage =====
function loadFromStorage() {
  try {
    state.deposits = JSON.parse(localStorage.getItem('deposits') || '[]');
    state.startDate = localStorage.getItem('startDate') || '';
    state.scriptUrl = localStorage.getItem('scriptUrl') || '';
  } catch (e) {
    state.deposits = [];
  }
  // Populate settings inputs
  const dateInput = document.getElementById('startDateInput');
  const urlInput = document.getElementById('scriptUrlInput');
  if (dateInput) dateInput.value = state.startDate;
  if (urlInput) urlInput.value = state.scriptUrl;
}

function saveToStorage() {
  localStorage.setItem('deposits', JSON.stringify(state.deposits));
  localStorage.setItem('startDate', state.startDate);
  localStorage.setItem('scriptUrl', state.scriptUrl);
}

// ===== Helpers =====
function getCurrentDay() {
  if (!state.startDate) return 0;
  const start = new Date(state.startDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - start) / 86400000);
  return Math.max(0, diff + 1);
}

function getUsedAmounts(pool) {
  return new Set(state.deposits.filter(d => d.pool === pool).map(d => d.amount));
}

function getPoolAmounts(pool) {
  return pool === 'double' ? DOUBLE_POOL : NORMAL_POOL;
}

function getPoolTotal(pool) {
  return state.deposits.filter(d => d.pool === pool).reduce((sum, d) => sum + d.amount, 0);
}

function getTotalSaved() {
  return state.deposits.reduce((sum, d) => sum + d.amount, 0);
}

function formatNumber(n) {
  return n.toLocaleString('zh-TW');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDateFull(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

// ===== Render All =====
function renderAll() {
  renderHome();
  renderGrid();
  renderHistory();
}

// ===== Home Tab =====
function renderHome() {
  const completed = state.deposits.length;
  const totalSaved = getTotalSaved();
  const doubleUsed = getUsedAmounts('double');
  const normalUsed = getUsedAmounts('normal');
  const currentDay = getCurrentDay();

  // Progress ring
  const circumference = 2 * Math.PI * 68; // ~427.26
  const progress = completed / 365;
  const offset = circumference * (1 - progress);
  document.getElementById('progressRing').style.strokeDashoffset = offset;
  document.getElementById('completedCount').textContent = completed;

  // Stats
  document.getElementById('totalSaved').textContent = formatNumber(totalSaved);
  document.getElementById('targetAmount').textContent = formatNumber(TARGET_AMOUNT);
  document.getElementById('doubleCompleted').textContent = `${doubleUsed.size} / 180`;
  document.getElementById('normalCompleted').textContent = `${normalUsed.size} / 185`;

  // Today card
  const todayDayNum = document.getElementById('todayDayNum');
  const todayBadge = document.getElementById('todayBadge');
  const todayDesc = document.getElementById('todayDesc');
  const todayBehind = document.getElementById('todayBehind');

  if (currentDay > 0) {
    todayDayNum.textContent = currentDay;
    const isDouble = currentDay <= 180;
    todayBadge.className = 'day-badge ' + (isDouble ? 'double' : 'normal');
    todayDesc.textContent = `第 ${currentDay} 天（${isDouble ? '雙倍期' : '正常期'}）`;

    const behind = currentDay - completed;
    if (behind > 0) {
      todayBehind.style.display = 'block';
      todayBehind.className = 'behind';
      todayBehind.textContent = `⚠️ 落後 ${behind} 天`;
    } else if (behind < 0) {
      todayBehind.style.display = 'block';
      todayBehind.className = 'ahead';
      todayBehind.textContent = `🎉 超前 ${Math.abs(behind)} 天`;
    } else {
      todayBehind.style.display = 'block';
      todayBehind.className = 'ahead';
      todayBehind.textContent = '✅ 進度完美！';
    }
  } else {
    todayDayNum.textContent = '-';
    todayDesc.textContent = '請在設定中設定開始日期';
    todayBehind.style.display = 'none';
  }
}

// ===== Deposit Grid =====
function switchPool(pool) {
  state.currentPool = pool;
  document.getElementById('tabDouble').classList.toggle('active', pool === 'double');
  document.getElementById('tabNormal').classList.toggle('active', pool === 'normal');
  renderGrid();
}

function renderGrid() {
  const pool = state.currentPool;
  const amounts = getPoolAmounts(pool);
  const used = getUsedAmounts(pool);
  const grid = document.getElementById('amountGrid');
  const poolTotal = getPoolTotal(pool);
  const poolTarget = amounts.reduce((a, b) => a + b, 0);

  // Pool info
  document.getElementById('poolProgress').textContent =
    `已選 ${used.size} / ${amounts.length}`;
  document.getElementById('poolSubtotal').textContent =
    `小計：${formatNumber(poolTotal)} 元`;

  // Build grid
  let html = '';
  amounts.forEach(amount => {
    const isCompleted = used.has(amount);
    html += `<div class="amount-cell${isCompleted ? ' completed' : ''}"
      onclick="${isCompleted ? '' : `selectAmount(${amount},'${pool}')`}"
      ${isCompleted ? 'style="pointer-events:none"' : ''}>
      ${amount}
    </div>`;
  });
  grid.innerHTML = html;
}

// ===== Modal =====
function selectAmount(amount, pool) {
  state.pendingAmount = amount;
  state.pendingPool = pool;

  document.getElementById('modalAmount').textContent = formatNumber(amount);
  const tag = document.getElementById('modalTag');
  tag.textContent = pool === 'double' ? '🔥 雙倍區' : '💎 正常區';
  tag.className = 'tag ' + pool;

  document.getElementById('confirmModal').classList.add('show');
}

function closeModal() {
  document.getElementById('confirmModal').classList.remove('show');
  state.pendingAmount = null;
  state.pendingPool = null;
}

function confirmDeposit() {
  const amount = state.pendingAmount;
  const pool = state.pendingPool;
  if (amount === null) return;

  const deposit = {
    amount,
    pool,
    date: new Date().toISOString().split('T')[0],
    timestamp: Date.now()
  };

  state.deposits.push(deposit);
  saveToStorage();
  closeModal();
  renderAll();
  showToast(`✅ 已存入 ${formatNumber(amount)} 元！`, 'success');

  // Sync to Google Sheets
  if (state.scriptUrl) {
    syncDeposit(deposit);
  }
}

// ===== History =====
function renderHistory() {
  const list = document.getElementById('historyList');
  const total = state.deposits.length;
  const totalAmount = getTotalSaved();

  document.getElementById('histTotal').textContent = total;
  document.getElementById('histAmount').textContent = formatNumber(totalAmount);
  document.getElementById('histPercent').textContent =
    total > 0 ? Math.round((total / 365) * 100) + '%' : '0%';

  if (total === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="icon">📋</div><div>尚無存款紀錄</div>
    </div>`;
    return;
  }

  // Sort newest first
  const sorted = [...state.deposits].sort((a, b) => b.timestamp - a.timestamp);
  let html = '';
  sorted.forEach((d, idx) => {
    const originalIdx = state.deposits.indexOf(d);
    html += `<div class="history-item">
      <div class="h-date">${formatDateFull(d.date)}</div>
      <div class="h-amount">${formatNumber(d.amount)} 元</div>
      <span class="h-badge ${d.pool}">${d.pool === 'double' ? '雙倍' : '正常'}</span>
      <button class="h-delete" onclick="deleteDeposit(${originalIdx})" title="刪除">✕</button>
    </div>`;
  });
  list.innerHTML = html;
}

function deleteDeposit(idx) {
  if (!confirm('確定要刪除這筆紀錄嗎？')) return;
  const removed = state.deposits.splice(idx, 1)[0];
  saveToStorage();
  renderAll();
  showToast('已刪除紀錄', 'error');

  // Sync deletion
  if (state.scriptUrl && removed) {
    syncDelete(removed);
  }
}

// ===== Tab Navigation =====
function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + tab).classList.add('active');
  document.querySelector(`.nav-item[data-tab="${tab}"]`).classList.add('active');

  if (tab === 'home') renderHome();
  if (tab === 'deposit') renderGrid();
  if (tab === 'history') renderHistory();
}

// ===== Settings =====
function saveSettings() {
  state.startDate = document.getElementById('startDateInput').value;
  state.scriptUrl = document.getElementById('scriptUrlInput').value.trim();
  saveToStorage();
  renderAll();
  showToast('✅ 設定已儲存', 'success');
}

function confirmReset() {
  if (!confirm('確定要重置所有資料嗎？此操作無法復原！')) return;
  if (!confirm('再次確認：所有存款紀錄將被刪除！')) return;
  state.deposits = [];
  saveToStorage();
  renderAll();
  showToast('資料已重置', 'error');
}

function exportData() {
  const data = {
    startDate: state.startDate,
    deposits: state.deposits,
    exportDate: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `savings-365-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ 資料已匯出', 'success');
}

// ===== Copy Apps Script =====
async function copyAppsScript() {
  const script = `const SHEET_NAME = '存款紀錄';

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange('A1:D1').setValues([['日期', '金額', '區間', '備註']]);
    sheet.getRange('A1:D1').setFontWeight('bold').setBackground('#4a90d9').setFontColor('white');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(2, 100);
    sheet.setColumnWidth(3, 80);
    sheet.setColumnWidth(4, 150);
  }
  return sheet;
}

function doGet(e) {
  try {
    const action = e.parameter.action || 'getAll';
    if (action === 'getAll') return getAllRecords();
    return jsonResponse({ status: 'error', message: '未知的 action' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'deposit') return addDeposit(data);
    if (data.action === 'delete') return deleteDeposit(data);
    return jsonResponse({ status: 'error', message: '未知的 action' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

function getAllRecords() {
  const sheet = getOrCreateSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return jsonResponse({ status: 'success', records: [] });
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const records = data.map(row => ({
    date: formatDateValue(row[0]),
    amount: Number(row[1]),
    pool: row[2] === '雙倍' ? 'double' : 'normal',
    note: row[3] || ''
  }));
  return jsonResponse({ status: 'success', records });
}

function addDeposit(data) {
  const sheet = getOrCreateSheet();
  const poolLabel = data.pool === 'double' ? '雙倍' : '正常';
  const date = data.date || new Date().toISOString().split('T')[0];
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const existing = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    for (let i = 0; i < existing.length; i++) {
      if (Number(existing[i][1]) === Number(data.amount) && existing[i][2] === poolLabel) {
        return jsonResponse({ status: 'error', message: '此金額已存在紀錄' });
      }
    }
  }
  sheet.appendRow([date, data.amount, poolLabel, '']);
  if (sheet.getLastRow() > 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).sort({ column: 1, ascending: true });
  }
  return jsonResponse({ status: 'success', message: '存款紀錄已新增' });
}

function deleteDeposit(data) {
  const sheet = getOrCreateSheet();
  const lastRow = sheet.getLastRow();
  const poolLabel = data.pool === 'double' ? '雙倍' : '正常';
  if (lastRow <= 1) return jsonResponse({ status: 'error', message: '無紀錄可刪除' });
  const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (Number(values[i][1]) === Number(data.amount) && values[i][2] === poolLabel) {
      sheet.deleteRow(i + 2);
      return jsonResponse({ status: 'success', message: '紀錄已刪除' });
    }
  }
  return jsonResponse({ status: 'error', message: '找不到對應的紀錄' });
}

function formatDateValue(val) {
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  return String(val);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}`;

  try {
    await navigator.clipboard.writeText(script);
    showToast('✅ 程式碼已複製到剪貼簿！', 'success');
  } catch (e) {
    // Fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = script;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✅ 程式碼已複製到剪貼簿！', 'success');
  }
}

// ===== Toast =====
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast ' + type + ' show';
  setTimeout(() => { toast.classList.remove('show'); }, 2500);
}

// ===== Google Sheets Sync =====
async function syncWithSheets() {
  if (!state.scriptUrl) {
    showToast('⚠️ 請先在設定中輸入 Apps Script URL', 'error');
    return;
  }

  const btn = document.getElementById('syncBtn');
  btn.classList.add('syncing');
  document.getElementById('syncText').textContent = '同步中...';

  try {
    // Fetch all data from sheet
    const res = await fetch(state.scriptUrl + '?action=getAll');
    const data = await res.json();

    if (data.status === 'success' && Array.isArray(data.records)) {
      // Merge: sheet data takes priority
      const sheetSet = new Set(data.records.map(r => `${r.amount}-${r.pool}`));
      const localSet = new Set(state.deposits.map(d => `${d.amount}-${d.pool}`));

      // Add local-only deposits to sheet
      const localOnly = state.deposits.filter(d => !sheetSet.has(`${d.amount}-${d.pool}`));
      for (const dep of localOnly) {
        await syncDeposit(dep);
      }

      // Add sheet-only deposits to local
      const sheetOnly = data.records.filter(r => !localSet.has(`${r.amount}-${r.pool}`));
      for (const rec of sheetOnly) {
        state.deposits.push({
          amount: rec.amount,
          pool: rec.pool,
          date: rec.date,
          timestamp: new Date(rec.date).getTime()
        });
      }

      saveToStorage();
      renderAll();
      showToast('✅ 同步完成！', 'success');
    } else {
      showToast('⚠️ 同步失敗：' + (data.message || '未知錯誤'), 'error');
    }
  } catch (err) {
    showToast('⚠️ 同步失敗：' + err.message, 'error');
  } finally {
    btn.classList.remove('syncing');
    document.getElementById('syncText').textContent = '同步';
  }
}

async function syncDeposit(deposit) {
  if (!state.scriptUrl) return;
  try {
    await fetch(state.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'deposit',
        amount: deposit.amount,
        pool: deposit.pool,
        date: deposit.date
      })
    });
  } catch (e) {
    console.warn('Sync deposit failed:', e);
  }
}

async function syncDelete(deposit) {
  if (!state.scriptUrl) return;
  try {
    await fetch(state.scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'delete',
        amount: deposit.amount,
        pool: deposit.pool
      })
    });
  } catch (e) {
    console.warn('Sync delete failed:', e);
  }
}
