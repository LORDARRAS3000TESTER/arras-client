// deob-core.js
console.log("👷 Worker loaded and waiting for buffer...");

self.onmessage = async (e) => {
  const { buffer } = e.data;
  console.log("👷 Worker received buffer:", e.data.buffer.byteLength, "bytes");

  try {
    // Call your existing deobfuscation logic
    const result = await runDeobfuscation(buffer);
    // Send the result to the main thread
    self.postMessage(result);

    console.log("✅ Worker: deobfuscation finished");
  } catch (err) {
    console.error("❌ Worker error:", err);
    self.postMessage({ error: err.message || String(err) });
  }
};

async function runDeobfuscation(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const alignedLength = Math.floor(arrayBuffer.byteLength / 4) * 4;
  const ints = new Int32Array(arrayBuffer, 0, alignedLength / 4);
  const utf8 = new TextDecoder("utf-8", { fatal: false });
  const utf16 = new TextDecoder("utf-16le", { fatal: false });
  
  const isPrintable = b => b >= 32 && b < 127;
  const isValidUtf8Byte = b => (b < 128) || (b >= 192 && b < 255);
  
  const printableRatio = s => {
    if(!s || s.length === 0) return 0;
    let p = 0;
    for(let i = 0; i < s.length; i++) {
      const cc = s.charCodeAt(i);
      if((cc >= 32 && cc < 127) || cc >= 128) p++;
    }
    return p / s.length;
  };
  
  // Entropy-based randomness detection (higher entropy = more random/gibberish)
  const calculateEntropy = s => {
    if(!s || s.length < 3) return 1.0;
    const freq = {};
    for(let i = 0; i < s.length; i++) {
      const c = s[i];
      freq[c] = (freq[c] || 0) + 1;
    }
    let entropy = 0;
    const len = s.length;
    for(const c in freq) {
      const p = freq[c] / len;
      entropy -= p * Math.log2(p);
    }
    // Normalize to 0-1 range (max entropy for string length)
    return entropy / Math.log2(Math.min(len, 256));
  };
  
  // Check if string looks like English/real text (not random garbage)
  const looksLikeText = s => {
    if(!s || s.length < 3) return false;
    
    // Check for control characters
    if(/[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f-\x9f]/.test(s)) return false;
    
    // Must have some ASCII letters or digits
    if(!/[A-Za-z0-9]/.test(s)) return false;
    
    // Count letter frequency (real text has more letters than random)
    const letterCount = (s.match(/[A-Za-z]/g) || []).length;
    const digitCount = (s.match(/[0-9]/g) || []).length;
    const totalAlphaNum = letterCount + digitCount;
    
    // Require meaningful amount of alphanumeric content
    if(totalAlphaNum < Math.max(2, s.length * 0.4)) return false;
    
    // Reject strings with too much entropy (likely random/garbage)
    const entropy = calculateEntropy(s);
    if(entropy > 5.5) return false; // Too random
    
    // Reject strings with too many special characters in a row
    if(/[^A-Za-z0-9]{3,}/.test(s)) return false;
    
    // Reject strings with unusual repeated non-letter characters
    if(/([^A-Za-z0-9])\1{4,}/.test(s)) return false;
    
    // Common pattern: lots of repeated single letters (gibberish indicator)
    let longestRun = 0;
    for(let i = 0; i < s.length; i++) {
      let run = 1;
      while(i + 1 < s.length && s[i] === s[i+1]) {
        run++;
        i++;
      }
      longestRun = Math.max(longestRun, run);
    }
    if(longestRun > 5 && letterCount < s.length * 0.3) return false;
    
    return true;
  };

  const keywords = [
    "ws://","wss://","http://","https://",".io",".com",".org",".net",
    "socket","player","token","auth","login","password","passwd","pwd",
    "session","cookie","jwt","bearer","api","endpoint","server","host",
    "port","match","room","lobby","rank","leaderboard","cheat","ban",
    "arr","arras","game","client","version","update","cdn","static",
    "upload","download","avatar","profile","username","user","mail",
    "email","steam","discord","oauth","gcp","aws","azure","s3","upload",
    "gzip","zlib","compress","tokenid","secret","key","pkix","cert",
    ".wasm",".map",".json",".txt",".png",".jpg",".jpeg",".webp",".io",
    "arrasio","arrasio","playwire","intergi","intergient","doubleclick",
    "playwire","video","ads","adblock","moatads","googletagmanager",
    "arrasiogame","arrasio-client","arrasio-game","arras-io-lobby",
    "arras-io-auth","arras-io-api","arras-io-static","arras-io-cdn",
    "arras-io-upload","arras-io-avatar","arras-io-profile","arras-io-mail",
    "arras-io-steam","arras-io-discord","arras-io-oauth","arras-io-gcp","arras-io-aws","arras-io-azure",
    "arras-io-s3","arras-io-wasm","arras-io-map","arras-io-json","arras-io-png","arras-io-jpg","arras-io-jpeg","arras-io-webp",
    "rtmp","rtc","webrtc","turn","stun","ice","grpc","tcp","udp",
    "socket.io","arrasio","webgl",
        // protocols / schemes
    "ws://","wss://","http://","https://","ftp://","ftps://","file://","data:",
    // top-level + common domain pieces
    ".com",".org",".net",".io",".co",".gov",".edu",".int",".mil",".xyz",".online",
    ".app", ".dev", ".site", ".tech", ".cloud", ".shop", ".store", ".gg",
    // common paths / resources
    "/api/","/v1/","/v2/","/v3/","/graphql","/auth/","/token/","/login","/logout",
    "/signup","/register","/user/","/users/","/upload","/download","/static/","/cdn/",
    // networking primitives
    "socket","socket.io","ws","wss","tcp","udp","http","https","grpc","rest","endpoint",
    "host","hostname","port","ip","ipv4","ipv6","domain","url","uri",
    // auth / session / credentials
    "token","tokens","secret","secrets","key","keys","apikey","api_key","apiKey","apikeys",
    "client_id","clientid","client_secret","clientsecret","auth","authentication",
    "authorization","bearer","jwt","session","cookie","sessionid","session_id",
    "refresh_token","refresh","access_token","access","passwd","password","pwd",
    "pass","credential","credentials","cred","credstore",
    // token prefixes / known formats
    "akid","ak=","AKIA","AIza","sk_live_","sk_test_","xoxb-","xoxp-","EAAB","EAA","BBP_",
    // cloud providers & services
    "aws","amazonaws","s3","s3.amazonaws.com","lambda","dynamodb","iam","sts",
    "azure","microsoft","blob.core.windows.net","cosmos","functions","appservice",
    "gcp","googleapis","storage.googleapis.com","bigquery","pubsub","firebase",
    "firebaseio","firebasestorage","heroku","vercel","netlify","digitalocean",
    "backblaze","oraclecloud","alibaba","aliyun",
    // CDNs / media / static
    "cdn","cdn.jsdelivr.net","cdnjs.cloudflare.com","imgur","cloudflare","akamai",
    "playwire","doubleclick","moatads","googletagmanager","youtube","vimeo",
    // file extensions / media types
    ".wasm",".wat",".map",".json",".txt",".html",".js",".mjs",".wasm.map",
    ".png",".jpg",".jpeg",".webp",".gif",".svg",".ico",".mp4",".webm",".mp3",
    ".zip",".tar",".gz",".gzip",".rar",".7z",".apk",".ipa",
    // common parameter / field names
    "username","user_name","user","userid","user_id","email","e-mail","mail",
    "profile","avatar","displayName","display_name","name","first_name","last_name",
    "role","roles","admin","administrator","moderator",
    // game / app specific
    "game","client","player","match","room","lobby","server","leaderboard",
    "rank","cheat","ban","cheats","anti_cheat","anticheat",
    // analytics / telemetry
    "analytics","telemetry","sentry","datadog","newrelic","segment","mixpanel",
    "google-analytics","ga","gtag","gtm","heap","amplitude","matomo","moat",
    // social / oauth
    "discord","steam","oauth","openid","facebook","fb","twitter","twitch","slack",
    "linkedin","github","gitlab","reddit","microsoft","appleid","apple",
    // payment / billing
    "stripe","stripeapi","sk_live","pk_live","pk_test","paypal","braintree",
    "card","credit_card","ccnum","cvv","iban","bank","account","billing","invoice",
    // databases / caches / message queues
    "mysql","postgres","postgresql","pg","mongodb","mongo","redis","memcached",
    "cassandra","cockroach","sqlite","leveldb","rabbitmq","kafka","nats",
    // common libraries / toolchains / languages
    "emscripten","wasm_bindgen","wasm_bindgen_macro","wasm2wat","wabt","binaryen",
    "rust","cargo","cargo.toml","cranelift","tinygo","go","golang","assemblyscript",
    "node","npm","yarn","pnpm","webpack","rollup","parcel","esbuild","babel",
    // wasm internals / module terms
    "memory","table","export","import","_start","malloc","free","__heap_base","__data_end",
    "name","name_section","sourceMappingURL",".debug","debug","section","code","data",
    // build / CI / config
    "env","ENV","NODE_ENV","production","development","staging","local","ci","GITHUB_ACTIONS",
    "gitlab-ci","circleci","travis","jenkins","docker","dockerhub","kubernetes","k8s",
    // certs / crypto / keys
    "pem","crt","cert","certificate","pfx","pkcs","pkcs12","x509","private_key","privateKey",
    "public_key","publicKey","rsa","dsa","ecdsa","ed25519","curve25519","ssh-rsa",
    "openssl","keypair","keystore","truststore","jks","p12","pfx","der","csr",
    // crypto algorithm names
    "aes","aes128","aes256","gcm","cbc","sha1","sha256","sha512","hmac","pbkdf2",
    "bcrypt","scrypt","argon2","hkdf","ed25519","rsa-pss","rsassa-pkcs1-v1_5",
    // encodings / formats
    "base64","base64url","base64url_decode","hex","hexadecimal","utf8","utf-8","utf16","utf-16",
    "bincode","msgpack","protobuf","proto","thrift","avro","cbor","json","yaml","yml","ini",
    // compression / archive
    "gzip","zlib","deflate","brotli","br","lz4","lzma","snappy",
    // debugging / logging
    "debug","logger","loglevel","console.log","console.error","trace","warn","stack","stacktrace",
    // common param names / headers
    "authorization","x-api-key","x-access-token","x-forwarded-for","user-agent","referer","referrer",
    "content-type","content-length","accept","set-cookie","cookie",
    // payment providers & services
    "stripe.com","paypal","checkout","square","adyen","klarna","braintree","mollie","authorize.net",
    // advertising / tracking
    "ads","advert","adserver","adblock","ad_unit","adsense","admanager","doubleclick","moat",
    // media platforms / cdn related
    "cloudfront","s3.amazonaws.com","azureedge","fastly","akamaized","netlify","vercel","gstatic",
    // file hosting / image hosts
    "imgix","imagekit","cloudinary","imageshack","dropbox","googleusercontent","drive.google.com",
    // mobile / app stores
    "package","bundle","apk","ipa","bundle_id","app_store","play.google.com",
    // developer keys / tokens patterns (prefixes)
    "AKIA","ASIA","AIza","sk_live_","sk_test_","pk_live_","pk_test_","RR_BEARER","xoxb-","xoxp-",
    "SG.","sendgrid","dapi","discordapp.com/api","slack.com/api","slack_token","bot_token",
    // misc services / SDKs
    "sentry.io","datadoghq.com","mixpanel.com","segment.com","intercom","heap","freshdesk","zendesk",
    // dns / networking terms
    "dns","srv","mx"," cname"," cname=","ns1","ns2","resolver","dig","whois",
    // config file names
    "package.json","package-lock.json","yarn.lock","pnpm-lock.yaml","Dockerfile",".env",".env.local",".env.production",
    // common abbreviations & short tokens
    "id","uid"
  ];

  const candidates = new Map();
  const minLen = 3, maxLen = 8192;

  // Scan for ASCII/UTF-8 runs (more lenient)
  let start = -1;
  for(let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    const isAscii = isPrintable(b);
    const isUtf8Valid = isValidUtf8Byte(b);
    if(isAscii || isUtf8Valid) {
      if(start === -1) start = i;
    } else {
      if(start !== -1) {
        const len = i - start;
        if(len >= minLen && len <= maxLen) candidates.set(`${start}_${len}`, {start, len});
        start = -1;
      }
    }
  }
  if(start !== -1) {
    const len = bytes.length - start;
    if(len >= minLen && len <= maxLen) candidates.set(`${start}_${len}`, {start, len});
  }

  // Pointer-length heuristic (scan more aggressively)
  const limit = Math.min(ints.length - 1, 500000);
  for(let i = 0; i < limit; i++) {
    const ptr = ints[i] >>> 0;
    const len = ints[i+1] >>> 0;
    if(ptr > 0 && len >= minLen && len <= maxLen && ptr + len <= bytes.length) {
      const key = `${ptr}_${len}`;
      if(!candidates.has(key)) candidates.set(key, {start: ptr, len});
    }
  }

  // Extended ptr-len heuristic: check for little-endian encoded lengths
  for(let i = 0; i < Math.min(bytes.length - 3, 300000); i++) {
    const b0 = bytes[i];
    const b1 = bytes[i+1];
    const b2 = bytes[i+2];
    const b3 = bytes[i+3];
    if((b0 > 0 && b0 < 0x80) && b1 === 0) {
      const len = b0 + (b1 << 8);
      if(len >= minLen && len <= maxLen && i + len + 2 <= bytes.length) {
        const key = `${i+2}_${len}`;
        if(!candidates.has(key)) candidates.set(key, {start: i+2, len});
      }
    }
  }

  const candidateList = Array.from(candidates.values()).slice(0, 8000);
  const rawHits = [];

  const tryUtf8 = buf => { try{ return utf8.decode(buf); } catch(e){ return null; } };
  const tryUtf16 = buf => { try{ return utf16.decode(buf); } catch(e){ return null; } };

  const transformFns = [];
  transformFns.push({name: 'raw', fn: tryUtf8});
  transformFns.push({name: 'utf16le', fn: tryUtf16});
  
  // Bitwise NOT
  transformFns.push({
    name: 'not',
    fn: buf => {
      const out = new Uint8Array(buf.length);
      for(let i = 0; i < buf.length; i++) out[i] = ~buf[i] & 0xFF;
      return tryUtf8(out);
    }
  });
  
  // Addition/subtraction obfuscation
  for(let k = -7; k <= 7; k++) {
    if(k !== 0) {
      transformFns.push({
        name: `add${k}`,
        fn: buf => {
          const out = new Uint8Array(buf.length);
          for(let i = 0; i < buf.length; i++) out[i] = (buf[i] + k) & 0xFF;
          return tryUtf8(out);
        }
      });
    }
  }
  
  // XOR obfuscation (extended key set)
  const xorKeys = [0x20, 0xFF, 0xAA, 0x55, 0x7F, 0x5A, 0xC3, 0x13, 0x37, 0x42, 0x00, 0x01, 0x7E, 0x80, 0xCC, 0x33, 0x3F, 0xF0, 0x0F];
  for(const k of xorKeys) {
    transformFns.push({
      name: `xor_${k.toString(16)}`,
      fn: buf => {
        const out = new Uint8Array(buf.length);
        for(let i = 0; i < buf.length; i++) out[i] = buf[i] ^ k;
        return tryUtf8(out);
      }
    });
  }
  
  // ROT (Caesar cipher)
  for(let r = 1; r <= 13; r++) {
    transformFns.push({
      name: `rot${r}`,
      fn: buf => {
        let s = '';
        for(let i = 0; i < buf.length; i++) {
          let c = buf[i];
          if(c >= 65 && c <= 90) c = ((c - 65 + r) % 26) + 65;
          else if(c >= 97 && c <= 122) c = ((c - 97 + r) % 26) + 97;
          s += String.fromCharCode(c);
        }
        return s;
      }
    });
  }
  
  // Base64 decode attempt
  transformFns.push({
    name: 'base64_try',
    fn: buf => {
      try {
        const s = tryUtf8(buf);
        if(!s) return null;
        const cleaned = s.replace(/\s+/g, '');
        if(cleaned.length < 8) return null;
        if(!/^[A-Za-z0-9+/=]+$/.test(cleaned)) return null;
        try { return atob(cleaned); } catch(e) { return null; }
      } catch(e) { return null; }
    }
  });

  const testBuffer = (start, len, buf, allowFullXor = false) => {
    for(const tr of transformFns) {
      try {
        const text = tr.fn(buf);
        if(text && looksLikeText(text)) {
          rawHits.push({start, len, transform: tr.name, text, score: calculateEntropy(text)});
        }
      } catch(e) {}
    }
  };

  const maxPerCandidateBytes = 4096, topFullXor = 50;
  for(let i = 0; i < candidateList.length; i++) {
    const cand = candidateList[i];
    const start = cand.start;
    const len = Math.min(cand.len, maxPerCandidateBytes);
    const buf = bytes.subarray(start, start + len);
    
    // First: try RAW (no transform) - most strings in WASM are plain UTF-8
    try {
      const rawText = tryUtf8(buf);
      if(rawText && looksLikeText(rawText)) {
        rawHits.push({start, len, transform: 'raw', text: rawText, score: calculateEntropy(rawText)});
      }
    } catch(e) {}
    
    // Only apply transforms if raw text wasn't good enough
    const raw = tryUtf8(buf);
    const rawEntropy = raw ? calculateEntropy(raw) : 999;
    const rawIsGood = raw && looksLikeText(raw) && rawEntropy < 4.0;
    
    if(!rawIsGood) {
      // String doesn't decode well - try transforms
      testBuffer(start, len, buf, i < topFullXor);
      
      // Test filtered runs (remove null bytes)
      if(buf.some(b => b === 0)) {
        const compact = new Uint8Array(Array.from(buf).filter(x => x !== 0));
        if(compact.length >= minLen) {
          try {
            const compactText = tryUtf8(compact);
            if(compactText && looksLikeText(compactText)) {
              rawHits.push({start, len: compact.length, transform: 'raw_no_nulls', text: compactText, score: calculateEntropy(compactText)});
            }
          } catch(e) {}
          testBuffer(start, compact.length, compact, false);
        }
      }
      
      // Sliding window for longer candidates
      for(let off = 0; off < buf.length; off += 64) {
        const wlen = Math.min(512, buf.length - off);
        if(wlen >= minLen) {
          try {
            const windowText = tryUtf8(buf.subarray(off, off + wlen));
            if(windowText && looksLikeText(windowText) && calculateEntropy(windowText) < 4.0) {
              rawHits.push({start: start + off, len: wlen, transform: 'raw', text: windowText, score: calculateEntropy(windowText)});
            }
          } catch(e) {}
        }
      }
    }
  }

  // Quality filtering and deduplication
  const byText = new Map();
  for(const hit of rawHits) {
    const key = hit.text;
    const existing = byText.get(key);
    // Keep the one with LOWEST entropy (most text-like, least random)
    if(!existing || existing.score > hit.score) {
      byText.set(key, hit);
    }
  }
  
  const final = Array.from(byText.values())
    .filter(h => {
      // Remove obvious garbage: too many repeated chars
      if(/(.)\1{5,}/.test(h.text)) return false;
      // Remove if mostly whitespace
      if(h.text.trim().length < 3) return false;
      // Penalize very common single letters
      if(/^[a-z]$/.test(h.text.trim())) return false;
      // Remove strings that are almost entirely special characters
      const alphaNum = (h.text.match(/[A-Za-z0-9]/g) || []).length;
      if(alphaNum < h.text.length * 0.3) return false;
      return true;
    })
    .sort((a, b) => a.score - b.score); // Sort by entropy: lowest (most text-like) first

  // Simplified final processing (skip per-keyword tracking for speed)
  const seen = new Set();
  const allStrings = [];
  
  // Only keep strings with good quality (low entropy = more text-like)
  for(const hit of final) {
    if(!seen.has(hit.text) && hit.score < 5.0) { // entropy threshold for "good" text
      seen.add(hit.text);
      allStrings.push(hit.text);
    }
  }

  const MIN_INTERESTING_LEN = 3;
  const likelyImportant = allStrings.filter(s => s.length >= MIN_INTERESTING_LEN && /[A-Za-z0-9]{3,}/.test(s));

  try {
    console.log(
      "🔎 WASM deob finished.",
      "Unique hits:", final.length,
      "All strings:", allStrings.length,
      "Important:", likelyImportant.length,
      `(${((likelyImportant.length / allStrings.length * 100) || 0).toFixed(1)}%)`
    );
  } catch(e) {}

  return {
    candidates: candidateList.slice(0, 100),
    rawCount: rawHits.length,
    uniqueCount: final.length,
    final: final.slice(0, 500),
    allStrings,
    likelyImportant
  };
}