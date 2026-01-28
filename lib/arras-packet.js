/**
 * OFFICIAL ARRAS.IO BINARY PACKET ENCODER
 * 
 * Creates binary packets matching official arras.io server format
 * instead of fasttalk encoding for better WASM client compatibility
 */

'use strict';

/**
 * Create a binary packet in official arras.io format
 * Based on observed packet structure from official servers
 */
class ArrasPacket {
  constructor(type = 0) {
    this.type = type;
    this.data = [];
  }

  /**
   * Write unsigned 8-bit integer
   */
  writeU8(value) {
    this.data.push(value & 0xFF);
    return this;
  }

  /**
   * Write signed 8-bit integer
   */
  writeI8(value) {
    this.data.push(value & 0xFF);
    return this;
  }

  /**
   * Write unsigned 16-bit integer (little endian)
   */
  writeU16(value) {
    this.data.push(value & 0xFF);
    this.data.push((value >> 8) & 0xFF);
    return this;
  }

  /**
   * Write signed 16-bit integer (little endian)
   */
  writeI16(value) {
    this.data.push(value & 0xFF);
    this.data.push((value >> 8) & 0xFF);
    return this;
  }

  /**
   * Write unsigned 32-bit integer (little endian)
   */
  writeU32(value) {
    this.data.push(value & 0xFF);
    this.data.push((value >> 8) & 0xFF);
    this.data.push((value >> 16) & 0xFF);
    this.data.push((value >> 24) & 0xFF);
    return this;
  }

  /**
   * Write signed 32-bit integer (little endian)
   */
  writeI32(value) {
    return this.writeU32(value);
  }

  /**
   * Write 32-bit float (little endian)
   */
  writeFloat32(value) {
    const buf = new ArrayBuffer(4);
    const view = new Float32Array(buf);
    view[0] = value;
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < 4; i++) {
      this.data.push(bytes[i]);
    }
    return this;
  }

  /**
   * Write string (null-terminated)
   */
  writeString(str) {
    const len = Math.min(str.length, 255);
    this.writeU8(len);
    for (let i = 0; i < len; i++) {
      this.data.push(str.charCodeAt(i) & 0xFF);
    }
    return this;
  }

  /**
   * Write raw bytes
   */
  writeBytes(bytes) {
    if (bytes instanceof Uint8Array) {
      for (let i = 0; i < bytes.length; i++) {
        this.data.push(bytes[i]);
      }
    } else if (Array.isArray(bytes)) {
      for (let i = 0; i < bytes.length; i++) {
        this.data.push(bytes[i] & 0xFF);
      }
    }
    return this;
  }

  /**
   * Finalize and return as Uint8Array
   * Format: [type] + [data]
   */
  build() {
    const result = new Uint8Array(this.data.length + 1);
    result[0] = this.type & 0xFF;
    for (let i = 0; i < this.data.length; i++) {
      result[i + 1] = this.data[i];
    }
    return result;
  }

  /**
   * Get packet size
   */
  size() {
    return this.data.length + 1;
  }

  /**
   * Clone this packet
   */
  clone() {
    const p = new ArrasPacket(this.type);
    p.data = [...this.data];
    return p;
  }
}

/**
 * Generate random byte (for simulating official server packets)
 */
function randomByte() {
  return Math.floor(Math.random() * 256);
}

/**
 * Create a frame update packet (Type 242)
 * Encodes actual frame data in official arras.io binary format
 */
function createFramePacket(timestamp, cameraX, cameraY, fov, cameraVX, cameraVY, guiData, entityCount, entities) {
  const pkt = new ArrasPacket(242);

  // Write timestamp
  pkt.writeU32(timestamp || 0);

  // Write camera data
  pkt.writeFloat32(cameraX || 0);
  pkt.writeFloat32(cameraY || 0);
  pkt.writeFloat32(fov || 2000);
  pkt.writeFloat32(cameraVX || 0);
  pkt.writeFloat32(cameraVY || 0);

  // Write GUI data (array of values)
  if (guiData && Array.isArray(guiData)) {
    pkt.writeU16(guiData.length);
    for (const value of guiData) {
      pkt.writeFloat32(value || 0);
    }
  } else {
    pkt.writeU16(0);
  }

  // Write entity count
  pkt.writeU16(entityCount || 0);

  // Write entity data (flattened array)
  if (entities && Array.isArray(entities)) {
    for (const value of entities) {
      if (typeof value === 'number') {
        pkt.writeFloat32(value);
      } else {
        pkt.writeFloat32(0); // fallback
      }
    }
  }

  return pkt;
}

/**
 * Create a spawn response packet (Type 56 - "Room Setup")
 */
function createSpawnPacket(roomWidth, roomHeight, gameMode) {
  const pkt = new ArrasPacket(56);
  
  pkt.writeU16(roomWidth);
  pkt.writeU16(roomHeight);
  pkt.writeU8(gameMode || 0);
  
  // Add some randomness to match official packets
  for (let i = 0; i < 4; i++) {
    pkt.writeU8(randomByte());
  }
  
  return pkt;
}

/**
 * Create a mockup data packet (Type 56)
 * Sends raw JSON bytes without length prefix for compatibility
 */
function createMockupPacket(mockupData) {
  const pkt = new ArrasPacket(56);
  const jsonString = JSON.stringify(mockupData);
  // Write raw JSON bytes directly (no length prefix)
  for (let i = 0; i < jsonString.length; i++) {
    pkt.writeU8(jsonString.charCodeAt(i));
  }
  return pkt;
}

/**
 * Create a ping response packet (Type 21)
 */
function createPingPacket(timestamp) {
  const pkt = new ArrasPacket(21);
  pkt.writeU32(timestamp || Math.floor(Date.now() / 1000));
  return pkt;
}

/**
 * Create a message packet (Type 253)
 */
function createMessagePacket(message) {
  const pkt = new ArrasPacket(253);
  pkt.writeString(message || "");
  return pkt;
}

/**
 * Create a kill/death notification packet (Type 157)
 */
function createKillPacket(score, timePlayed, soloKills, assistKills, bossKills, killerCount) {
  const pkt = new ArrasPacket(157);
  pkt.writeU32(score || 0);
  pkt.writeU32(timePlayed || 0);
  pkt.writeU16(soloKills || 0);
  pkt.writeU16(assistKills || 0);
  pkt.writeU16(bossKills || 0);
  pkt.writeU16(killerCount || 0);
  return pkt;
}

/**
 * Create a camera update packet (Type 76)
 */
function createCameraPacket(x, y, fov) {
  const pkt = new ArrasPacket(76);
  pkt.writeFloat32(x || 0);
  pkt.writeFloat32(y || 0);
  pkt.writeFloat32(fov || 2000);
  return pkt;
}

/**
 * Create an upgrade packet (Type 243)
 */
function createUpgradePacket(upgradeId) {
  const pkt = new ArrasPacket(243);
  pkt.writeU8(upgradeId || 0);
  
  // Add random data
  for (let i = 0; i < 2; i++) {
    pkt.writeU8(randomByte());
  }
  
  return pkt;
}

/**
 * Create a leaderboard packet (Type 198)
 */
function createLeaderboardPacket() {
  const pkt = new ArrasPacket(198);
  
  // Simulate leaderboard data
  for (let i = 0; i < 16; i++) {
    pkt.writeU8(randomByte());
  }
  
  return pkt;
}

/**
 * Official packet types used by arras.io servers
 */
const OfficialPacketTypes = {
  ROOM_SETUP: 56,      // Initial room/spawn info
  CLOCK_SYNC: 122,     // Server time sync
  PING_RESPONSE: 21,   // Ping/pong
  KILL_MESSAGE: 157,   // Kill notification
  LEADERBOARD: 198,    // Leaderboard update
  UPGRADE_COMPLETE: 243, // Upgrade done
  MESSAGE: 253,        // Chat message
  FRAME_UPDATE: 242,   // Frame/entity update
};

module.exports = {
  ArrasPacket,
  createFramePacket,
  createSpawnPacket,
  createMockupPacket,
  createPingPacket,
  createMessagePacket,
  createKillPacket,
  createCameraPacket,
  createUpgradePacket,
  createLeaderboardPacket,
  OfficialPacketTypes,
  randomByte
};
