function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // 初始化標題列
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['時間戳記', '日期', '紀錄類型', '經血量', '痛經程度', '備註']);
      sheet.getRange(1, 1, 1, 6).setBackground('#ff8fab').setFontColor('white').setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || 'create';
    var timeZone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    
    // 輔助函數：將日期或字串轉為統一的 yyyy-MM-dd
    function normalizeDate(val) {
      if (!val) return "";
      if (val instanceof Date) {
        return Utilities.formatDate(val, timeZone, "yyyy-MM-dd");
      }
      var str = val.toString().trim();
      // 處理 yyyy/MM/dd 格式
      var parts = str.split(/[-/]/);
      if (parts.length === 3) {
        var y = parts[0];
        var m = parts[1].length < 2 ? "0" + parts[1] : parts[1];
        var d = parts[2].length < 2 ? "0" + parts[2] : parts[2];
        return y + "-" + m + "-" + d;
      }
      return str.substring(0, 10);
    }
    
    // 刪除紀錄邏輯
    if (action === 'delete') {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var data = sheet.getRange(2, 2, lastRow - 1, 2).getValues(); // 取得日期(B欄)與紀錄類型(C欄)
        var targetDateStr = normalizeDate(payload.date);
        
        for (var i = data.length - 1; i >= 0; i--) {
          var rowDateStr = normalizeDate(data[i][0]);
          
          if (rowDateStr === targetDateStr && data[i][1] === payload.type) {
            sheet.deleteRow(i + 2); // 刪除該列
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({"status": "success", "message": "Record deleted"}))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    // 新增紀錄邏輯 (create)
    sheet.appendRow([
      payload.timestamp || new Date(),
      payload.date || '',
      payload.type || '',
      payload.flow || '',
      payload.pain || '',
      payload.notes || ''
    ]);
    
    sheet.sort(2, false); // 自動以日期排序
    
    return ContentService.createTextOutput(JSON.stringify({"status": "success", "message": "Record added and sorted"}))
                         .setMimeType(ContentService.MimeType.JSON);
                         
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()}))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

// 支援讀取試算表資料
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      return ContentService.createTextOutput(JSON.stringify([]))
                           .setMimeType(ContentService.MimeType.JSON);
    }
    
    var data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    var records = [];
    var timeZone = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    
    for (var i = 0; i < data.length; i++) {
      var dateVal = data[i][1];
      var dateStr = "";
      
      if (dateVal instanceof Date) {
        dateStr = Utilities.formatDate(dateVal, timeZone, "yyyy-MM-dd");
      } else {
        dateStr = dateVal ? new Date(dateVal).toISOString().split('T')[0] : "";
      }
      
      records.push({
        timestamp: data[i][0],
        date: dateStr,
        type: data[i][2] === 'start' || data[i][2] === '經期開始' ? 'start' : (data[i][2] === 'end' || data[i][2] === '經期結束' ? 'end' : 'log'),
        flow: data[i][3] || '',
        pain: data[i][4] || '',
        notes: data[i][5] || ''
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify(records))
                         .setMimeType(ContentService.MimeType.JSON);
                         
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"error": error.toString()}))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}
