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
  emailHeader: "Team Lead Email ID :",
  phoneHeader: "Team Lead PhoneNo:",
  teamIdHeader: "Team ID",
  attendanceHeader: "Attendance",
  emailStatusHeader: "Email Status",
  whatsappConfirmationHeader: "WhatsApp Confirmation",
  attendanceEmailHeader: "Attendance Email Status",
  whatsappLinkLabel: "Send WhatsApp",
  organizerEmail: "hemanth109c@gmail.com",
  venueHall: "CSE Seminar Hall",
  venueDirections: "Go straight and take a left"
};

/**
 * Always target the actual Google Form response worksheet, not whichever tab
 * happens to be first in the spreadsheet.
 */
function getRegistrationSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Form Responses 1");
  if (!sheet) {
    throw new Error('Could not find the worksheet "Form Responses 1". Check the exact tab name.');
  }
  return sheet;
}

/**
 * Run this function ONCE to set up the sheet.
 * It verifies the required columns and installs the managed triggers. It also prepares existing rows.
 */
function setupRegistrationSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getRegistrationSheet_();

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

  const managedHandlers = [
    "onFormSubmit",
    "onSpreadsheetChange",
    "onSheetEdit",
    "checkAndSendAttendanceEmails"
  ];

  existingTriggers.forEach(trigger => {
    if (managedHandlers.includes(trigger.getHandlerFunction())) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("onFormSubmit")
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  ScriptApp.newTrigger("onSpreadsheetChange")
    .forSpreadsheet(ss)
    .onChange()
    .create();

  ScriptApp.newTrigger("onSheetEdit")
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  // Reliable fallback for attendance changes made by HackAdmin/API.
  ScriptApp.newTrigger("checkAndSendAttendanceEmails")
    .timeBased()
    .everyMinutes(5)
    .create();

  // Prepare existing rows without resending emails.
  for (let row = 2; row <= sheet.getLastRow(); row++) {
    initializeExistingRow_(sheet, row);
    processRowForWhatsAppLink(sheet, row);
  }

  SpreadsheetApp.flush();

  Logger.log("Registration, participant email, organizer alerts, WhatsApp links, and attendance email triggers installed successfully.");
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

    // 2. Generate WhatsApp Confirmation Link in Column R.
    processRowForWhatsAppLink(sheet, row);

    // 3. Notify the organizer about this registration. This only reads A:O.
    // A notification failure must not stop the participant confirmation email.
    try {
      sendOrganizerRegistrationAlert_(sheet, row);
    } catch (alertError) {
      console.error("Organizer registration alert failed for row " + row, alertError);
    }

    // 4. Process participant confirmation email in Column Q.
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
  const phone = find(CONFIG.phoneHeader) || find("Team Lead PhoneNo") || find("Phone") || 8;
  const whatsappConfirmation = find(CONFIG.whatsappConfirmationHeader) || 18;
  const leadName = find("Team Lead Name :") || find("Team Lead Name") || 3;
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
 * Skips empty/blank rows.
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
 * Finds the next unused sequential Team ID by scanning the entire column:
 * - Starts scanning from 2 (LAK-001 is skipped/reserved).
 * - Fills any missing gaps (allocates LAK-026 through LAK-033).
 * - Never duplicates existing numbers (automatically skips LAK-034 and LAK-035).
 * - Moves directly to LAK-036, LAK-037, etc. once the gap is filled.
 */
function getNextTeamId_(sheet, teamIdColumn) {
  const lastRow = sheet.getLastRow();
  const existingNumbers = {};

  if (lastRow >= 2) {
    const ids = sheet
      .getRange(2, teamIdColumn, lastRow - 1, 1)
      .getDisplayValues();

    ids.forEach(([id]) => {
      const match = id.trim().match(/^LAK-(\d+)$/);

      if (match) {
        existingNumbers[Number(match[1])] = true;
      }
    });
  }

  // Start from 2 (LAK-001 is skipped/reserved)
  let candidate = 2;
  while (existingNumbers[candidate]) {
    candidate++;
  }

  return CONFIG.prefix + String(candidate).padStart(3, "0");
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
    const rawPhone = sheet.getRange(rowNumber, 8).getDisplayValue().trim(); // Column H is Team Lead PhoneNo
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
  const sheet = getRegistrationSheet_();

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
 * Sends the organizer a registration alert containing the submitted details.
 * Reads columns A:O only; does not modify Team ID (O), Attendance (P),
 * or participant Email Status (Q).
 */
function sendOrganizerRegistrationAlert_(sheet, rowNumber) {
  if (rowNumber < 2) return;

  const ss = sheet.getParent();
  const key = "LAKSHYA_ORGANIZER_ALERT_" + ss.getId() + "_" +
    sheet.getSheetId() + "_" + rowNumber;
  const props = PropertiesService.getScriptProperties();

  if (props.getProperty(key) === "SENT") return;

  const values = sheet.getRange(rowNumber, 1, 1, 15).getDisplayValues()[0];
  const headers = sheet.getRange(1, 1, 1, 15).getDisplayValues()[0];
  const teamId = String(values[14] || "").trim();

  if (!teamId) {
    throw new Error("Cannot send organizer alert: Team ID is empty in column O.");
  }

  const lines = [
    "A new LAKSHYA 2026 registration has been received.",
    "",
    "Team ID: " + teamId,
    "",
    "REGISTRATION DETAILS"
  ];

  for (let i = 0; i < 14; i++) {
    const header = String(headers[i] || ("Column " + (i + 1))).trim();
    const value = String(values[i] || "").trim();
    lines.push(header + ": " + (value || "Not provided"));
  }

  lines.push("", "Team ID: " + teamId);
  lines.push("", "This is an automated notification from the LAKSHYA 2026 registration system.");

  MailApp.sendEmail({
    to: CONFIG.organizerEmail,
    subject: "New LAKSHYA 2026 Registration | " + teamId,
    body: lines.join("\n"),
    name: "LAKSHYA 2026 Registration System"
  });

  // Save only after MailApp accepts the email, preventing normal duplicate alerts.
  props.setProperty(key, "SENT");
  Logger.log("Organizer registration alert sent for " + teamId + " to " + CONFIG.organizerEmail);
}

/**
 * Runs for direct spreadsheet edits. Attendance emails are sent only when
 * the Attendance column is changed to P or Present.
 */
function onSheetEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const row = e.range.getRow();
  if (row < 2) return;

  const columns = getColumns_(sheet);
  if (e.range.getColumn() === columns.attendance) {
    processAttendanceEmail_(sheet, row);
  }
}

/**
 * Spreadsheet change trigger. The scheduled five-minute scan below is the
 * reliable fallback for values written through the HackAdmin/API integration.
 */
function onSpreadsheetChange(e) {
  checkAndSendAttendanceEmails();
}

/**
 * Sends attendance confirmation and venue directions when column P is P
 * or PRESENT. Status is written to column S only after the email succeeds.
 */
function processAttendanceEmail_(sheet, rowNumber) {
  if (rowNumber < 2) return;

  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    lock.waitLock(15000);
    lockAcquired = true;

    const columns = getColumns_(sheet);
    const attendance = String(
      sheet.getRange(rowNumber, columns.attendance).getDisplayValue() || ""
    ).trim().toUpperCase();

    if (attendance !== "P" && attendance !== "PRESENT") return;

    const statusCell = sheet.getRange(rowNumber, columns.attendanceEmail);
    if (String(statusCell.getDisplayValue() || "").trim().toUpperCase() === "SENT") return;

    const email = String(sheet.getRange(rowNumber, columns.email).getDisplayValue() || "").trim();
    const teamId = String(sheet.getRange(rowNumber, columns.teamId).getDisplayValue() || "").trim();
    const teamName = String(sheet.getRange(rowNumber, columns.teamName).getDisplayValue() || "").trim() || "Participant";
    const leadName = String(sheet.getRange(rowNumber, columns.leadName).getDisplayValue() || "").trim() || "Team Lead";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      statusCell.setValue("INVALID EMAIL");
      return;
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      statusCell.setValue("PENDING - EMAIL QUOTA");
      return;
    }

    const subject = "LAKSHYA 2026 | Attendance Confirmed — " + CONFIG.venueHall;
    const body =
      "Hello " + teamName + " team,\n\n" +
      "Your attendance for LAKSHYA 2026 has been marked as PRESENT.\n\n" +
      "VENUE: " + CONFIG.venueHall + "\n" +
      "DIRECTIONS: " + CONFIG.venueDirections + "\n\n" +
      "TEAM DETAILS\n" +
      "Team ID: " + teamId + "\n" +
      "Team Name: " + teamName + "\n" +
      "Team Lead: " + leadName + "\n\n" +
      "Please proceed to the venue. If you need help, approach the event organizers.\n\n" +
      "Regards,\nTeam LAKSHYA 2026\nSJBIT, Bengaluru";

    const htmlBody =
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#0b0f19;color:#f1f5f9;border-radius:12px;">' +
      '<h1 style="margin-top:0;color:#fff;">LAKSHYA 2026</h1>' +
      '<p style="color:#34d399;font-weight:bold;">✓ ATTENDANCE CONFIRMED — PRESENT</p>' +
      '<p>Hello <strong>' + escapeHtml_(teamName) + '</strong>,</p>' +
      '<p>Your attendance has been recorded successfully.</p>' +
      '<div style="padding:16px;background:#1e1b4b;border-left:4px solid #8b5cf6;border-radius:8px;">' +
      '<h3 style="margin-top:0;color:#c4b5fd;">VENUE & DIRECTIONS</h3>' +
      '<p><strong>Venue:</strong> ' + escapeHtml_(CONFIG.venueHall) + '</p>' +
      '<p><strong>Directions:</strong> ' + escapeHtml_(CONFIG.venueDirections) + '</p></div>' +
      '<h3>Team Details</h3><p><strong>Team ID:</strong> ' + escapeHtml_(teamId) + '<br>' +
      '<strong>Team Name:</strong> ' + escapeHtml_(teamName) + '<br>' +
      '<strong>Team Lead:</strong> ' + escapeHtml_(leadName) + '</p>' +
      '<p>Please proceed to the venue. For help, approach the event organizers.</p>' +
      '<hr><p>Regards,<br><strong>Team LAKSHYA 2026</strong><br>SJBIT, Bengaluru</p></div>';

    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body,
      htmlBody: htmlBody,
      name: "LAKSHYA 2026"
    });

    statusCell.setValue("SENT");
    Logger.log("Attendance confirmation sent to " + email + " for " + teamId);
  } catch (error) {
    console.error("Attendance email failed for row " + rowNumber, error);
  } finally {
    if (lockAcquired) {
      try { lock.releaseLock(); } catch (ignored) {}
    }
  }
}

/**
 * Scans for teams marked Present whose attendance email has not been sent.
 * This is installed as a five-minute time-driven trigger.
 */
function checkAndSendAttendanceEmails() {
  const sheet = getRegistrationSheet_();
  ensureColumns_(sheet);

  const columns = getColumns_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const attendanceValues = sheet.getRange(2, columns.attendance, lastRow - 1, 1).getDisplayValues();
  const statusValues = sheet.getRange(2, columns.attendanceEmail, lastRow - 1, 1).getDisplayValues();

  for (let i = 0; i < attendanceValues.length; i++) {
    const attendance = String(attendanceValues[i][0] || "").trim().toUpperCase();
    const status = String(statusValues[i][0] || "").trim().toUpperCase();

    if ((attendance === "P" || attendance === "PRESENT") && status !== "SENT") {
      processAttendanceEmail_(sheet, i + 2);
    }
  }
}

/** Minimal HTML escaping for values inserted into the attendance email. */
function escapeHtml_(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
