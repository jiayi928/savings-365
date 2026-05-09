/**
 * ============================================
 *  365 存款挑戰 — Google Apps Script 後端
 * ============================================
 * 
 * 📖 使用說明：
 * 1. 開啟 Google 試算表 → 擴充功能 → Apps Script
 * 2. 將此檔案的所有內容複製貼上（取代預設程式碼）
 * 3. 點選「部署」→「新增部署作業」
 * 4. 類型：網頁應用程式
 *    - 執行身分：我
 *    - 誰可以存取：所有人
 * 5. 點選「部署」，複製產生的 URL
 * 6. 將 URL 貼到網頁應用的「設定」頁面
 * 
 * ⚠️ 每次修改程式碼後，需要「新增部署作業」才會生效
 * ============================================
 */

const SHEET_NAME = '存款紀錄';

/**
 * 初始化試算表（自動建立標題列）
 */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // 設定標題
    sheet.getRange('A1:D1').setValues([['日期', '金額', '區間', '備註']]);
    sheet.getRange('A1:D1')
      .setFontWeight('bold')
      .setBackground('#4a90d9')
      .setFontColor('white');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(2, 100);
    sheet.setColumnWidth(3, 80);
    sheet.setColumnWidth(4, 150);
  }
  
  return sheet;
}

/**
 * 處理 GET 請求（讀取資料）
 */
function doGet(e) {
  try {
    const action = e.parameter.action || 'getAll';
    
    if (action === 'getAll') {
      return getAllRecords();
    }
    
    return jsonResponse({ status: 'error', message: '未知的 action' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

/**
 * 處理 POST 請求（新增/刪除資料）
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    if (action === 'deposit') {
      return addDeposit(data);
    } else if (action === 'delete') {
      return deleteDeposit(data);
    }
    
    return jsonResponse({ status: 'error', message: '未知的 action' });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

/**
 * 取得所有紀錄
 */
function getAllRecords() {
  const sheet = getOrCreateSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    return jsonResponse({ status: 'success', records: [] });
  }
  
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const records = data.map(row => ({
    date: formatDateValue(row[0]),
    amount: Number(row[1]),
    pool: row[2] === '雙倍' ? 'double' : 'normal',
    note: row[3] || ''
  }));
  
  return jsonResponse({ status: 'success', records });
}

/**
 * 新增存款紀錄
 */
function addDeposit(data) {
  const sheet = getOrCreateSheet();
  const poolLabel = data.pool === 'double' ? '雙倍' : '正常';
  const date = data.date || new Date().toISOString().split('T')[0];
  
  // 檢查是否已存在相同金額和區間的紀錄
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
  
  // 排序（依日期）
  if (sheet.getLastRow() > 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 4)
      .sort({ column: 1, ascending: true });
  }
  
  return jsonResponse({ status: 'success', message: '存款紀錄已新增' });
}

/**
 * 刪除存款紀錄
 */
function deleteDeposit(data) {
  const sheet = getOrCreateSheet();
  const lastRow = sheet.getLastRow();
  const poolLabel = data.pool === 'double' ? '雙倍' : '正常';
  
  if (lastRow <= 1) {
    return jsonResponse({ status: 'error', message: '無紀錄可刪除' });
  }
  
  const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (Number(values[i][1]) === Number(data.amount) && values[i][2] === poolLabel) {
      sheet.deleteRow(i + 2);
      return jsonResponse({ status: 'success', message: '紀錄已刪除' });
    }
  }
  
  return jsonResponse({ status: 'error', message: '找不到對應的紀錄' });
}

/**
 * 格式化日期
 */
function formatDateValue(val) {
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val);
}

/**
 * 回傳 JSON 回應
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
