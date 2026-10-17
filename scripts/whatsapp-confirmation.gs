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
 * Col S (19) = Attendance Email Status (DIRECTIONS MAIL)
 */

const CONFIG = {
  prefix: "LAK-",
  whatsappLink: "https://chat.whatsapp.com/DbQG3y0N9PQ4orwt8ftxcq", // Announcement group for emails
  teamNameHeader: "Team Name :",
  leaderNameHeader: "Team Lead Name :",
  emailHeader: "Team Lead Email ID :",
  phoneHeader: "Team Lead PhoneNo:",
  teamIdHeader: "Team ID",
  attendanceHeader: "Attendance",
  emailStatusHeader: "Email Status",
  whatsappConfirmationHeader: "WhatsApp Confirmation",
  attendanceEmailHeader: "Attendance Email Status",
  venueHall: "CSE Seminar Hall",
  venueDirections: "Go straight and take a left",
  whatsappLinkLabel: "Send WhatsApp"
};

/**
 * Run this function ONCE to set up the sheet.
 * It creates the required columns (O, P, Q, R, S) and installs triggers.
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
    CONFIG.whatsappConfirmationHeader,
    CONFIG.attendanceEmailHeader
  ].forEach(header => {
    if (!headers.includes(header)) {
      headers.push(header);
    }
  });

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const existingTriggers = ScriptApp.getProjectTriggers();

  existingTriggers.forEach(trigger => {
    const fn = trigger.getHandlerFunction();
    if (fn === "onFormSubmit" || fn === "onSpreadsheetChange" || fn === "onSheetEdit") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 1. Google Form submit trigger
  ScriptApp.newTrigger("onFormSubmit")
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  // 2. Trigger on spreadsheet change (fires on API / external writes to Column P)
  ScriptApp.newTrigger("onSpreadsheetChange")
    .forSpreadsheet(ss)
    .onChange()
    .create();

  // 3. Trigger on direct UI edit
  ScriptApp.newTrigger("onSheetEdit")
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  // Prepare existing rows without resending emails.
  for (let row = 2; row <= sheet.getLastRow(); row++) {
    initializeExistingRow_(sheet, row);
    processRowForWhatsAppLink(sheet, row);
  }

  SpreadsheetApp.flush();

  Logger.log("Registration system, WhatsApp confirmation, and attendance email triggers installed successfully.");
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
    CONFIG.whatsappConfirmationHeader,
    CONFIG.attendanceEmailHeader
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
  const leadName = find(CONFIG.leaderNameHeader) || find("Team Lead Name") || find("Lead Name") || 3;
  const phone = find(CONFIG.phoneHeader) || find("Team Lead PhoneNo") || find("Phone") || 8;
  const whatsappConfirmation = find(CONFIG.whatsappConfirmationHeader) || 18;
  const attendanceEmail = find(CONFIG.attendanceEmailHeader) || 19;

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
    leadName,
    phone,
    whatsappConfirmation,
    attendanceEmail
  };
}

/**
 * Assigns an ID and default attendance status if missing.
 * Existing IDs and attendance values are preserved.
 */
function initializeExistingRow_(sheet, row) {
  if (row < 2) return;

  const columns = getColumns_(sheet);

  // Guard: Do not initialize empty/blank rows (must have Team Name or Timestamp)
  const teamName = sheet.getRange(row, columns.teamName).getDisplayValue().trim();
  const timestamp = sheet.getRange(row, 1).getDisplayValue().trim();
  if (!teamName && !timestamp) {
    return;
  }

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

    // Guard: Skip empty rows
    const teamNameVal = sheet.getRange(rowNumber, columns.teamName).getDisplayValue().trim();
    const timestampVal = sheet.getRange(rowNumber, 1).getDisplayValue().trim();
    if (!teamNameVal && !timestampVal) {
      return;
    }

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

/**
 * ==============================================================================
 * ATTENDANCE CONFIRMATION & DIRECTIONS EMAIL SYSTEM (Column S)
 * Venue: CSE Seminar Hall
 * Directions: Go straight and take a left
 * ==============================================================================
 */

/**
 * Automatically fired when HackAdmin API or an external tool edits the spreadsheet
 * (e.g. marking Column P as 'P' or 'Present').
 */
function onSpreadsheetChange(e) {
  checkAndSendAttendanceEmails();
}

/**
 * Automatically fired when an organizer edits cells directly in the spreadsheet UI.
 */
function onSheetEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const row = e.range.getRow();
  if (row < 2) return;

  const columns = getColumns_(sheet);
  const col = e.range.getColumn();

  // If Attendance column was edited
  if (col === columns.attendance) {
    processAttendanceEmail(sheet, row);
  }
}

/**
 * Triggers arrival directions email to the Team Lead when attendance is marked as Present.
 * Venue: CSE Seminar Hall
 * Directions: Go straight and take a left
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} rowNumber - 1-based row index
 */
function processAttendanceEmail(sheet, rowNumber) {
  if (rowNumber < 2) return;

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    Logger.log("Lock acquisition timed out for row " + rowNumber);
  }

  try {
    const columns = getColumns_(sheet);
    if (!columns.attendanceEmail) return;

    const attendanceCell = sheet.getRange(rowNumber, columns.attendance);
    const attendanceValue = attendanceCell.getDisplayValue().trim().toUpperCase();

    // Only trigger if attendance is marked as Present ('P' or 'PRESENT')
    if (attendanceValue !== "P" && attendanceValue !== "PRESENT") {
      return;
    }

    const emailStatusCell = sheet.getRange(rowNumber, columns.attendanceEmail);
    const existingStatus = emailStatusCell.getDisplayValue().trim().toUpperCase();

    // Idempotent: Never resend if already sent
    if (existingStatus === "SENT") {
      return;
    }

    const email = sheet.getRange(rowNumber, columns.email).getDisplayValue().trim();
    const teamId = sheet.getRange(rowNumber, columns.teamId).getDisplayValue().trim();
    const teamName = sheet.getRange(rowNumber, columns.teamName).getDisplayValue().trim() || "Participant";
    const leadName = columns.leadName ? sheet.getRange(rowNumber, columns.leadName).getDisplayValue().trim() : "Team Leader";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailStatusCell.setValue("INVALID EMAIL");
      return;
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      emailStatusCell.setValue("PENDING - EMAIL QUOTA");
      return;
    }

    const subject = "LAKSHYA 2026 | Attendance Confirmed — Move to " + CONFIG.venueHall;

    const body =
      "Hello " + teamName + "!\n\n" +
      "Your attendance for LAKSHYA 2026 has been marked as PRESENT.\n\n" +
      "VENUE & ARRIVAL DIRECTIONS:\n" +
      "📍 Destination: " + CONFIG.venueHall + "\n" +
      "🚶 Directions: " + CONFIG.venueDirections + "\n\n" +
      "TEAM DETAILS:\n" +
      "• Team ID: " + teamId + "\n" +
      "• Team Name: " + teamName + "\n" +
      "• Team Lead: " + (leadName || "N/A") + "\n\n" +
      "Please proceed immediately to the " + CONFIG.venueHall + " and take your designated seats.\n" +
      "If you need any guidance or have luggage, please approach our organizers at the help desk.\n\n" +
      "Best wishes for the hackathon!\n\n" +
      "Warm regards,\n" +
      "Team LAKSHYA 2026\n" +
      "SJBIT, Bengaluru";

    const htmlBody =
      "<div style=\"font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0b0f19; color: #f1f5f9; border-radius: 12px; border: 1px solid #1e293b;\">" +
        "<div style=\"border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 20px;\">" +
          "<h1 style=\"color: #ffffff; font-size: 22px; margin: 0 0 4px 0;\">LAKSHYA 2026</h1>" +
          "<p style=\"color: #10b981; font-size: 14px; font-weight: 600; margin: 0;\">✓ ATTENDANCE CONFIRMED — PRESENT</p>" +
        "</div>" +

        "<p style=\"font-size: 15px; color: #cbd5e1; line-height: 1.6;\">Hello <strong>" + teamName + "</strong>,</p>" +
        "<p style=\"font-size: 15px; color: #cbd5e1; line-height: 1.6;\">Your check-in has been successfully verified and your attendance is officially recorded.</p>" +

        "<div style=\"background-color: #1e1b4b; border-left: 4px solid #8b5cf6; padding: 16px; border-radius: 8px; margin: 20px 0;\">" +
          "<h2 style=\"color: #c4b5fd; font-size: 16px; margin: 0 0 8px 0;\">📍 VENUE ARRIVAL DIRECTIONS</h2>" +
          "<p style=\"margin: 4px 0; color: #ffffff; font-size: 15px;\"><strong>Destination:</strong> " + CONFIG.venueHall + "</p>" +
          "<p style=\"margin: 4px 0; color: #a78bfa; font-size: 16px; font-weight: bold;\">🚶 Directions: " + CONFIG.venueDirections + "</p>" +
        "</div>" +

        "<div style=\"background-color: #111827; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #1f2937;\">" +
          "<h3 style=\"color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 10px 0;\">Team Credentials</h3>" +
          "<table style=\"width: 100%; font-size: 14px;\">" +
            "<tr><td style=\"color: #64748b; padding: 4px 0;\">Team ID:</td><td style=\"color: #10b981; font-family: monospace; font-weight: bold;\">" + teamId + "</td></tr>" +
            "<tr><td style=\"color: #64748b; padding: 4px 0;\">Team Name:</td><td style=\"color: #f1f5f9;\">" + teamName + "</td></tr>" +
            "<tr><td style=\"color: #64748b; padding: 4px 0;\">Team Lead:</td><td style=\"color: #f1f5f9;\">" + leadName + "</td></tr>" +
          "</table>" +
        "</div>" +

        "<p style=\"font-size: 14px; color: #94a3b8; line-height: 1.6;\">Please proceed immediately to the <strong>" + CONFIG.venueHall + "</strong> and take your seats. If you have any questions, approach any student volunteer wearing a LAKSHYA organizer badge.</p>" +

        "<div style=\"border-top: 1px solid #1e293b; padding-top: 16px; margin-top: 24px; font-size: 12px; color: #64748b;\">" +
          "<p style=\"margin: 0;\">Best wishes for the hackathon!</p>" +
          "<p style=\"margin: 4px 0 0 0; color: #94a3b8;\"><strong>Team LAKSHYA 2026</strong> &middot; SJBIT, Bengaluru</p>" +
        "</div>" +
      "</div>";

    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body,
      htmlBody: htmlBody,
      name: "LAKSHYA 2026"
    });

    emailStatusCell.setValue("SENT");
    Logger.log("Row " + rowNumber + ": Directions email sent to " + email + " for Team " + teamId);

  } catch (error) {
    console.error("Row " + rowNumber + " attendance email error:", error);
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

/**
 * Scans all rows and sends attendance arrival directions emails for any teams
 * marked as 'P' or 'Present' whose directions email has not yet been sent.
 * Safe to run manually or on an interval timer.
 */
function checkAndSendAttendanceEmails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];
  ensureColumns_(sheet);

  const columns = getColumns_(sheet);
  if (!columns.attendanceEmail) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const attendanceValues = sheet.getRange(2, columns.attendance, lastRow - 1, 1).getDisplayValues();
  const emailStatuses = sheet.getRange(2, columns.attendanceEmail, lastRow - 1, 1).getDisplayValues();

  let sentCount = 0;
  for (let i = 0; i < attendanceValues.length; i++) {
    const val = attendanceValues[i][0].trim().toUpperCase();
    const status = emailStatuses[i][0].trim().toUpperCase();

    if ((val === "P" || val === "PRESENT") && status !== "SENT") {
      processAttendanceEmail(sheet, i + 2);
      sentCount++;
    }
  }

  if (sentCount > 0) {
    Logger.log("checkAndSendAttendanceEmails: Successfully sent " + sentCount + " directions emails.");
  }
}
