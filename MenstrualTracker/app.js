// Configuration
const GAS_URL = 'https://script.google.com/macros/s/AKfycbw2AFfgF7IE6ink_-Bsaee-2kjIce2M1CfU-u6F6gmKcie7AyC4ZY84dwwsggH6kAx8bA/exec';

// State variables
let currentPeriodStart = null;
let records = [];
let userSettings = {
  cycleLength: 28,
  periodLength: 6
};
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// DOM Elements
const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('.nav-btn');
const loadingOverlay = document.getElementById('loading-overlay');

// Home View Elements
const btnStartPeriod = document.getElementById('btn-start-period');
const btnEndPeriod = document.getElementById('btn-end-period');
const cycleCircle = document.getElementById('cycle-circle');
const daysCountdown = document.getElementById('days-countdown');
const circleTitle = document.querySelector('.circle-title');
const predictionText = document.getElementById('prediction-text');
const recordsList = document.getElementById('records-list');

// Add Record Elements
const recordForm = document.getElementById('record-form');
const recordDate = document.getElementById('record-date');

// Settings Elements
const cycleLengthInput = document.getElementById('cycle-length');
const periodLengthInput = document.getElementById('period-length');
const btnSaveCycle = document.getElementById('btn-save-cycle');
const btnClearData = document.getElementById('btn-clear-data');

// Calendar Elements
const calendarMonthYear = document.getElementById('calendar-month-year');
const calendarDays = document.getElementById('calendar-days');
const btnPrevMonth = document.getElementById('prev-month');
const btnNextMonth = document.getElementById('next-month');

// Initialize
function init() {
  loadData();
  setupEventListeners();
  updateUI();
  
  // Set default date in form
  const today = new Date().toISOString().split('T')[0];
  recordDate.value = today;

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Service Worker Registered'))
      .catch(err => console.log('Service Worker Registration Failed', err));
  }
}

// Historical Data Initialization
const historicalDates = ['2013-08-13', '2013-09-17', '2013-10-31', '2013-11-30', '2014-01-18', '2014-02-15', '2014-04-10', '2014-05-21', '2014-06-26', '2014-07-26', '2014-10-12', '2014-11-19', '2015-01-26', '2015-02-24', '2015-04-24', '2015-06-04', '2015-07-08', '2015-07-28', '2015-09-08', '2015-11-26', '2016-01-15', '2016-04-02', '2016-04-28', '2016-06-01', '2016-07-01', '2016-08-13', '2016-09-14', '2016-10-15', '2016-11-25', '2016-12-23', '2017-01-22', '2017-03-02', '2017-04-28', '2017-05-27', '2017-07-14', '2017-09-18', '2017-10-17', '2017-12-19', '2018-01-23', '2018-02-24', '2018-03-30', '2018-05-25', '2018-07-26', '2018-08-28', '2018-09-27', '2018-11-02', '2018-12-07', '2019-03-18', '2019-05-30', '2019-07-04', '2019-08-18', '2019-10-28', '2019-12-07', '2020-01-29', '2020-03-07', '2020-04-26', '2020-07-15', '2020-10-31', '2020-12-04', '2021-01-05', '2021-02-04', '2021-03-20', '2021-05-22', '2021-09-10', '2021-12-03', '2022-01-07', '2022-02-18', '2022-03-20', '2022-07-04', '2022-08-24', '2023-02-04', '2023-03-16', '2023-04-19', '2023-06-06', '2023-07-24', '2023-09-28', '2023-11-23', '2023-12-18', '2024-01-24', '2024-02-26', '2024-04-23', '2024-05-28', '2024-07-03', '2024-08-07', '2024-09-14', '2024-10-26', '2025-02-04', '2025-02-28', '2025-04-15', '2025-05-10', '2025-06-20', '2025-07-26', '2025-08-30', '2025-10-03', '2025-11-01', '2025-12-05', '2026-02-10', '2026-04-05'];

// Data Management
function loadData() {
  const savedRecords = localStorage.getItem('menstrualRecords');
  let loadedRecords = savedRecords ? JSON.parse(savedRecords) : [];
  
  // Merge historical data automatically
  const existingDates = new Set(loadedRecords.map(r => r.date));
  historicalDates.forEach(date => {
    if (!existingDates.has(date)) {
      loadedRecords.push({ date, type: 'start', flow: '中', pain: '無', notes: '匯入歷史資料' });
    }
  });
  loadedRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
  records = loadedRecords;

  const savedSettings = localStorage.getItem('menstrualSettings');
  if (savedSettings) {
    userSettings = { ...userSettings, ...JSON.parse(savedSettings) };
  }
  
  const savedCurrentStart = localStorage.getItem('currentPeriodStart');
  if (savedCurrentStart) {
    currentPeriodStart = savedCurrentStart;
  }

  // Calculate real average cycle from history
  calculateAverageCycle();

  // Populate settings form
  cycleLengthInput.value = userSettings.cycleLength;
  periodLengthInput.value = userSettings.periodLength;
}

function calculateAverageCycle() {
  const starts = records.filter(r => r.type === 'start').sort((a, b) => new Date(a.date) - new Date(b.date));
  if (starts.length < 2) return;
  
  let totalDays = 0;
  let count = 0;
  
  for (let i = 1; i < starts.length; i++) {
    const prev = new Date(starts[i-1].date);
    const curr = new Date(starts[i].date);
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    
    // Filter out skipped months or anomalies (only count 20-45 day cycles)
    if (diffDays >= 20 && diffDays <= 45) {
      totalDays += diffDays;
      count++;
    }
  }
  
  if (count > 0) {
    const avg = Math.round(totalDays / count);
    userSettings.cycleLength = avg;
  }
}

function saveData() {
  localStorage.setItem('menstrualRecords', JSON.stringify(records));
  localStorage.setItem('menstrualSettings', JSON.stringify(userSettings));
  if (currentPeriodStart) {
    localStorage.setItem('currentPeriodStart', currentPeriodStart);
  } else {
    localStorage.removeItem('currentPeriodStart');
  }
}

// Event Listeners
function setupEventListeners() {
  // Navigation
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      
      // Update active classes
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      views.forEach(v => {
        if (v.id === targetId) {
          v.classList.add('active');
        } else {
          v.classList.remove('active');
        }
      });
    });
  });

  // Home Actions
  btnStartPeriod.addEventListener('click', () => {
    if (confirm('確定要記錄今天為經期第一天嗎？')) {
      const today = new Date().toISOString().split('T')[0];
      currentPeriodStart = today;
      
      // Also add a basic record
      addRecord({
        date: today,
        type: 'start',
        flow: '中',
        pain: '無',
        notes: '經期開始'
      });
      
      saveData();
      updateUI();
    }
  });

  btnEndPeriod.addEventListener('click', () => {
    if (confirm('確定要記錄今天為經期結束嗎？')) {
      const today = new Date().toISOString().split('T')[0];
      
      addRecord({
        date: today,
        type: 'end',
        flow: '少',
        pain: '無',
        notes: '經期結束'
      });
      
      currentPeriodStart = null;
      saveData();
      updateUI();
    }
  });

  // Form Submit
  recordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const date = recordDate.value;
    const flow = document.querySelector('input[name="flow"]:checked').value;
    const pain = document.querySelector('input[name="pain"]:checked').value;
    const notes = document.getElementById('record-notes').value;

    const record = {
      date,
      type: 'log',
      flow,
      pain,
      notes
    };

    addRecord(record);
    saveData();
    updateUI();
    
    // Attempt sync
    await syncToCloud(record);
    
    alert('紀錄已儲存！');
    recordForm.reset();
    recordDate.value = new Date().toISOString().split('T')[0];
    
    // Navigate back to home
    document.querySelector('.nav-btn[data-target="view-home"]').click();
  });

  // Settings
  btnSaveCycle.addEventListener('click', () => {
    userSettings.cycleLength = parseInt(cycleLengthInput.value, 10) || 28;
    userSettings.periodLength = parseInt(periodLengthInput.value, 10) || 5;
    saveData();
    updateUI();
    alert('週期設定已儲存！');
  });

  btnClearData.addEventListener('click', () => {
    if (confirm('警告：確定要清除本機所有資料嗎？這不會刪除雲端上的資料。')) {
      localStorage.removeItem('menstrualRecords');
      localStorage.removeItem('menstrualSettings');
      localStorage.removeItem('currentPeriodStart');
      location.reload();
    }
  });

  // Calendar
  btnPrevMonth.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
  });
  btnNextMonth.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar();
  });
}

// Logic & UI Updates
function addRecord(record) {
  // Check if record for date already exists, if so update it, otherwise add
  const existingIdx = records.findIndex(r => r.date === record.date && r.type === record.type);
  if (existingIdx >= 0) {
    records[existingIdx] = record;
  } else {
    records.push(record);
  }
  
  // Sort by date descending
  records.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function updateUI() {
  updateHomeCard();
  updateRecordsList();
  renderCalendar();
}

function updateHomeCard() {
  if (currentPeriodStart) {
    // Currently menstruating
    btnStartPeriod.classList.add('hidden');
    btnEndPeriod.classList.remove('hidden');
    
    cycleCircle.style.borderColor = 'var(--primary)';
    circleTitle.textContent = '經期第';
    
    const start = new Date(currentPeriodStart);
    const today = new Date();
    const diffTime = Math.abs(today - start);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    daysCountdown.textContent = diffDays;
    predictionText.textContent = `請多喝溫水，注意保暖喔 ❤️`;
    
  } else {
    // Waiting for next period
    btnStartPeriod.classList.remove('hidden');
    btnEndPeriod.classList.add('hidden');
    
    cycleCircle.style.borderColor = 'var(--primary-light)';
    circleTitle.textContent = '距離下次經期';
    
    // Calculate prediction
    const startRecords = records.filter(r => r.type === 'start');
    if (startRecords.length > 0) {
      const lastStart = new Date(startRecords[0].date);
      const nextDate = new Date(lastStart);
      nextDate.setDate(lastStart.getDate() + userSettings.cycleLength);
      
      const today = new Date();
      // Reset times to compare just dates
      today.setHours(0,0,0,0);
      nextDate.setHours(0,0,0,0);
      
      const diffTime = nextDate - today;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        daysCountdown.textContent = '延遲';
        circleTitle.textContent = `已延遲 ${Math.abs(diffDays)} 天`;
        daysCountdown.style.fontSize = '2rem';
      } else {
        daysCountdown.textContent = diffDays;
        daysCountdown.style.fontSize = '3rem';
      }
      
      const yyyy = nextDate.getFullYear();
      const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dd = String(nextDate.getDate()).padStart(2, '0');
      predictionText.textContent = `預測下次開始：${yyyy}/${mm}/${dd}`;
    } else {
      daysCountdown.textContent = '--';
      predictionText.textContent = '尚無足夠紀錄進行預測';
    }
  }
}

function updateRecordsList() {
  recordsList.innerHTML = '';
  
  if (records.length === 0) {
    recordsList.innerHTML = '<div class="empty-state">目前還沒有紀錄喔！</div>';
    return;
  }
  
  // Show only last 10 records on home
  const displayRecords = records.slice(0, 10);
  
  displayRecords.forEach(record => {
    const div = document.createElement('div');
    div.className = 'record-item';
    
    let typeLabel = '';
    let typeColor = '';
    
    if (record.type === 'start') {
      typeLabel = '經期開始';
      typeColor = 'var(--primary-dark)';
    } else if (record.type === 'end') {
      typeLabel = '經期結束';
      typeColor = 'var(--success)';
    } else {
      typeLabel = '日常紀錄';
      typeColor = 'var(--text-muted)';
    }
    
    div.innerHTML = `
      <div>
        <div class="record-date">${record.date}</div>
        <div class="record-details">血量: ${record.flow || '-'} | 痛經: ${record.pain || '-'}</div>
      </div>
      <div class="record-type" style="color: ${typeColor}; border-color: ${typeColor}; background: transparent; border: 1px solid ${typeColor}">${typeLabel}</div>
    `;
    
    recordsList.appendChild(div);
  });
}

function renderCalendar() {
  calendarDays.innerHTML = '';
  calendarMonthYear.textContent = `${currentYear}年 ${currentMonth + 1}月`;
  
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  const today = new Date();
  
  // 找出經期紀錄的日期
  const periodDates = new Set();
  const predictedDates = new Set();
  
  // 1. 整理過去已發生的經期
  records.forEach(r => {
    if (r.type === 'start' || r.type === 'log') {
      periodDates.add(r.date);
    }
  });

  // 2. 如果有設定 currentPeriodStart，把這幾天也塗色
  if (currentPeriodStart) {
    const start = new Date(currentPeriodStart);
    for(let i=0; i<userSettings.periodLength; i++) {
      let d = new Date(start);
      d.setDate(start.getDate() + i);
      const ds = d.toISOString().split('T')[0];
      periodDates.add(ds);
    }
  }

  // 3. 預測下一次經期 (如果有足夠紀錄)
  const startRecords = records.filter(r => r.type === 'start');
  if (startRecords.length > 0) {
    const lastStart = new Date(startRecords[0].date);
    const nextStart = new Date(lastStart);
    nextStart.setDate(lastStart.getDate() + userSettings.cycleLength);
    
    for(let i=0; i<userSettings.periodLength; i++) {
      let d = new Date(nextStart);
      d.setDate(nextStart.getDate() + i);
      const ds = d.toISOString().split('T')[0];
      predictedDates.add(ds);
    }
  }
  
  // 空白格子 (上個月的尾巴)
  for (let i = 0; i < firstDay; i++) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'calendar-day empty';
    calendarDays.appendChild(emptyDiv);
  }
  
    // 每一天的格子
  for (let i = 1; i <= daysInMonth; i++) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    dayDiv.textContent = i;
    
    // 判斷日期字串格式 YYYY-MM-DD
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    
    // 是否為今天
    if (i === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
      dayDiv.classList.add('today');
    }
    
    // 是否為經期
    if (periodDates.has(dateStr)) {
      dayDiv.classList.add('period');
    } 
    // 是否為預測期
    else if (predictedDates.has(dateStr)) {
      dayDiv.classList.add('predicted');
    }

    // 點選記錄月經第一天（自動記錄 periodLength 天）
    dayDiv.addEventListener('click', () => {
      const label = `${currentYear}/${currentMonth + 1}/${i}`;
      if (confirm(`將 ${label} 設為月經第一天？\n（系統將自動標記後續 ${userSettings.periodLength - 1} 天為經期，共 ${userSettings.periodLength} 天）`)) {
        // 記錄第一天為 start
        addRecord({
          date: dateStr,
          type: 'start',
          flow: '中',
          pain: '無',
          notes: '由月曆點選記錄'
        });
        currentPeriodStart = dateStr;

        // 自動記錄後續天數（第 2 天起到第 periodLength 天）
        for (let d = 1; d < userSettings.periodLength; d++) {
          const nextDate = new Date(dateStr);
          nextDate.setDate(nextDate.getDate() + d);
          const nextStr = nextDate.toISOString().split('T')[0];
          addRecord({
            date: nextStr,
            type: 'log',
            flow: '中',
            pain: '無',
            notes: `經期第 ${d + 1} 天（自動）`
          });
        }

        saveData();
        updateUI();
        syncToCloud({ date: dateStr, type: 'start', flow: '中', pain: '無', notes: '由月曆點選記錄' });
        alert(`✅ 已記錄 ${label} 起共 ${userSettings.periodLength} 天經期！`);
      }
    });
    
    calendarDays.appendChild(dayDiv);
  }
}

// Cloud Sync
async function syncToCloud(record) {
  if (!GAS_URL) return;
  
  showLoading(true);
  try {
    const payload = {
      date: record.date,
      type: record.type,
      flow: record.flow,
      pain: record.pain,
      notes: record.notes,
      timestamp: new Date().toISOString()
    };
    
    const response = await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors', // Because GAS doesn't return proper CORS headers for JSON usually
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    console.log('Sync dispatched');
  } catch (error) {
    console.error('Sync failed:', error);
    alert('雲端同步失敗，但已儲存於本機。請檢查網路或網址設定。');
  } finally {
    showLoading(false);
  }
}

function showLoading(show) {
  if (show) {
    loadingOverlay.classList.remove('hidden');
  } else {
    loadingOverlay.classList.add('hidden');
  }
}

// Boot up
window.addEventListener('DOMContentLoaded', init);
