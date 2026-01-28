/**
 * STABLE OPCODE MAN - Packet Analysis & Protocol Debugging Utility
 * 
 * Use this to understand and analyze packet flows between your 2020 arras template
 * and the new official arras.io WASM client.
 * 
 * Usage:
 *   node -e "require('./lib/stable-opcode-man').analyzePacket(buffer)"
 */

'use strict';

/**
 * Detect packet format by analyzing the first few bytes
 * @param {Uint8Array|Buffer} bytes - Raw packet bytes
 * @returns {string} - Format identifier: "fasttalk2.0", "wasmclient", or "unknown"
 */
function detectFormat(bytes) {
  if (!bytes || bytes.length < 1) return "empty";
  
  const b0 = bytes[0];
  const b1 = bytes.length > 1 ? bytes[1] : 0;
  
  // Fasttalk 2.0: starts with 0xF in upper 4 bits or exactly 0xF
  if (b0 === 0xF || (b0 >> 4) === 0xF) {
    return "fasttalk2.0";
  }
  
  // WASM client: starts with 0x00 0x01 header
  if (b0 === 0x00 && b1 === 0x01) {
    return "wasmclient";
  }
  
  return "unknown";
}

/**
 * Extract fasttalk 2.0 header codes
 * @param {Uint8Array|Buffer} bytes
 * @returns {Array} - Array of header nibbles
 */
function extractFasttalkHeaders(bytes) {
  const headers = [];
  let foundEnd = false;
  
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    
    // Extract high and low nibbles
    const high = (byte >> 4) & 0xF;
    const low = byte & 0xF;
    
    headers.push(high);
    if (high === 0xF) foundEnd = true;
    
    headers.push(low);
    if (low === 0xF && foundEnd) break;
  }
  
  return headers;
}

/**
 * Map fasttalk 2.0 header codes to human-readable names
 */
const FASTTALK_CODES = {
  0x0: "false/0",
  0x1: "true/1",
  0x2: "u8",
  0x3: "i8",
  0x4: "u16",
  0x5: "i16",
  0x6: "u32",
  0x7: "i32",
  0x8: "float32",
  0x9: "str_short",
  0xA: "str_u8len",
  0xB: "str_u16len",
  0xC: "repeat_2x",
  0xD: "repeat_3x",
  0xE: "repeat_4+n",
  0xF: "end_header/marker"
};

/**
 * Analyze and pretty-print a packet
 * @param {ArrayBuffer|Uint8Array|Buffer} data
 * @param {string} direction - "SEND" or "RECV"
 * @param {string} command - Optional command name (e.g., "spawn", "ping")
 */
function analyzePacket(data, direction = "RECV", command = "") {
  let bytes;
  
  if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else if (Buffer.isBuffer(data)) {
    bytes = new Uint8Array(data);
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else {
    console.error("Invalid data type");
    return;
  }
  
  const format = detectFormat(bytes);
  const len = bytes.length;
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[${direction}] Packet Analysis${command ? ` - ${command}` : ''}`);
  console.log(`${'='.repeat(70)}`);
  
  console.log(`Format: ${format}`);
  console.log(`Length: ${len} bytes`);
  console.log(`\nHex dump (all bytes):`);
  console.log(hexDump(bytes));
  
  if (format === "fasttalk2.0") {
    console.log(`\nFasttalk 2.0 Structure:`);
    analyzeFasttalk(bytes);
  } else if (format === "wasmclient") {
    console.log(`\nWASM Client Structure:`);
    analyzeWasm(bytes);
  }
  
  // Common patterns
  console.log(`\nCommon values:`);
  console.log(`  First 3 bytes: ${Array.from(bytes.slice(0, 3)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(" ")}`);
  console.log(`  Length: ${len}`);
  
  console.log(`${'='.repeat(70)}\n`);
}

/**
 * Analyze fasttalk 2.0 packet structure
 */
function analyzeFasttalk(bytes) {
  const headers = extractFasttalkHeaders(bytes);
  
  console.log(`  Header codes: ${headers.map(h => FASTTALK_CODES[h] || `?${h}`).join(" → ")}`);
  
  // Find where headers end (at second 0xF)
  let headerEndIndex = -1;
  let count0xF = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0xFF || (i % 2 === 0 && (bytes[i] >> 4) === 0xF)) {
      count0xF++;
      if (count0xF >= 2) {
        headerEndIndex = i;
        break;
      }
    }
  }
  
  if (headerEndIndex >= 0) {
    console.log(`  Header section: bytes 0-${headerEndIndex}`);
    console.log(`  Data section starts at byte ${headerEndIndex + 1}`);
  }
}

/**
 * Analyze WASM client packet structure
 */
function analyzeWasm(bytes) {
  if (bytes.length < 4) {
    console.log(`  ⚠ Packet too short for WASM analysis`);
    return;
  }
  
  console.log(`  Version header: 0x${bytes[0].toString(16)} 0x${bytes[1].toString(16)}`);
  
  if (bytes.length >= 4) {
    const msgType = bytes[2];
    const cmd = bytes[3];
    console.log(`  Message type: 0x${msgType.toString(16).padStart(2, '0')}`);
    console.log(`  Command: 0x${cmd.toString(16).padStart(2, '0')} (${String.fromCharCode(cmd)})`);
  }
  
  if (bytes.length > 4) {
    console.log(`  Data: ${bytes.length - 4} bytes`);
    console.log(`  Data preview: ${Array.from(bytes.slice(4, Math.min(20, bytes.length)))
      .map(b => `0x${b.toString(16).padStart(2, '0')}`).join(" ")}`);
  }
}

/**
 * Pretty-print hex dump
 */
function hexDump(bytes, width = 16) {
  let output = "";
  for (let i = 0; i < bytes.length; i += width) {
    const chunk = bytes.slice(i, Math.min(i + width, bytes.length));
    const hex = Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(" ");
    const ascii = Array.from(chunk)
      .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : ".")
      .join("");
    output += `  ${i.toString(16).padStart(4, '0')}: ${hex.padEnd(width * 3 - 1)} │ ${ascii}\n`;
  }
  return output;
}

/**
 * Compare two packets to find differences
 */
function comparePackets(bytes1, bytes2, label1 = "Packet1", label2 = "Packet2") {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Comparing: ${label1} vs ${label2}`);
  console.log(`${'='.repeat(70)}`);
  
  const maxLen = Math.max(bytes1.length, bytes2.length);
  const diffs = [];
  
  for (let i = 0; i < maxLen; i++) {
    const b1 = i < bytes1.length ? bytes1[i] : undefined;
    const b2 = i < bytes2.length ? bytes2[i] : undefined;
    
    if (b1 !== b2) {
      diffs.push({
        offset: i,
        byte1: b1,
        byte2: b2
      });
    }
  }
  
  if (diffs.length === 0) {
    console.log("✓ Packets are identical");
  } else {
    console.log(`Found ${diffs.length} differences:\n`);
    diffs.slice(0, 20).forEach(diff => {
      const b1Str = diff.byte1 !== undefined ? `0x${diff.byte1.toString(16).padStart(2, '0')}` : "∅";
      const b2Str = diff.byte2 !== undefined ? `0x${diff.byte2.toString(16).padStart(2, '0')}` : "∅";
      console.log(`  [${diff.offset}]: ${label1}=${b1Str}, ${label2}=${b2Str}`);
    });
    
    if (diffs.length > 20) {
      console.log(`  ... and ${diffs.length - 20} more differences`);
    }
  }
  
  console.log(`${'='.repeat(70)}\n`);
}

/**
 * Known command codes for arras protocol
 */
const COMMAND_CODES = {
  // Client → Server
  k: "Key verification",
  s: "Spawn request",
  S: "Clock sync",
  p: "Ping",
  d: "Downlink (movement input)",
  C: "Command",
  t: "Toggle setting",
  U: "Upgrade request",
  x: "Skill upgrade",
  w: "Websocket ready",
  
  // Server → Client
  F: "Frame update (entity state)",
  u: "Upgrade complete",
  K: "Kill message",
  M: "Chat message",
  T: "Leaderboard",
  R: "Room info",
  P: "Ping response",
  D: "Downlink ack",
  L: "Lag indicator"
};

/**
 * Get human-readable name for command
 */
function getCommandName(char) {
  return COMMAND_CODES[char] || `Unknown (${char})`;
}

module.exports = {
  detectFormat,
  extractFasttalkHeaders,
  analyzePacket,
  analyzeWasm,
  analyzeFasttalk,
  comparePackets,
  getCommandName,
  FASTTALK_CODES,
  COMMAND_CODES,
  hexDump
};
