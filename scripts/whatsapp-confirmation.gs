/**
 * ==============================================================================
 * LAKSHYA 2026 — Unified Google Sheets Registration & WhatsApp System
 * ==============================================================================
 *
 * Spreadsheet: LAKSHYA 2026 Form Responses
 * Sheet: Form Responses 1
 *
 * COLUMNS:
 * Col A (1)  = Timestamp
 * Col B (2)  = Team Name :
 * Col C (3)  = Team Lead Name :
 * Col D (4)  = College / Institution Name :
 * Col E (5)  = Degree / Program:
 * Col F (6)  = College ID Card  :
 * Col G (7)  = Team Lead Email ID :
 * Col H (8)  = Team Lead PhoneNo:
 * Col I (9)  = Number of Team Members
 * Col J (10) = Member 2 (Full Name)
 * Col K (11) = Member 3 (Full Name)
 * Col L (12) = Member 4 (Full Name)
 * Col M (13) = UTR Number
 * Col N (14) = Upload Payment Screenshot
 * Col O (15) = Team ID (PROTECTED)
 * Col P (16) = Attendance (PROTECTED)
 * Col Q (17) = Email Status (PROTECTED)
 * Col R (18) = WhatsApp Confirmation (NEW)
 */

const CONFIG = {
  prefix: "LAK-",
  whatsappLink: "https://chat.whatsapp.com/DbQG3y0N9PQ4orwt8ftxcq", // Announcement group for emails
  teamNameHeader: "Team Name :",
  emailHeader: "Team Lead Email ID :",
  phoneHeader: "Team Lead PhoneNo:",
  teamIdHeader: "Team ID",
  attendanceHeader: "Attendance",
  emailStatusHeader: "Email Status",
  whatsappConfirmationHeader: "WhatsApp Confirmation",
  whatsappLinkLabel: "Send WhatsApp"
};

/**
 * Run this function ONCE to set up the sheet.
 * It creates the required columns (O, P, Q, R) and installs the trigger.
 */
function setupRegistrationSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];

  let headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(h => h.trim());

  [
    CONFIG.teamIdHeader,
    CONFIG.attendanceHeader,
    CONFIG.emailStatusHeader,
    CONFIG.whatsappConfirmationHeader
  ].forEach(header => {
    if (!headers.includes(header)) {
      headers.push(header);
    }
  });

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const existingTriggers = ScriptApp.getProjectTriggers();

  existingTriggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "onFormSubmit") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("onFormSubmit")
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  // Prepare existing rows without resending emails.
  for (let row = 2; row <= sheet.getLastRow(); row++) {
    initializeExistingRow_(sheet, row);
    processRowForWhatsAppLink(sheet, row);
  }

  SpreadsheetApp.flush();

  Logger.log("Registration system and WhatsApp confirmation installed successfully.");
}

/**
 * Runs automatically whenever the Google Form is submitted.
 */
function onFormSubmit(e) {
  if (!e || !e.range) {
    throw new Error(
      "Submit the Google Form to trigger this function. " +
      "Run setupRegistrationSystem() first."
    );
  }

  const sheet = e.range.getSheet();
  const lock = LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    ensureColumns_(sheet);

    const row = e.range.getRow();

    // 1. Assign Team ID in Column O and default attendance in Column P
    initializeExistingRow_(sheet, row);

    // 2. Generate WhatsApp Confirmation Link in Column R (immediately after Team ID is assigned)
    processRowForWhatsAppLink(sheet, row);

    // 3. Process Confirmation Email in Column Q
    const columns = getColumns_(sheet);

    const teamId = sheet
      .getRange(row, columns.teamId)
      .getDisplayValue();

    const email = sheet
      .getRange(row, columns.email)
      .getDisplayValue()
      .trim();

    const teamName = sheet
      .getRange(row, columns.teamName)
      .getDisplayValue()
      .trim() || "Team";

    const statusCell = sheet.getRange(row, columns.emailStatus);
    const status = statusCell.getDisplayValue();

    if (status === "SENT") {
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      statusCell.setValue("INVALID EMAIL");
      return;
    }

    // Avoid exceeding Google's available email quota.
    if (MailApp.getRemainingDailyQuota() < 1) {
      statusCell.setValue("PENDING - EMAIL QUOTA");
      return;
    }

    const subject =
      "LAKSHYA 2026 | Your Team ID: " + teamId;

    const body =
      "Hello " + teamName + "!\n\n" +
      "Thank you for registering for LAKSHYA 2026.\n\n" +
      "Your team registration has been recorded.\n\n" +
      "YOUR TEAM ID: " + teamId + "\n\n" +
      "Please keep this ID safe for event-related activities.\n\n" +
      "Join our official WhatsApp group for announcements:\n" +
      CONFIG.whatsappLink + "\n\n" +
      "Best wishes,\n" +
      "Team LAKSHYA 2026\n" +
      "SJBIT, Bengaluru";

    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body,
      name: "LAKSHYA 2026"
    });

    statusCell.setValue("SENT");

  } catch (error) {
    console.error("onFormSubmit error:", error);
    throw error;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Creates missing columns without deleting existing data.
 */
function ensureColumns_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(h => h.trim());

  [
    CONFIG.teamIdHeader,
    CONFIG.attendanceHeader,
    CONFIG.emailStatusHeader,
    CONFIG.whatsappConfirmationHeader
  ].forEach(header => {
    if (!headers.includes(header)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
    }
  });
}

/**
 * Returns the column numbers using the actual sheet headers.
 */
function getColumns_(sheet) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(h => h.trim());

  const find = header => {
    const idx = headers.indexOf(header);
    if (idx !== -1) return idx + 1;
    // Fallback: match without whitespace or punctuation
    const norm = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    const altIdx = headers.findIndex(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === norm);
    return altIdx !== -1 ? altIdx + 1 : 0;
  };

  const teamId = find(CONFIG.teamIdHeader);
  const attendance = find(CONFIG.attendanceHeader);
  const emailStatus = find(CONFIG.emailStatusHeader);
  const email = find(CONFIG.emailHeader);
  const teamName = find(CONFIG.teamNameHeader);
  const phone = find(CONFIG.phoneHeader) || find("Team Lead PhoneNo") || find("Phone") || 8;
  const whatsappConfirmation = find(CONFIG.whatsappConfirmationHeader) || 18;

  if (!teamId || !attendance || !emailStatus || !email || !teamName) {
    throw new Error(
      "Required headers were not found. Check the CONFIG header names."
    );
  }

  return {
    teamId,
    attendance,
    emailStatus,
    email,
    teamName,
    phone,
    whatsappConfirmation
  };
}

/**
 * Assigns an ID and default attendance status if missing.
 * Existing IDs and attendance values are preserved.
 */
function initializeExistingRow_(sheet, row) {
  if (row < 2) return;

  const columns = getColumns_(sheet);

  const idCell = sheet.getRange(row, columns.teamId);
  const attendanceCell = sheet.getRange(row, columns.attendance);

  if (!idCell.getDisplayValue()) {
    const teamId = getNextTeamId_(sheet, columns.teamId);
    idCell.setValue(teamId);
  }

  if (!attendanceCell.getDisplayValue()) {
    attendanceCell.setValue("Not Marked");
  }
}

/**
 * Finds the next unused sequential Team ID.
 */
function getNextTeamId_(sheet, teamIdColumn) {
  const lastRow = sheet.getLastRow();
  let maxId = 0;

  if (lastRow >= 2) {
    const ids = sheet
      .getRange(2, teamIdColumn, lastRow - 1, 1)
      .getDisplayValues();

    ids.forEach(([id]) => {
      const match = id.trim().match(/^LAK-(\d+)$/);

      if (match) {
        maxId = Math.max(maxId, Number(match[1]));
      }
    });
  }

  return CONFIG.prefix + String(maxId + 1).padStart(3, "0");
}

/**
 * ==============================================================================
 * WHATSAPP CONFIRMATION LINK GENERATION (Column R)
 * ==============================================================================
 */

/**
 * Generates and sets the =HYPERLINK formula for WhatsApp click-to-chat in Column R.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} rowNumber - 1-based row index
 */
function processRowForWhatsAppLink(sheet, rowNumber) {
  try {
    if (rowNumber < 2) return;

    const columns = getColumns_(sheet);
    if (!columns.whatsappConfirmation) return;

    const teamId = sheet.getRange(rowNumber, columns.teamId).getDisplayValue().trim();
    if (!teamId) {
      Logger.log("Row " + rowNumber + ": Team ID not assigned yet. Skipping WhatsApp link.");
      return;
    }

    const teamName = sheet.getRange(rowNumber, columns.teamName).getDisplayValue().trim() || "Participant";
    const rawPhone = sheet.getRange(rowNumber, columns.phone).getDisplayValue().trim();
    const targetCell = sheet.getRange(rowNumber, columns.whatsappConfirmation);

    const normalizedPhone = normalizePhoneNumber(rawPhone);
    if (!normalizedPhone) {
      Logger.log("Row " + rowNumber + ": Phone number unavailable or invalid (" + rawPhone + ").");
      targetCell.setValue("Phone number unavailable");
      return;
    }

    const message = buildWhatsAppMessage(teamName, teamId);
    const waUrl = generateWhatsAppUrl(normalizedPhone, message);
    const formula = buildHyperlinkFormula(waUrl, CONFIG.whatsappLinkLabel || "Send WhatsApp");

    // Idempotent: avoid overwriting if identical formula already present
    if (targetCell.getFormula() === formula) {
      return;
    }

    targetCell.setFormula(formula);
    Logger.log("Row " + rowNumber + ": Generated WhatsApp link for Team " + teamId);

  } catch (err) {
    console.error("Row " + rowNumber + " WhatsApp error:", err);
  }
}

/**
 * Normalizes phone numbers for WhatsApp click-to-chat URLs (country code + national number, digits only).
 */
function normalizePhoneNumber(rawPhone) {
  if (!rawPhone) return null;
  const phoneStr = String(rawPhone).trim();
  if (phoneStr.length === 0) return null;

  const hadPlusPrefix = phoneStr.charAt(0) === '+';
  const digitsOnly = phoneStr.replace(/[^0-9]/g, '');

  if (digitsOnly.length < 10) {
    return null;
  }

  if (hadPlusPrefix) {
    return digitsOnly;
  }

  if (digitsOnly.length === 10) {
    return '91' + digitsOnly;
  }

  if (digitsOnly.length === 11 && digitsOnly.charAt(0) === '0') {
    return '91' + digitsOnly.substring(1);
  }

  if (digitsOnly.length === 12 && digitsOnly.substring(0, 2) === '91') {
    return digitsOnly;
  }

  return digitsOnly;
}

/**
 * Builds the personalized LAKSHYA 2026 WhatsApp message.
 */
function buildWhatsAppMessage(teamName, teamId) {
  const cleanTeam = (teamName || 'Participant').trim();
  const cleanId = (teamId || '').trim();

  return 'Hello ' + cleanTeam + ' Team!\n\n' +
    'Thank you for registering for LAKSHYA 2026.\n\n' +
    'Your Team ID is: ' + cleanId + '\n\n' +
    'Please save your Team ID for future event communication.\n\n' +
    'We look forward to seeing you at LAKSHYA 2026!\n\n' +
    'Regards,\n' +
    'LAKSHYA 2026 Organizing Team';
}

/**
 * Builds the WhatsApp click-to-chat URL:
 * https://wa.me/RECIPIENT_PHONE?text=URL_ENCODED_MESSAGE
 */
function generateWhatsAppUrl(recipientPhone, message) {
  if (!recipientPhone) return null;
  const encodedMsg = encodeURIComponent(message);
  return 'https://wa.me/' + recipientPhone + '?text=' + encodedMsg;
}

/**
 * Builds the safe Google Sheets HYPERLINK formula:
 * =HYPERLINK("https://wa.me/...", "Send WhatsApp")
 */
function buildHyperlinkFormula(url, label) {
  const cleanLabel = label || "Send WhatsApp";
  const safeUrl = url.replace(/"/g, '""');
  const safeLabel = cleanLabel.replace(/"/g, '""');
  return '=HYPERLINK("' + safeUrl + '", "' + safeLabel + '")';
}

/**
 * Utility: Run this once manually from the Apps Script editor to backfill Column R
 * for all existing registrations without resending emails or altering Team IDs.
 */
function generateMissingWhatsAppLinks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];

  ensureColumns_(sheet);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("No data rows to backfill.");
    return;
  }

  Logger.log("Backfilling WhatsApp links for rows 2 to " + lastRow + "...");
  let count = 0;

  for (let r = 2; r <= lastRow; r++) {
    processRowForWhatsAppLink(sheet, r);
    count++;
  }

  SpreadsheetApp.flush();
  Logger.log("Backfill complete. Processed " + count + " rows.");
}
