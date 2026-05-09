// ===== State =====
const state = {
  deposits: [],        // [{ amount, pool, date, timestamp }]
  startDate: '',
  scriptUrl: 'https://script.google.com/macros/s/AKfycbxQ06U4KRDbEgf-xTszktB-mrJRpv6dAlBaQYZDJIb9xo6u2bkAuMEiG4Rf5UTcKJys/exec',
  sheetUrl: '',
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
    
    // 自動匯入舊截圖紀錄 (一次性)
    if (!localStorage.getItem('legacy_imported_v2')) {
      const legacyDouble = [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,104,106,108,110,112,114,116,118,120,122,124,126,128,130,132,134,136,138,140,142,144,146,148,150,152,154,156,158,160,162, 184, 200, 218, 222, 250, 258, 270, 300, 302, 304, 306, 310, 314, 320, 330, 360];
      const legacyNormal = [237, 303, 305, 320, 355, 361, 362, 363, 364, 365];
      const now = Date.now();
      const todayDate = new Date().toISOString().split('T')[0];
      let imported = false;
      
      legacyDouble.forEach(amt => {
        if (!state.deposits.find(d => d.amount === amt && d.pool === 'double')) {
          state.deposits.push({ amount: amt, pool: 'double', date: todayDate, timestamp: now });
          imported = true;
        }
      });
      legacyNormal.forEach(amt => {
        if (!state.deposits.find(d => d.amount === amt && d.pool === 'normal')) {
          state.deposits.push({ amount: amt, pool: 'normal', date: todayDate, timestamp: now });
          imported = true;
        }
      });
      
      if (imported) localStorage.setItem('deposits', JSON.stringify(state.deposits));
      localStorage.setItem('legacy_imported_v2', 'true');
    }

    state.startDate = localStorage.getItem('startDate') || '';
    state.sheetUrl = localStorage.getItem('sheetUrl') || '';
  } catch (e) {
    state.deposits = [];
  }
  // Populate settings inputs
  const dateInput = document.getElementById('startDateInput');
  const sheetInput = document.getElementById('sheetUrlInput');
  if (dateInput) dateInput.value = state.startDate;
  if (sheetInput) sheetInput.value = state.sheetUrl;
}

function saveToStorage() {
  localStorage.setItem('deposits', JSON.stringify(state.deposits));
  localStorage.setItem('startDate', state.startDate);
  localStorage.setItem('sheetUrl', state.sheetUrl);
}

// ===== Helpers =====

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
}

// ===== Deposit Grid =====
function renderGrid() {
  const ALL_AMOUNTS = [
    ...DOUBLE_POOL.map(a => ({ amount: a, pool: 'double' })),
    ...NORMAL_POOL.map(a => ({ amount: a, pool: 'normal' }))
  ].sort((a, b) => a.amount - b.amount);

  let available = [...ALL_AMOUNTS];
  for (const d of state.deposits) {
    const idx = available.findIndex(a => a.amount === d.amount && a.pool === d.pool);
    if (idx !== -1) available.splice(idx, 1);
  }

  const grid = document.getElementById('amountGrid');

  // Pool info
  document.getElementById('poolProgress').textContent =
    `剩餘 ${available.length} 個金額`;
  const remainingTotal = available.reduce((sum, item) => sum + item.amount, 0);
  document.getElementById('poolSubtotal').textContent =
    `未存總額：${formatNumber(remainingTotal)} 元`;

  // Build grid
  let html = '';
  available.forEach(item => {
    html += `<div class="amount-cell ${item.pool}-cell"
      onclick="selectAmount(${item.amount},'${item.pool}')">
      ${item.amount}
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
  state.sheetUrl = document.getElementById('sheetUrlInput').value.trim();
  saveToStorage();
  renderAll();
  showToast('✅ 設定已儲存', 'success');
}

function openSheet() {
  const url = document.getElementById('sheetUrlInput').value.trim() || state.sheetUrl;
  if (url) {
    window.open(url, '_blank');
  } else {
    showToast('⚠️ 請先輸入試算表連結', 'error');
  }
}

function confirmReset() {
  if (!confirm('確定要重置所有資料嗎？此操作無法復原！')) return;
  if (!confirm('再次確認：所有存款紀錄將被刪除！')) return;
  state.deposits = [];
  saveToStorage();
  renderAll();
  showToast('資料已重置', 'error');
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
