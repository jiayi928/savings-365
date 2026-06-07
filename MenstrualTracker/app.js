// Configuration
const GAS_URL = 'https://script.google.com/macros/s/AKfycbw2AFfgF7IE6ink_-Bsaee-2kjIce2M1CfU-u6F6gmKcie7AyC4ZY84dwwsggH6kAx8bA/exec';

// State variables
let currentPeriodStart = null;
let records = [];
let userSettings = {
  cycleLength: 28,
  periodLength: 6,
  enableNotifications: false
};
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// DOM Elements
const views = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('.nav-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const chkNotification = document.getElementById('chk-notification');

// Home View Elements
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
const btnSyncData = document.getElementById('btn-sync-data');
const btnClearData = document.getElementById('btn-clear-data');

// Calendar Elements
const calendarMonthYear = document.getElementById('calendar-month-year');
const calendarDays = document.getElementById('calendar-days');
const btnPrevMonth = document.getElementById('prev-month');
const btnNextMonth = document.getElementById('next-month');

// Modal Elements
const calendarModal = document.getElementById('calendar-modal');
const modalDateLabel = document.getElementById('modal-date-label');
const modalBtnStart = document.getElementById('modal-btn-start');
const modalBtnEnd = document.getElementById('modal-btn-end');
const modalBtnCancel = document.getElementById('modal-btn-cancel');

let selectedDateStr = null;
let selectedLabel = null;

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

  // 第一次開啟或每次開啟時，自動與雲端試算表連結並同步資料
  syncFromCloud();

  // 偵測並提醒生理期來潮
  checkAndNotify();
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
  chkNotification.checked = userSettings.enableNotifications || false;
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
  // Modal 按鈕事件
  if (modalBtnStart) {
    modalBtnStart.addEventListener('click', async () => {
      if (!selectedDateStr) return;
      
      const d = new Date(selectedDateStr);
      d.setDate(d.getDate() + 5);
      const endStr = d.toISOString().split('T')[0];
      
      const startRec = {
        date: selectedDateStr,
        type: 'start',
        flow: '中',
        pain: '無',
        notes: '月曆點選開始'
      };
      const endRec = {
        date: endStr,
        type: 'end',
        flow: '少',
        pain: '無',
        notes: '經期結束（自動設定）'
      };
      
      addRecord(startRec);
      addRecord(endRec);
      currentPeriodStart = selectedDateStr;
      
      saveData();
      updateUI();
      closeModal();
      
      await syncToCloud(startRec);
      await syncToCloud(endRec);
      alert(`✅ 已將 ${selectedLabel} 設為開始，並自動記錄 6 天！`);
    });
  }

  if (modalBtnEnd) {
    modalBtnEnd.addEventListener('click', async () => {
      if (!selectedDateStr) return;
      
      const endRec = {
        date: selectedDateStr,
        type: 'end',
        flow: '少',
        pain: '無',
        notes: '月曆點選結束'
      };
      
      addRecord(endRec);
      currentPeriodStart = null;
      
      saveData();
      updateUI();
      closeModal();
      
      await syncToCloud(endRec);
      alert(`✅ 已將 ${selectedLabel} 設為經期結束！`);
    });
  }

  if (modalBtnCancel) {
    modalBtnCancel.addEventListener('click', closeModal);
  }

  if (calendarModal) {
    calendarModal.addEventListener('click', (e) => {
      if (e.target === calendarModal) closeModal();
    });
  }

  function closeModal() {
    if (calendarModal) {
      calendarModal.classList.add('hidden');
    }
    selectedDateStr = null;
    selectedLabel = null;
  }

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

  chkNotification.addEventListener('change', async () => {
    if (chkNotification.checked) {
      if (!('Notification' in window)) {
        alert('此瀏覽器不支援通知功能。');
        chkNotification.checked = false;
        return;
      }
      
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        userSettings.enableNotifications = true;
        saveData();
        alert('🔔 生理期提醒功能已開啟！');
        // 開啟時立即測試一封通知
        new Notification("女孩日記提醒 🌸", {
          body: "提醒功能已成功啟用！我們會在預測生理期前一天或當天提醒您喔 ❤️",
          icon: 'icon-512.png'
        });
      } else {
        chkNotification.checked = false;
        userSettings.enableNotifications = false;
        saveData();
        alert('⚠️ 需要通知權限才能啟用此功能。請手動在瀏覽器設定中允許通知！');
      }
    } else {
      userSettings.enableNotifications = false;
      saveData();
      alert('🔕 生理期提醒功能已關閉。');
    }
  });

  if (btnSyncData) {
    btnSyncData.addEventListener('click', async () => {
      showLoading(true);
      try {
        await syncFromCloud();
        alert('同步完成！即將重新載入網頁以套用最新更新。');
        // 要求 Service Worker 更新快取，並重整頁面
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (let reg of registrations) {
            await reg.update();
          }
        }
        window.location.reload(true);
      } catch (err) {
        showLoading(false);
        alert('更新失敗，請檢查網路連線。');
      }
    });
  }

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

// 計算並抓取成對的經期區間
function getPeriods() {
  const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
  const periods = [];
  let currentPeriod = null;
  
  sorted.forEach(r => {
    if (r.type === 'start') {
      if (currentPeriod) {
        // 前一次經期尚未關閉，自動計算一個結束日 (start + 5 days)
        const autoEnd = new Date(currentPeriod.start);
        autoEnd.setDate(autoEnd.getDate() + 5);
        currentPeriod.end = autoEnd.toISOString().split('T')[0];
        periods.push(currentPeriod);
      }
      currentPeriod = {
        start: r.date,
        end: null,
        startRecord: r,
        endRecord: null
      };
    } else if (r.type === 'end') {
      if (currentPeriod) {
        currentPeriod.end = r.date;
        currentPeriod.endRecord = r;
        periods.push(currentPeriod);
        currentPeriod = null;
      } else {
        // 孤立的結束紀錄，往前自動推算 5 天作為開始日
        const autoStart = new Date(r.date);
        autoStart.setDate(autoStart.getDate() - 5);
        periods.push({
          start: autoStart.toISOString().split('T')[0],
          end: r.date,
          startRecord: null,
          endRecord: r
        });
      }
    }
  });
  
  if (currentPeriod) {
    // 仍在進行中的經期，如果是最近的就保留 null，否則自動給定一個結束日
    const start = new Date(currentPeriod.start);
    const today = new Date();
    const diffDays = Math.round((today - start) / (1000 * 60 * 60 * 24));
    if (diffDays > 10) {
      const autoEnd = new Date(currentPeriod.start);
      autoEnd.setDate(autoEnd.getDate() + 5);
      currentPeriod.end = autoEnd.toISOString().split('T')[0];
    }
    periods.push(currentPeriod);
  }
  
  // 依日期從新到舊排序
  return periods.sort((a, b) => new Date(b.start) - new Date(a.start));
}

function updateRecordsList() {
  recordsList.innerHTML = '';
  
  const periods = getPeriods();
  
  if (periods.length === 0) {
    recordsList.innerHTML = '<div class="empty-state">目前還沒有紀錄喔！</div>';
    return;
  }
  
  // 顯示最近的 10 次經期
  const displayPeriods = periods.slice(0, 10);
  
  displayPeriods.forEach((period, idx) => {
    const div = document.createElement('div');
    div.className = 'record-item';
    
    let daysText = '';
    if (period.end) {
      const diff = Math.round((new Date(period.end) - new Date(period.start)) / (1000 * 60 * 60 * 24)) + 1;
      daysText = `共 ${diff} 天`;
    } else {
      daysText = '進行中';
    }
    
    div.innerHTML = `
      <div class="record-info">
        <div class="record-date">🌸 ${period.start} ~ ${period.end || '進行中'}</div>
        <div class="record-details">${daysText}</div>
      </div>
      <div class="record-actions">
        <button class="btn-action edit-btn" onclick="editPeriod(${idx})"><i class="fa-solid fa-pen"></i> 修改</button>
        <button class="btn-action delete-btn" onclick="deletePeriod(${idx})"><i class="fa-solid fa-trash"></i> 刪除</button>
      </div>
    `;
    
    recordsList.appendChild(div);
  });
}

// 修改經期紀錄
window.editPeriod = async function(idx) {
  const periods = getPeriods();
  const period = periods[idx];
  if (!period) return;
  
  const newStart = prompt("請輸入開始日期 (YYYY-MM-DD):", period.start);
  if (!newStart) return;
  
  const newEnd = prompt("請輸入結束日期 (YYYY-MM-DD):", period.end || "");
  if (newEnd === null) return; // 按取消
  
  showLoading(true);
  try {
    // 1. 刪除雲端和本機的舊紀錄
    if (period.startRecord) {
      records = records.filter(r => !(r.date === period.startRecord.date && r.type === 'start'));
      await syncToCloud({ date: period.startRecord.date, type: 'start', action: 'delete' });
    }
    if (period.endRecord) {
      records = records.filter(r => !(r.date === period.endRecord.date && r.type === 'end'));
      await syncToCloud({ date: period.endRecord.date, type: 'end', action: 'delete' });
    }
    
    // 2. 建立新紀錄
    const startRec = { date: newStart, type: 'start', flow: '中', pain: '無', notes: '修改經期' };
    addRecord(startRec);
    await syncToCloud(startRec);
    
    if (newEnd) {
      const endRec = { date: newEnd, type: 'end', flow: '少', pain: '無', notes: '修改經期' };
      addRecord(endRec);
      await syncToCloud(endRec);
    }
    
    saveData();
    updateUI();
    alert("修改成功！");
  } catch (err) {
    alert("修改失敗: " + err);
  } finally {
    showLoading(false);
  }
};

// 刪除經期紀錄
window.deletePeriod = async function(idx) {
  const periods = getPeriods();
  const period = periods[idx];
  if (!period) return;
  
  if (confirm(`確定要刪除這筆經期紀錄嗎？\n區間: ${period.start} ~ ${period.end || '進行中'}`)) {
    showLoading(true);
    try {
      if (period.startRecord) {
        records = records.filter(r => !(r.date === period.startRecord.date && r.type === 'start'));
        await syncToCloud({ date: period.startRecord.date, type: 'start', action: 'delete' });
      }
      if (period.endRecord) {
        records = records.filter(r => !(r.date === period.endRecord.date && r.type === 'end'));
        await syncToCloud({ date: period.endRecord.date, type: 'end', action: 'delete' });
      }
      
      if (currentPeriodStart === period.start) {
        currentPeriodStart = null;
      }
      
      saveData();
      updateUI();
      alert("刪除成功！");
    } catch (err) {
      alert("刪除失敗: " + err);
    } finally {
      showLoading(false);
    }
  }
};

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

    // 點選月曆日期，打開自訂選擇視窗
    dayDiv.addEventListener('click', () => {
      selectedDateStr = dateStr;
      selectedLabel = `${currentYear}/${currentMonth + 1}/${i}`;
      if (modalDateLabel) {
        modalDateLabel.textContent = selectedLabel;
      }
      if (calendarModal) {
        calendarModal.classList.remove('hidden');
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

// 從雲端試算表同步資料回本機
async function syncFromCloud() {
  if (!GAS_URL) return;
  
  showLoading(true);
  try {
    const response = await fetch(GAS_URL);
    if (!response.ok) throw new Error('雲端連線異常');
    
    const cloudRecords = await response.json();
    if (Array.isArray(cloudRecords) && cloudRecords.length > 0) {
      // 比對本機與雲端，把本機沒有的紀錄塞進去
      const localKeys = new Set(records.map(r => `${r.date}_${r.type}`));
      let hasUpdates = false;
      
      cloudRecords.forEach(cRecord => {
        const key = `${cRecord.date}_${cRecord.type}`;
        if (!localKeys.has(key)) {
          records.push(cRecord);
          hasUpdates = true;
        }
      });
      
      if (hasUpdates) {
        // 重新排序並儲存
        records.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // 自動判斷目前是否在生理期中
        const lastStart = records.find(r => r.type === 'start');
        const lastEnd = records.find(r => r.type === 'end');
        if (lastStart) {
          if (!lastEnd || new Date(lastStart.date) > new Date(lastEnd.date)) {
            currentPeriodStart = lastStart.date;
          } else {
            currentPeriodStart = null;
          }
        }
        
        saveData();
        updateUI();
        console.log('與雲端同步完成，已更新本機紀錄！');
      }
    }
  } catch (error) {
    console.error('無法從雲端同步紀錄:', error);
  } finally {
    showLoading(false);
  }
}

// 檢查今天是否為生理期預測日並跳出提醒通知
function checkAndNotify() {
  if (!userSettings.enableNotifications) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const todayStr = new Date().toISOString().split('T')[0];
  const lastNotified = localStorage.getItem('lastNotificationDate');
  
  // 每天只提醒一次，避免重複打擾
  if (lastNotified === todayStr) return;

  const startRecords = records.filter(r => r.type === 'start');
  if (startRecords.length > 0) {
    const lastStart = new Date(startRecords[0].date);
    const nextStart = new Date(lastStart);
    nextStart.setDate(lastStart.getDate() + userSettings.cycleLength);
    
    const today = new Date();
    today.setHours(0,0,0,0);
    nextStart.setHours(0,0,0,0);
    
    const diffTime = nextStart - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    // 當天或前一天時觸發提醒
    if (diffDays === 0 || diffDays === 1) {
      let message = "";
      if (diffDays === 0) {
        message = "親愛的，預測妳的經期今天就要開始囉！記得準備好貼身用品，多喝溫水喔 ❤️";
      } else {
        message = "親愛的，預測妳的經期明天就要開始囉！記得提前準備好貼身用品與保暖喔 🌸";
      }

      new Notification("女孩日記提醒 🌸", {
        body: message,
        icon: 'icon-512.png',
        tag: 'menstrual-reminder',
        requireInteraction: true // 通知會持續停留在畫面上直到手動點選
      });

      localStorage.setItem('lastNotificationDate', todayStr);
    }
  }
}

// Boot up
window.addEventListener('DOMContentLoaded', init);
