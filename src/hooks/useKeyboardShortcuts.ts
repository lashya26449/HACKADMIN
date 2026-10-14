'use client';
import { useEffect, useRef, useCallback } from 'react';

export type ShortcutCategory = 'navigation' | 'attendance' | 'help' | 'general';

export interface ShortcutDefinition {
  id: string;
  key: string; // Lowercase key, or special keys like 'arrowup', 'arrowdown', 'enter', 'escape', '?'
  ctrlOrCmd?: boolean;
  alt?: boolean;
  shift?: boolean;
  description: string;
  category: ShortcutCategory;
  scope?: string;
  allowInInput?: boolean;
  disabled?: boolean;
  handler: (e: KeyboardEvent) => void;
}

export function isMacPlatform(): boolean {
  if (typeof window === 'undefined') return false;
  // Modern userAgentData check or platform fallback
  const nav = window.navigator as { userAgentData?: { platform?: string }; platform?: string };
  if (nav.userAgentData?.platform) {
    return /mac/i.test(nav.userAgentData.platform);
  }
  return /mac/i.test(nav.platform || '');
}

export function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input') {
    const inputType = (target as HTMLInputElement).type.toLowerCase();
    // Non-text input types like button, checkbox, radio are not text editing
    if (['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color'].includes(inputType)) {
      return false;
    }
    return true;
  }
  if (tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') return true;
  return false;
}

/**
 * Normalizes keyboard event key for matching
 */
export function normalizeKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower === 'esc') return 'escape';
  if (lower === 'up') return 'arrowup';
  if (lower === 'down') return 'arrowdown';
  return lower;
}

/**
 * Checks whether an event matches a shortcut definition
 */
export function matchesShortcut(
  e: KeyboardEvent,
  shortcut: ShortcutDefinition,
  isMac: boolean
): boolean {
  if (shortcut.disabled) return false;

  // Ignore during active IME composition
  if (e.isComposing || e.keyCode === 229) return false;

  const targetKey = normalizeKey(shortcut.key);
  const eventKey = normalizeKey(e.key);

  // Check key match
  // Special case for '?' which may be Shift + '/'
  if (targetKey === '?') {
    if (e.key !== '?' && !(e.key === '/' && e.shiftKey)) return false;
  } else if (eventKey !== targetKey) {
    return false;
  }

  // Check Ctrl / Cmd modifier
  if (shortcut.ctrlOrCmd) {
    const hasModifier = isMac ? e.metaKey : e.ctrlKey;
    if (!hasModifier) return false;
  } else {
    // If not required, ensure Ctrl / Meta aren't pressed (except for Alt shortcuts where AltGraph might set ctrlKey on some Windows layouts)
    if (e.metaKey) return false;
    if (!shortcut.alt && e.ctrlKey) return false;
  }

  // Check Alt modifier
  if (shortcut.alt) {
    if (!e.altKey) return false;
  } else {
    if (e.altKey) return false;
  }

  // Check Shift modifier
  if (shortcut.shift !== undefined) {
    if (shortcut.shift !== e.shiftKey) return false;
  }

  return true;
}

/**
 * Custom hook to register shortcuts at component level
 */
export function useKeyboardShortcuts(shortcuts: ShortcutDefinition[], active = true) {
  const shortcutsRef = useRef<ShortcutDefinition[]>(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!active) return;
    const isMac = isMacPlatform();
    const inEditable = isEditableElement(e.target);

    for (const shortcut of shortcutsRef.current) {
      if (matchesShortcut(e, shortcut, isMac)) {
        // If user is inside an editable input and the shortcut doesn't allow in-input handling, skip
        if (inEditable && !shortcut.allowInInput) {
          continue;
        }

        // Prevent browser default only if we actually handled it
        e.preventDefault();
        shortcut.handler(e);
        return;
      }
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, active]);
}
