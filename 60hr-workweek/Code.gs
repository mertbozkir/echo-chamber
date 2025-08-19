// Discord webhook URL
const DISCORD_WEBHOOK = "your-discord-webhook-url";

function sendDiscordMessage(message) {
  const payload = JSON.stringify({content: message});
  
  const params = {
    headers: {"Content-Type": "application/json"},
    method: "POST",
    payload: payload,
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(DISCORD_WEBHOOK, params);
    console.log('Discord message sent:', response.getContentText());
  } catch (error) {
    console.error('Error sending Discord message:', error.toString());
  }
}

function addToSheet(docUrl, formattedDate) {
  try {
    const folders = DriveApp.getFoldersByName('omniscience');
    if (!folders.hasNext()) throw new Error('Omniscience folder not found!');
    const folder = folders.next();

    const files = folder.getFilesByName('60hr Workweek Hours');
    if (!files.hasNext()) throw new Error('Spreadsheet "60hr Workweek Hours" not found!');
    const ss = SpreadsheetApp.openById(files.next().getId());
    const sh = ss.getActiveSheet();

    // next empty row in column A (header = "Date" in A1)
    const colA = sh.getRange('A:A').getValues().map(r => r[0]);
    let i = colA.length - 1;
    while (i >= 0 && colA[i] === '') i--;
    const nextRow = i + 2; // 1-based next row

    const sheetId = sh.getSheetId();
    const rowIndex = nextRow - 1; // 0-based

    // Write a FILE smart chip into A{nextRow}
    const req = {
      requests: [{
        updateCells: {
          range: { sheetId, startRowIndex: rowIndex, endRowIndex: rowIndex + 1, startColumnIndex: 0, endColumnIndex: 1 },
          rows: [{
            values: [{
              userEnteredValue: { stringValue: "@" }, // placeholder required
              chipRuns: [{ chip: { richLinkProperties: { uri: docUrl } } }]
            }]
          }],
          fields: "userEnteredValue,chipRuns"
        }
      }]
    };
    Sheets.Spreadsheets.batchUpdate(req, ss.getId());

    // Optional: keep your human-readable date in B
    //sh.getRange(nextRow, 2).setValue(formattedDate);

    console.log(`Added FILE chip to row ${nextRow}`);
  } catch (error) {
    console.error('Error adding chip:', error.toString());
  }
}


function createDailyReport() {
  // Get today's date in format: "thu, 19 aug"
  const today = new Date();
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 
                     'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  
  const dayName = dayNames[today.getDay()];
  const dayNum = today.getDate();
  const monthName = monthNames[today.getMonth()];
  
  const formattedDate = `${dayName}, ${dayNum} ${monthName}`;
  
  try {
    // Find or create "omniscience" folder
    let omniscienceFolder;
    const folders = DriveApp.getFoldersByName('omniscience');
    
    if (folders.hasNext()) {
      omniscienceFolder = folders.next();
    } else {
      omniscienceFolder = DriveApp.createFolder('omniscience');
      console.log('Created "omniscience" folder');
    }
    
    const templateFiles = omniscienceFolder.getFilesByName('60hr-workweek-template');

    if (!templateFiles.hasNext()) {
      throw new Error('Template document "60hr-workweek-template" not found in omniscience folder!');
    }
    
    const templateFile = templateFiles.next();
    
    // Create a copy of the template
    const newFileName = `${formattedDate}`;
    const newFile = templateFile.makeCopy(newFileName);
    
    // Move the new file to omniscience folder
    omniscienceFolder.addFile(newFile);
    DriveApp.getRootFolder().removeFile(newFile);
    
    // Open the new document and replace {{date}} placeholder
    const newDoc = DocumentApp.openById(newFile.getId());
    const body = newDoc.getBody();
    
    // Replace {{date}} with actual date
    body.replaceText('{{date}}', formattedDate);
    
    // Save the document
    newDoc.saveAndClose();
    
    // Send Discord notification with clickable link
    const docUrl = newFile.getUrl();
    const discordMessage = `Daily report for [**${formattedDate}**](${docUrl}) is ready!  --  *60hr workweek experiment*`;
    sendDiscordMessage(discordMessage);
    addToSheet(docUrl, formattedDate);

    
    // Log success (you can see this in Apps Script logs)
    console.log(`Created daily report: ${newFileName}`);
    console.log(`Document URL: https://docs.google.com/document/d/${newFile.getId()}/edit`);
    console.log(`Saved in omniscience folder`);
    
    return newFile.getUrl();
    
  } catch (error) {
    console.error('Error creating daily report:', error.toString());
    throw error;
  }
}

// Optional: Function to set up daily trigger (run this once to set up automation)
function setupDailyTrigger() {
  // Delete existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'createDailyReport') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new daily trigger (runs at 8 AM every day)
  ScriptApp.newTrigger('createDailyReport')
    .timeBased()
    .everyDays(1)
    .atHour(7) // Change this to your preferred hour (0-23)
    .create();
    
  console.log('Daily trigger set up successfully! Will run at 7 AM every day.');
}