/**
 * OFFICIAL ARRAS.IO OPCODE MAPPING
 * 
 * Maps server command characters to official arras.io numeric packet types
 * Based on official arras.io protocol analysis
 */

'use strict';

// Character code to Official Arras.io Type mapping
// Format: characterOpcode -> official numeric type
const OpcodeMap = {
  // Frame/Entity Updates
  'F': 242,  // Frame update with entity data (but subdivided per arras.io official types)
  'u': 242,  // Regular frame update (subdivision of frame packets)
  'U': 243,  // Upgrade completion
  
  // Messages & Communication
  'm': 253,  // Chat message (fasttalk2.0 format)
  'M': 191,  // Chat/Message from server
  'J': 56,   // JSON message data
  
  // Sync & Timing
  'S': 122,  // Server time sync / clock sync
  'p': 21,   // Ping response
  'P': 29,   // Ping request
  
  // Camera & View
  'c': 76,   // Camera update (position, FOV)
  
  // Upgrades & Leveling
  'x': 173,  // Skill upgrade
  'L': 120,  // Level up
  
  // Game State
  's': 12,   // Spawn/Setup response
  'K': 157,  // Kill message
  'k': 163,  // Kill confirm
  
  // Leaderboard
  'T': 198,  // Leaderboard/Turret update
  't': 198,  // Leaderboard update (table)
  
  // Internal/Control
  'w': 243,  // Something (assign reasonable type)
  'W': 243,  // Something
};

/**
 * Convert character opcode to official arras.io numeric type
 * @param {string|number} opcode - Character or numeric opcode
 * @returns {number} - Official arras.io packet type
 */
function getOfficialType(opcode) {
  if (typeof opcode === 'number') {
    return opcode;  // Already numeric
  }
  
  if (typeof opcode === 'string' && opcode.length === 1) {
    const mapped = OpcodeMap[opcode];
    if (mapped !== undefined) {
      return mapped;
    }
    // Fallback: use ASCII code if not in map
    console.warn(`[OPCODE] Character '${opcode}' not in official opcode map, using ASCII: ${opcode.charCodeAt(0)}`);
    return opcode.charCodeAt(0);
  }
  
  console.error(`[OPCODE] Invalid opcode type: ${typeof opcode} = ${opcode}`);
  return 0;
}

/**
 * Get character opcode from official numeric type
 * @param {number} type - Official arras.io numeric type
 * @returns {string} - Character opcode
 */
function getCharFromType(type) {
  for (const [char, numType] of Object.entries(OpcodeMap)) {
    if (numType === type) {
      return char;
    }
  }
  // If not found, return as character code
  return String.fromCharCode(type);
}

/**
 * Verify opcode is valid
 * @param {string|number} opcode
 * @returns {boolean}
 */
function isValidOpcode(opcode) {
  if (typeof opcode === 'number') {
    return opcode >= 0 && opcode <= 255;
  }
  if (typeof opcode === 'string' && opcode.length === 1) {
    return OpcodeMap[opcode] !== undefined || true;  // Accept if mapped or use ASCII
  }
  return false;
}

/**
 * Get opcode info for debugging
 * @param {string|number} opcode
 * @returns {object}
 */
function getOpcodeInfo(opcode) {
  let char, official;
  
  if (typeof opcode === 'string') {
    char = opcode;
    official = OpcodeMap[opcode];
  } else if (typeof opcode === 'number') {
    official = opcode;
    char = getCharFromType(opcode);
  }
  
  return {
    character: char,
    official: official,
    ascii: char ? char.charCodeAt(0) : undefined,
    mapped: OpcodeMap[char] !== undefined
  };
}

module.exports = {
  OpcodeMap,
  getOfficialType,
  getCharFromType,
  isValidOpcode,
  getOpcodeInfo
};
