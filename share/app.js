const savedTheme = localStorage.getItem('share_theme') || 'dark';
if (savedTheme === 'light') {
  document.documentElement.setAttribute('data-theme', 'light');
}

// ===== State =====
const state = {
  deposits: [],        // [{ amount, pool, date, timestamp }]
  earnedBadges: [],
  startDate: '',
  scriptUrl: '',
  sheetUrl: '',
  mode: 'classic',     // Default to classic for public
  customAmount: 100,   // Default custom amount
  currentTab: 'home',
  pendingAmount: null,
  pendingPool: null,
};

// ===== Configuration =====
const MODES = {
  'classic': {
    name: '正常 365 (1~365)',
    generate: (state) => Array.from({length: 365}, (_, i) => ({ amount: i + 1, pool: 'normal' })),
    total: (state) => 66795
  },
  'double_365': {
    name: '雙倍 365 (全部x2)',
    generate: (state) => Array.from({length: 365}, (_, i) => ({ amount: (i + 1) * 2, pool: 'double' })),
    total: (state) => 133590
  },
  'half_double': {
    name: '混合加壓版 (1~180雙倍)',
    generate: (state) => {
      const d = Array.from({length: 180}, (_, i) => ({ amount: (i + 1) * 2, pool: 'double' }));
      const n = Array.from({length: 185}, (_, i) => ({ amount: i + 181, pool: 'normal' }));
      return [...d, ...n];
    },
    total: (state) => 83085
  },
  'custom_fixed': {
    name: '定期定額 (自訂金額)',
    generate: (state) => Array.from({length: 365}, () => ({ amount: state.customAmount, pool: 'normal' })),
    total: (state) => 365 * state.customAmount
  }
};

const BADGES = [
  { id: 'first_blood', name: '首存達成', icon: '🌱', check: (total, count) => count >= 1 },
  { id: '10k', name: '破萬富翁', icon: '💸', check: (total, count) => total >= 10000 },
  { id: '50_days', name: '存滿50天', icon: '🔥', check: (total, count) => count >= 50 },
  { id: '50k', name: '五萬里程', icon: '💎', check: (total, count) => total >= 50000 },
  { id: '100_days', name: '百日戰士', icon: '👑', check: (total, count) => count >= 100 },
  { id: 'all_clear', name: '365制霸', icon: '🚀', check: (total, count) => count >= 365 }
];

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  renderAll();
});

// ===== Storage =====
function loadFromStorage() {
  try {
    state.deposits = JSON.parse(localStorage.getItem('share_deposits') || '[]');
    state.startDate = localStorage.getItem('share_startDate') || '';
    state.sheetUrl = localStorage.getItem('share_sheetUrl') || '';
    state.earnedBadges = JSON.parse(localStorage.getItem('share_earnedBadges') || '[]');
    state.mode = localStorage.getItem('share_mode') || 'classic';
    state.customAmount = parseInt(localStorage.getItem('share_customAmount')) || 100;
    state.scriptUrl = localStorage.getItem('share_scriptUrl') || '';
  } catch (e) {
    state.deposits = [];
    state.earnedBadges = [];
  }
  // Populate settings inputs
  const dateInput = document.getElementById('startDateInput');
  const sheetInput = document.getElementById('sheetUrlInput');
  const modeInput = document.getElementById('modeSelect');
  const customAmountInput = document.getElementById('customAmountInput');
  const scriptInput = document.getElementById('backendUrlInput');
  
  if (dateInput) dateInput.value = state.startDate;
  if (sheetInput) sheetInput.value = state.sheetUrl;
  if (modeInput) modeInput.value = state.mode;
  if (customAmountInput) customAmountInput.value = state.customAmount;
  if (scriptInput) scriptInput.value = state.scriptUrl;
  
  toggleCustomAmountInput();
}

function saveToStorage() {
  localStorage.setItem('share_deposits', JSON.stringify(state.deposits));
  localStorage.setItem('share_startDate', state.startDate);
  localStorage.setItem('share_sheetUrl', state.sheetUrl);
  localStorage.setItem('share_scriptUrl', state.scriptUrl);
  localStorage.setItem('share_mode', state.mode);
  localStorage.setItem('share_customAmount', state.customAmount);
  localStorage.setItem('share_earnedBadges', JSON.stringify(state.earnedBadges));
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
}

// ===== Home Tab =====
function renderHome() {
  const completed = state.deposits.length;
  const totalSaved = getTotalSaved();
  const currentDay = getCurrentDay();
  const targetAmount = MODES[state.mode].total;

  // Progress ring
  const circumference = 2 * Math.PI * 68; // ~427.26
  const progress = completed / 365;
  const offset = circumference * (1 - progress);
  document.getElementById('progressRing').style.strokeDashoffset = offset;
  document.getElementById('completedCount').textContent = completed;

  // Stats
  document.getElementById('totalSaved').textContent = formatNumber(totalSaved);
  document.getElementById('targetAmount').textContent = formatNumber(targetAmount);
  document.getElementById('remainingAmount').textContent = formatNumber(targetAmount - totalSaved);
  document.getElementById('remainingDays').textContent = 365 - completed;

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

  checkBadges();
  renderBadges();

  // History list in Home
  const list = document.getElementById('historyList');
  if (completed === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="icon">📋</div><div>尚無存款紀錄</div>
    </div>`;
    return;
  }
  const sorted = [...state.deposits].sort((a, b) => b.timestamp - a.timestamp);
  let html = '';
  sorted.forEach((d) => {
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

// ===== Deposit Grid =====
function renderGrid() {
  const ALL_AMOUNTS = MODES[state.mode].generate().sort((a, b) => a.amount - b.amount);

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
  playSound('coin');
  showToast(`✅ 已存入 ${formatNumber(amount)} 元！`, 'success');

  // Sync to Google Sheets
  if (state.scriptUrl) {
    syncDeposit(deposit);
  }
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
}

// ===== Settings =====
function saveSettings() {
  state.startDate = document.getElementById('startDateInput').value;
  state.sheetUrl = document.getElementById('sheetUrlInput').value.trim();
  state.scriptUrl = document.getElementById('backendUrlInput').value.trim();

  const newMode = document.getElementById('modeSelect').value;
  if (newMode !== state.mode) {
    if (state.deposits.length > 0 && !confirm(`確定要將模式改為「${MODES[newMode].name}」嗎？\n⚠️ 注意：這將會清空你目前所有的存款紀錄！`)) {
      document.getElementById('modeSelect').value = state.mode; // Revert select visually
      return; // Abort save
    }
    state.mode = newMode;
    state.deposits = [];
    state.earnedBadges = [];
  }

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

// ===== Badges & Confetti =====
function checkBadges() {
  const total = getTotalSaved();
  const count = state.deposits.length;
  let newEarned = false;

  BADGES.forEach(b => {
    if (b.check(total, count) && !state.earnedBadges.includes(b.id)) {
      state.earnedBadges.push(b.id);
      newEarned = true;
      setTimeout(() => {
        fireConfetti();
        playSound('badge');
      }, 500);
      showToast(`🏆 恭喜解鎖成就：${b.name}`, 'success');
    }
  });

  if (newEarned) {
    localStorage.setItem('earnedBadges', JSON.stringify(state.earnedBadges));
  }
}

function renderBadges() {
  const container = document.getElementById('badgesGrid');
  if (!container) return;
  const total = getTotalSaved();
  const count = state.deposits.length;

  let html = '';
  BADGES.forEach(b => {
    const isEarned = b.check(total, count);
    html += `
      <div class="badge-item ${isEarned ? 'earned' : ''}">
        <div class="badge-icon">${b.icon}</div>
        <div class="badge-name">${b.name}</div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function fireConfetti() {
  if (typeof confetti !== 'function') return;
  const duration = 3000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 5, angle: 60, spread: 55, origin: { x: 0 },
      colors: ['#7c6aff', '#4fc3f7', '#f6a623']
    });
    confetti({
      particleCount: 5, angle: 120, spread: 55, origin: { x: 1 },
      colors: ['#7c6aff', '#4fc3f7', '#f6a623']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
}

// ===== Theme Toggle =====
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = next === 'light' ? '🌙' : '🌞';
}

// ===== Audio =====
let audioCtx;
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playTone(freq, type, duration) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playSound(type) {
  try {
    initAudio();
    if (type === 'coin') {
      playTone(1200, 'sine', 0.1);
      setTimeout(() => playTone(1600, 'sine', 0.2), 100);
    } else if (type === 'badge') {
      playTone(523.25, 'sine', 0.1); // C5
      setTimeout(() => playTone(659.25, 'sine', 0.1), 100); // E5
      setTimeout(() => playTone(783.99, 'sine', 0.3), 200); // G5
    }
  } catch (e) { console.warn("Audio not supported", e); }
}

// ===== Random Picker =====
function pickRandomAmount() {
  const grid = document.getElementById('amountGrid');
  const cells = grid.querySelectorAll('.amount-cell');
  
  if (cells.length === 0) {
    showToast('🎉 所有金額都存完了！', 'success');
    return;
  }

  let spins = 0;
  const maxSpins = 15;
  const interval = 80;
  initAudio();
  
  const timer = setInterval(() => {
    cells.forEach(c => c.classList.remove('highlight-random'));
    const randomCell = cells[Math.floor(Math.random() * cells.length)];
    randomCell.classList.add('highlight-random');
    playTone(800, 'sine', 0.05);
    
    spins++;
    if (spins >= maxSpins) {
      clearInterval(timer);
      cells.forEach(c => c.classList.remove('highlight-random'));
      
      const finalCell = cells[Math.floor(Math.random() * cells.length)];
      finalCell.classList.add('highlight-random');
      setTimeout(() => finalCell.classList.remove('highlight-random'), 1500);
      
      playTone(1200, 'triangle', 0.15);
      
      const amount = parseInt(finalCell.textContent);
      const pool = finalCell.classList.contains('double-cell') ? 'double' : 'normal';
      
      setTimeout(() => selectAmount(amount, pool), 400);
    }
  }, interval);
}
