function doPost(e) {
  try {
    // 取得 Google Sheet
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // 如果是第一次執行，建立標題列
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['時間戳記', '日期', '紀錄類型', '經血量', '痛經程度', '備註']);
      // 設定標題列樣式 (粉色背景)
      sheet.getRange(1, 1, 1, 6).setBackground('#ff8fab').setFontColor('white').setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    // 解析前端傳來的 JSON 資料
    var data = JSON.parse(e.postData.contents);
    
    // 將資料寫入試算表
    sheet.appendRow([
      data.timestamp || new Date(),
      data.date || '',
      data.type || '',
      data.flow || '',
      data.pain || '',
      data.notes || ''
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({"status": "success", "message": "Record added"}))
                         .setMimeType(ContentService.MimeType.JSON);
                         
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({"status": "error", "message": error.toString()}))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Menstrual Tracker API is running!");
}
