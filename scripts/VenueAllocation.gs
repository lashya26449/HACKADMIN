/**
 * LAKSHYA 2026 — Venue Allocation Attendance Module
 *
 * Integration:
 * 1. In your existing Apps Script project, create a new file named
 *    VenueAllocation.gs and paste this entire file.
 * 2. In the ORIGINAL file, remove the old processAttendanceEmail_ function
 *    (the function beginning around line 610 and ending around line 691).
 *    This file supplies its replacement. Do not keep two definitions.
 * 3. Keep your existing onSheetEdit(), onSpreadsheetChange(),
 *    checkAndSendAttendanceEmails(), triggers, and setup function unchanged.
 * 4. Do NOT run setupRegistrationSystem() for this update.
 *
 * Column/header lookup continues to use your existing getColumns_(),
 * CONFIG, normalizePhoneNumber(), generateWhatsAppUrl(), and
 * buildHyperlinkFormula() helpers.
 */

const LAKSHYA_VENUE_ALLOTMENT = Object.freeze({
  // Ground floor
  "LAK-002": { venue: "CS-1", floor: "Ground Floor" },
  "LAK-003": { venue: "CS-1", floor: "Ground Floor" },
  "LAK-004": { venue: "CS-1", floor: "Ground Floor" },
  "LAK-005": { venue: "CS-1", floor: "Ground Floor" },
  "LAK-006": { venue: "CS-1", floor: "Ground Floor" },
  "LAK-007": { venue: "CS-1", floor: "Ground Floor" },
  "LAK-008": { venue: "CS-1", floor: "Ground Floor" },

  "LAK-009": { venue: "CS-2", floor: "Ground Floor" },
  "LAK-010": { venue: "CS-2", floor: "Ground Floor" },
  "LAK-011": { venue: "CS-2", floor: "Ground Floor" },
  "LAK-012": { venue: "CS-2", floor: "Ground Floor" },
  "LAK-013": { venue: "CS-2", floor: "Ground Floor" },
  "LAK-014": { venue: "CS-2", floor: "Ground Floor" },
  "LAK-015": { venue: "CS-2", floor: "Ground Floor" },

  "LAK-029": { venue: "ST LAB", floor: "Ground Floor" },
  "LAK-030": { venue: "ST LAB", floor: "Ground Floor" },
  "LAK-033": { venue: "ST LAB", floor: "Ground Floor" },
  "LAK-034": { venue: "ST LAB", floor: "Ground Floor" },
  "LAK-036": { venue: "ST LAB", floor: "Ground Floor" },
  "LAK-038": { venue: "ST LAB", floor: "Ground Floor" },
  "LAK-044": { venue: "THOMAS ALVA EDISON", floor: "Second Floor" },
  "LAK-062": { venue: "LINUS TORVALDS", floor: "Fourth Floor" },

  // First floor
  "LAK-031": { venue: "VTU RESEARCH", floor: "First Floor" },
  "LAK-047": { venue: "VTU RESEARCH", floor: "First Floor" },
  "LAK-048": { venue: "VTU RESEARCH", floor: "First Floor" },
  "LAK-049": { venue: "VTU RESEARCH", floor: "First Floor" },
  "LAK-064": { venue: "VTU RESEARCH", floor: "First Floor" },
  "LAK-066": { venue: "VTU RESEARCH", floor: "First Floor" },
  "LAK-070": { venue: "VTU RESEARCH", floor: "First Floor" },
  "LAK-071": { venue: "LINUS TORVALDS", floor: "Fourth Floor" },

  // Second floor
  "LAK-022": { venue: "CV RAMAN", floor: "Second Floor" },
  "LAK-023": { venue: "CV RAMAN", floor: "Second Floor" },
  "LAK-024": { venue: "CV RAMAN", floor: "Second Floor" },
  "LAK-025": { venue: "CV RAMAN", floor: "Second Floor" },
  "LAK-026": { venue: "CV RAMAN", floor: "Second Floor" },
  "LAK-027": { venue: "CV RAMAN", floor: "Second Floor" },
  "LAK-028": { venue: "CV RAMAN", floor: "Second Floor" },
  "LAK-068": { venue: "CV RAMAN", floor: "Second Floor" },

  "LAK-016": { venue: "THOMAS ALVA EDISON", floor: "Second Floor" },
  "LAK-017": { venue: "THOMAS ALVA EDISON", floor: "Second Floor" },
  "LAK-018": { venue: "THOMAS ALVA EDISON", floor: "Second Floor" },
  "LAK-019": { venue: "THOMAS ALVA EDISON", floor: "Second Floor" },
  "LAK-020": { venue: "THOMAS ALVA EDISON", floor: "Second Floor" },
  "LAK-021": { venue: "THOMAS ALVA EDISON", floor: "Second Floor" },

  // Third floor
  "LAK-032": { venue: "EDWARD LAB", floor: "Third Floor" },
  "LAK-035": { venue: "EDWARD LAB", floor: "Third Floor" },
  "LAK-037": { venue: "EDWARD LAB", floor: "Third Floor" },
  "LAK-039": { venue: "EDWARD LAB", floor: "Third Floor" },
  "LAK-040": { venue: "EDWARD LAB", floor: "Third Floor" },
  "LAK-041": { venue: "EDWARD LAB", floor: "Third Floor" },
  "LAK-042": { venue: "EDWARD LAB", floor: "Third Floor" },
  "LAK-043": { venue: "EDWARD LAB", floor: "Third Floor" },
  "LAK-045": { venue: "EDWARD LAB", floor: "Third Floor" },
  "LAK-046": { venue: "EDWARD LAB", floor: "Third Floor" },
  "LAK-050": { venue: "EDWARD LAB", floor: "Third Floor" },
  "LAK-051": { venue: "EDWARD LAB", floor: "Third Floor" },

  "LAK-052": { venue: "RAMANUJACHARYA LAB", floor: "Third Floor" },
  "LAK-053": { venue: "RAMANUJACHARYA LAB", floor: "Third Floor" },
  "LAK-054": { venue: "RAMANUJACHARYA LAB", floor: "Third Floor" },
  "LAK-055": { venue: "RAMANUJACHARYA LAB", floor: "Third Floor" },
  "LAK-056": { venue: "RAMANUJACHARYA LAB", floor: "Third Floor" },
  "LAK-057": { venue: "RAMANUJACHARYA LAB", floor: "Third Floor" },
  "LAK-058": { venue: "RAMANUJACHARYA LAB", floor: "Third Floor" },

  "LAK-059": { venue: "TIM BERNERS", floor: "Third Floor" },
  "LAK-060": { venue: "TIM BERNERS", floor: "Third Floor" },
  "LAK-061": { venue: "TIM BERNERS", floor: "Third Floor" },
  "LAK-063": { venue: "TIM BERNERS", floor: "Third Floor" },
  "LAK-065": { venue: "TIM BERNERS", floor: "Third Floor" },
  "LAK-067": { venue: "TIM BERNERS", floor: "Third Floor" },
  "LAK-069": { venue: "TIM BERNERS", floor: "Third Floor" },
  "LAK-072": { venue: "TIM BERNERS", floor: "Third Floor" },

  // LINUS TORVALDS — venue confirmed in the latest master sheet; floor still needs confirmation.
  "LAK-073": { venue: "LINUS TORVALDS", floor: "Fourth Floor" },
  "LAK-074": { venue: "LINUS TORVALDS", floor: "Fourth Floor" },
  "LAK-075": { venue: "LINUS TORVALDS", floor: "Fourth Floor" },
  "LAK-076": { venue: "LINUS TORVALDS", floor: "Fourth Floor" }
});


/**
 * Returns the confirmed venue record for a listed team ID.
 * Unknown IDs intentionally return null; no venue is guessed.
 */
function getLakshyaVenue_(teamId) {
  const id = String(teamId || "").trim().toUpperCase();
  return LAKSHYA_VENUE_ALLOTMENT[id] || null;
}


/**
 * Builds the attendance WhatsApp text for the team lead.
 * Column R remains a click-to-chat link; this does NOT send WhatsApp
 * automatically.
 */
function buildAttendanceWhatsAppMessage_(teamName, teamId, venueInfo) {
  const v = venueInfo || getLakshyaVenue_(teamId);
  const venue = v ? v.venue : "ALLOTMENT PENDING";
  const floor = v ? v.floor : "Contact Organizers Desk";

  return "🎯 *LAKSHYA 2026*\n\n" +
    "✅ Attendance marked PRESENT!\n\n" +
    "Team: *" + teamName + " (" + teamId + ")*\n" +
    "📍 *Lab Allotted: " + venue +
    " – " + floor + "*\n\n" +
    "🌟 *All the best!*";
}


/**
 * Updates Column R with the attendance/venue WhatsApp click-to-chat link.
 * This only creates a link for the team lead; the user must click Send.
 */
function updateAttendanceWhatsAppLink_(sheet, rowNumber, columns, teamName, teamId, venueInfo) {
  const phone = String(
    sheet.getRange(rowNumber, columns.phone).getDisplayValue() || ""
  ).trim();

  const targetCell = sheet.getRange(rowNumber, columns.whatsappConfirmation);
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!normalizedPhone) {
    targetCell.setValue("Phone number unavailable");
    return;
  }

  const message = buildAttendanceWhatsAppMessage_(teamName, teamId, venueInfo);
  const waUrl = generateWhatsAppUrl(normalizedPhone, message);
  const formula = buildHyperlinkFormula(
    waUrl,
    "Send Venue WhatsApp"
  );

  targetCell.setFormula(formula);
}


/**
 * REPLACEMENT for the existing processAttendanceEmail_ function.
 *
 * Sends only for IDs in the verified allotment. Unknown IDs are held for
 * manual review and are never sent a guessed venue.
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
    const currentStatus = String(
      statusCell.getDisplayValue() || ""
    ).trim().toUpperCase();

    if (currentStatus === "SENT") return;

    const email = String(
      sheet.getRange(rowNumber, columns.email).getDisplayValue() || ""
    ).trim();

    const teamId = String(
      sheet.getRange(rowNumber, columns.teamId).getDisplayValue() || ""
    ).trim().toUpperCase();

    const teamName = String(
      sheet.getRange(rowNumber, columns.teamName).getDisplayValue() || ""
    ).trim() || "Participant";

    const leadName = String(
      sheet.getRange(rowNumber, columns.leadName).getDisplayValue() || ""
    ).trim() || "Team Lead";

    const venueInfo = getLakshyaVenue_(teamId);

    if (!venueInfo) {
      statusCell.setValue("HOLD - UNKNOWN TEAM ID");
      Logger.log("Attendance email held: no venue mapping for " + teamId);
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      statusCell.setValue("INVALID EMAIL");
      return;
    }

    if (MailApp.getRemainingDailyQuota() < 1) {
      statusCell.setValue("PENDING - EMAIL QUOTA");
      return;
    }

    const subject =
      "LAKSHYA 2026 | Venue Allocation — " + teamId;

    const body =
  "Your attendance is marked as PRESENT.\n\n" +
  "Team: " + teamName + " (" + teamId + ")\n" +
  "Lab Allotted: " + venueInfo.venue +
  ", " + venueInfo.floor + "\n\n" +
  "All the best!\n\n" +
  "Team LAKSHYA 2026";

    const htmlBody =
  '<div style="font-family:Arial,sans-serif;padding:24px;color:#222;">' +
  '<h2>LAKSHYA 2026</h2>' +
  '<p>✅ Your attendance is marked as <b>PRESENT</b>.</p>' +
  '<p><b>Team:</b> ' + escapeHtml_(teamName) +
  ' (' + escapeHtml_(teamId) + ')</p>' +
  '<p><b>Lab Allotted:</b> ' +
  escapeHtml_(venueInfo.venue) + ', ' +
  escapeHtml_(venueInfo.floor) + '</p>' +
  '<p><b>All the best!</b></p>' +
  '<p>Team LAKSHYA 2026</p>' +
  '<hr><p>Regards,<br><strong>Team LAKSHYA 2026</strong><br>SJBIT, Bengaluru</p>' +
      '</div>';

    // Send the email first. Mark SENT only after MailApp accepts it.
    MailApp.sendEmail({
      to: email,
      subject: subject,
      body: body,
      htmlBody: htmlBody,
      name: "LAKSHYA 2026"
    });

    statusCell.setValue("SENT");

    // Refresh Column R with the venue-specific WhatsApp click-to-chat link.
    // If this link update fails, the successfully sent email remains SENT.
    try {
      updateAttendanceWhatsAppLink_(
        sheet, rowNumber, columns, teamName, teamId, venueInfo
      );
    } catch (whatsAppError) {
      console.error(
        "Venue WhatsApp link update failed for " + teamId,
        whatsAppError
      );
    }

    Logger.log(
      "LAKSHYA venue email sent to " + email +
      " for " + teamId + " — " + venueInfo.venue +
      ", " + venueInfo.floor
    );

  } catch (error) {
    console.error(
      "Attendance venue email failed for row " + rowNumber,
      error
    );
    // Do not mark SENT on failure. The existing five-minute scanner can retry.
  } finally {
    if (lockAcquired) {
      try {
        lock.releaseLock();
      } catch (ignored) {}
    }
  }
}


/**
 * Optional manual verification. Run this function from Apps Script to log
 * all mapped team IDs and confirm the mapping count is 75. Linus Torvalds floor is intentionally marked for confirmation.
 * It does not send emails or modify the spreadsheet.
 */
function verifyLakshyaVenueMapping() {
  const ids = Object.keys(LAKSHYA_VENUE_ALLOTMENT).sort();
  Logger.log("Mapped Team ID count: " + ids.length);

  ids.forEach(function(id) {
    const info = LAKSHYA_VENUE_ALLOTMENT[id];
    Logger.log(id + " | " + info.venue + " | " + info.floor);
  });

  if (ids.length !== 75) {
    throw new Error("Expected 75 mapped Team IDs, found " + ids.length);
  }

  Logger.log("Venue mapping verification passed.");
}


/**
 * BULK EMAIL DISPATCH HELPER
 * Pass an array of Team IDs (or call without arguments to process all marked present teams).
 * Example: sendBulkAttendanceEmails(['LAK-002', 'LAK-005', 'LAK-010'])
 */
function sendBulkAttendanceEmails(targetTeamIds) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const columns = getColumns_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const targetSet = targetTeamIds && targetTeamIds.length > 0
    ? new Set(targetTeamIds.map(function(id) { return String(id).trim().toUpperCase(); }))
    : null;

  let sentCount = 0;
  for (let r = 2; r <= lastRow; r++) {
    const teamId = String(sheet.getRange(r, columns.teamId).getDisplayValue() || "").trim().toUpperCase();
    if (!teamId) continue;

    if (targetSet && !targetSet.has(teamId)) continue;

    const emailStatus = String(sheet.getRange(r, columns.attendanceEmail).getDisplayValue() || "").trim().toUpperCase();
    if (emailStatus === "SENT") continue;

    processAttendanceEmail_(sheet, r);
    sentCount++;
  }

  Logger.log("Bulk attendance emails dispatched for " + sentCount + " teams.");
  return sentCount;
}
