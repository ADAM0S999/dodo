'use strict';

/**
 * ADAM Bot — lib/db/session.js
 * Session ID generation utilities.
 */

// Generate session ID with optional custom name
// Normal mode: lm7bos_adjacency123
// Named mode: lm7bos_adam
function generateSessionId(customName = null) {
  const prefix = 'lm7bos';
  if (customName && typeof customName === 'string' && customName.trim().length > 0) {
    const cleanName = customName.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    return `${prefix}_${cleanName}`;
  }
  // Normal random generation
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart = '';
  for (let i = 0; i < 12; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}_adjacency${randomPart}`;
}

// Generate fallback pairing code for testing
function generateFallbackCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let part1 = '', part2 = '';
  for (let i = 0; i < 4; i++) part1 += chars.charAt(Math.floor(Math.random() * chars.length));
  for (let i = 0; i < 4; i++) part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  return `${part1}-${part2}`;
}

// Clean phone number (remove non-digits)
function cleanPhone(number) {
  return String(number).replace(/[^0-9]/g, '');
}

// Validate phone number format
function isValidPhone(number) {
  const cleaned = cleanPhone(number);
  return cleaned.length >= 9 && cleaned.length <= 15;
}

module.exports = {
  generateSessionId,
  generateFallbackCode,
  cleanPhone,
  isValidPhone
};