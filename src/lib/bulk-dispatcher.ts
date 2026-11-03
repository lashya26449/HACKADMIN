import type { Team } from '@/types';
import { getLakshyaVenue } from './venue';

/**
 * Parses user input containing single team IDs, comma/newline separated lists,
 * or numeric ranges like "2-10", "002-008", "LAK-002 to LAK-015", "022..028".
 */
export function parseTeamIdInput(input: string): string[] {
  if (!input || !input.trim()) return [];

  const rawTokens = input
    .split(/[\n,;]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const resultIds = new Set<string>();

  for (const token of rawTokens) {
    // 1. Check range syntax: "LAK-002 - LAK-010", "2-10", "002 to 010", "2..10"
    const rangeMatch = token.match(/^(?:LAK-)?0*(\d+)\s*(?:-|to|\.\.)\s*(?:LAK-)?0*(\d+)$/i);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      const min = Math.min(start, end);
      const max = Math.max(start, end);

      for (let n = min; n <= max; n++) {
        if (n === 1) continue; // 001 is invalid
        resultIds.add(`LAK-${String(n).padStart(3, '0')}`);
      }
      continue;
    }

    // 2. Check pure numeric single token: "2", "002", "15"
    const numMatch = token.match(/^0*(\d+)$/);
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      if (n === 1) continue;
      resultIds.add(`LAK-${String(n).padStart(3, '0')}`);
      continue;
    }

    // 3. Check "LAK-XXX" token
    const upper = token.toUpperCase();
    if (upper.startsWith('LAK-')) {
      const numPart = upper.replace('LAK-', '').trim();
      const n = parseInt(numPart, 10);
      if (!isNaN(n)) {
        if (n === 1) continue;
        resultIds.add(`LAK-${String(n).padStart(3, '0')}`);
      } else {
        resultIds.add(upper);
      }
      continue;
    }
  }

  return Array.from(resultIds).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
}

/**
 * Matches parsed Team IDs with actual loaded teams and includes venue info.
 */
export function resolveTeamsForDispatch(parsedIds: string[], allTeams: Team[]): Team[] {
  const teamMap = new Map<string, Team>();
  for (const t of allTeams) {
    teamMap.set(t.teamId.toUpperCase().trim(), t);
  }

  const result: Team[] = [];
  for (const id of parsedIds) {
    const matched = teamMap.get(id);
    if (matched) {
      result.push(matched);
    } else {
      // Synthesize placeholder record if team hasn't synced into memory yet
      result.push({
        teamId: id,
        teamName: `Team ${id}`,
        college: 'Unlisted',
        isPresent: false,
      });
    }
  }

  return result;
}
