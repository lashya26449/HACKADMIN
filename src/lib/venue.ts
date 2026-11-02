/**
 * LAKSHYA 2026 — Venue Allocation and Dispatch Helpers
 *
 * Implements the verified venue allocation mapping matching VenueAllocation.gs.
 * Mapped to 75 Team IDs across Ground, First, Second, Third, and Fourth Floors.
 */

export interface VenueInfo {
  venue: string;
  floor: string;
}

export const LAKSHYA_VENUE_ALLOTMENT: Readonly<Record<string, VenueInfo>> = Object.freeze({
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
  "LAK-044": { venue: "ST LAB", floor: "Ground Floor" },
  "LAK-062": { venue: "ST LAB", floor: "Ground Floor" },

  // First floor
  "LAK-031": { venue: "VTU RESEARCH", floor: "First Floor" },
  "LAK-047": { venue: "VTU RESEARCH", floor: "First Floor" },
  "LAK-048": { venue: "VTU RESEARCH", floor: "First Floor" },
  "LAK-049": { venue: "VTU RESEARCH", floor: "First Floor" },
  "LAK-064": { venue: "VTU RESEARCH", floor: "First Floor" },
  "LAK-066": { venue: "VTU RESEARCH", floor: "First Floor" },
  "LAK-070": { venue: "VTU RESEARCH", floor: "First Floor" },
  "LAK-071": { venue: "VTU RESEARCH", floor: "First Floor" },

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

  // Fourth floor — temporary label; update venue name when confirmed.
  "LAK-073": { venue: "ALLOTMENT PENDING", floor: "Fourth Floor" },
  "LAK-074": { venue: "ALLOTMENT PENDING", floor: "Fourth Floor" },
  "LAK-075": { venue: "ALLOTMENT PENDING", floor: "Fourth Floor" },
  "LAK-076": { venue: "ALLOTMENT PENDING", floor: "Fourth Floor" }
});

/**
 * Returns the confirmed venue record for a listed team ID.
 * Unknown IDs intentionally return null; no venue is guessed.
 */
export function getLakshyaVenue(teamId: string | null | undefined): VenueInfo | null {
  if (!teamId) return null;
  const id = String(teamId).trim().toUpperCase();
  return LAKSHYA_VENUE_ALLOTMENT[id] || null;
}

/**
 * Builds the attendance WhatsApp text for the team lead.
 * Matches exact structure defined in VenueAllocation.gs.
 */
export function buildAttendanceWhatsAppMessage(
  teamName: string,
  teamId: string,
  venueInfo?: VenueInfo | null
): string {
  const v = venueInfo !== undefined ? venueInfo : getLakshyaVenue(teamId);
  const venue = v ? v.venue : "ALLOTMENT PENDING";
  const floor = v ? v.floor : "Contact Organizers Desk";
  const name = teamName?.trim() || "Participant";
  const id = teamId?.trim() || "Unassigned";

  return (
    `Hello ${name} Team!\n\n` +
    `Your attendance for LAKSHYA 2026 has been confirmed.\n\n` +
    `TEAM DETAILS\n` +
    `Team Name: ${name}\n` +
    `Team ID: ${id}\n\n` +
    `VENUE ALLOCATION\n` +
    `Venue: ${venue}\n` +
    `Floor: ${floor}\n\n` +
    `Regards,\n` +
    `LAKSHYA 2026 Organizing Team\n` +
    `SJBIT, Bengaluru`
  );
}
