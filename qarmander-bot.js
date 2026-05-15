const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');

const https = require('https');

// ── Keep-alive server + self-pinger (keeps Replit awake) ─────────────────────
const keepAliveServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Qarmander is alive!');
});
keepAliveServer.listen(5000, '0.0.0.0', () => console.log('🌐 Keep-alive server on :5000'));

// Self-ping every 60s so Replit never sleeps
let _pingCount = 0;
function _selfPing() {
    _pingCount++;
    const req = http.get('http://127.0.0.1:5000/', (res) => {
        console.log(`[keep-alive] ✅ ping #${_pingCount} → ${res.statusCode}`);
        res.resume();
    });
    req.on('error', err => console.log(`[keep-alive] ❌ ping #${_pingCount} failed: ${err.message}`));
    req.end();
}
// First ping after 5s (give server time to bind), then every 60s
setTimeout(() => { _selfPing(); setInterval(_selfPing, 60_000); }, 5000);

const STATS_FILE = './bot-stats.json';
function loadStats() { try { return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')); } catch { return { startCount: 0 }; } }
function saveStats(stats) { fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2)); }
const botStats = loadStats();
const startTime = Date.now();
const ALLOWED_GUILDS = ['1493304887252091061', '1502798100673335507'];

// ========== ALL CIPHER FUNCTIONS ==========
function rot13(t) { return t.replace(/[A-Za-z]/g, c => String.fromCharCode((c.charCodeAt(0) - (c < 'a' ? 65 : 97) + 13) % 26 + (c < 'a' ? 65 : 97))); }
function rot47(t) { return t.replace(/[\x21-\x7E]/g, c => String.fromCharCode(((c.charCodeAt(0) - 33 + 47) % 94) + 33)); }
function atbash(t) { return t.replace(/[A-Za-z]/g, c => String.fromCharCode((c < 'a' ? 90 : 122) - (c.charCodeAt(0) - (c < 'a' ? 65 : 97)))); }
function base64e(t) { return Buffer.from(t).toString('base64'); }
function base64d(t) { return Buffer.from(t, 'base64').toString('utf8'); }
function reverse(t) { return t.split('').reverse().join(''); }
function textToBin(t) { return [...t].map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '); }
function binToText(b) { return b.split(' ').map(x => String.fromCharCode(parseInt(x, 2))).join(''); }
function textToHex(t) { return [...t].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '); }
function hexToText(h) { return h.split(' ').map(x => String.fromCharCode(parseInt(x, 16))).join(''); }
function textToOctal(t) { return [...t].map(c => c.charCodeAt(0).toString(8).padStart(3, '0')).join(' '); }
function octalToText(t) { try { return t.split(' ').map(n => String.fromCharCode(parseInt(n, 8))).join(''); } catch { return 'Error'; } }
function textToAscii(t) { return [...t].map(c => c.charCodeAt(0)).join(' '); }
function asciiToText(t) { try { return t.split(' ').map(n => String.fromCharCode(parseInt(n))).join(''); } catch { return 'Error'; } }

function md5(t) { return crypto.createHash('md5').update(t).digest('hex'); }
function sha1(t) { return crypto.createHash('sha1').update(t).digest('hex'); }
function sha256(t) { return crypto.createHash('sha256').update(t).digest('hex'); }
function sha512(t) { return crypto.createHash('sha512').update(t).digest('hex'); }

const morse = { 'A':'.-','B':'-...','C':'-.-.','D':'-..','E':'.','F':'..-.','G':'--.','H':'....','I':'..','J':'.---','K':'-.-','L':'.-..','M':'--','N':'-.','O':'---','P':'.--.','Q':'--.-','R':'.-.','S':'...','T':'-','U':'..-','V':'...-','W':'.--','X':'-..-','Y':'-.--','Z':'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.' };
const morseRev = Object.fromEntries(Object.entries(morse).map(([k,v]) => [v,k]));
function textToMorse(t) { return t.toUpperCase().split(' ').map(w => w.split('').map(c => morse[c]||'?').join(' ')).join(' / '); }
function morseToText(m) { return m.split('/').map(w => w.trim().split(' ').map(l => morseRev[l.trim()]||'?').join('')).join(' '); }

function caesar(t, s) { s = ((s % 26) + 26) % 26; return t.replace(/[A-Za-z]/g, c => { const b = c < 'a' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + s) % 26 + b); }); }
function caesarBrute(t) { return Array.from({length:25},(_,i) => `Shift ${i+1}: ${caesar(t,i+1)}`).join('\n'); }

function vigenereEncode(t, k) { k = k.toUpperCase().replace(/[^A-Z]/g, ''); if (!k.length) return t; let ki = 0; return t.replace(/[A-Za-z]/g, c => { const b = c < 'a' ? 65 : 97; const s = k[ki++ % k.length].charCodeAt(0) - 65; return String.fromCharCode((c.charCodeAt(0) - b + s) % 26 + b); }); }
function vigenereDecode(t, k) { k = k.toUpperCase().replace(/[^A-Z]/g, ''); if (!k.length) return t; let ki = 0; return t.replace(/[A-Za-z]/g, c => { const b = c < 'a' ? 65 : 97; const s = k[ki++ % k.length].charCodeAt(0) - 65; return String.fromCharCode((c.charCodeAt(0) - b - s + 26) % 26 + b); }); }

function beaufort(t, k) { k = k.toUpperCase().replace(/[^A-Z]/g, ''); if (!k.length) return t; let ki = 0; return t.replace(/[A-Za-z]/g, c => { const pt = c.toUpperCase().charCodeAt(0) - 65; const kt = k[ki++ % k.length].charCodeAt(0) - 65; return String.fromCharCode((kt - pt + 26) % 26 + 65); }); }

function affineEncode(t, a, b) { return t.replace(/[A-Za-z]/g, c => { const base = c < 'a' ? 65 : 97; return String.fromCharCode((a * (c.charCodeAt(0) - base) + b) % 26 + base); }); }
function affineDecode(t, a, b) { let aInv = -1; for (let i = 1; i < 26; i++) if ((a * i) % 26 === 1) { aInv = i; break; } if (aInv === -1) return 'Error: a must be coprime with 26'; return t.replace(/[A-Za-z]/g, c => { const base = c < 'a' ? 65 : 97; return String.fromCharCode(((aInv * (c.charCodeAt(0) - base - b % 26 + 26)) % 26 + 26) % 26 + base); }); }

function railFenceEncode(t, r) { if (r < 2) return t; const fence = Array(r).fill().map(() => []); let rail = 0, dir = 1; for (const c of t) { fence[rail].push(c); if (rail === 0) dir = 1; else if (rail === r - 1) dir = -1; rail += dir; } return fence.flat().join(''); }
function railFenceDecode(t, r) { if (r < 2) return t; const len = t.length, pattern = []; let rail = 0, dir = 1; for (let i = 0; i < len; i++) { pattern.push(rail); if (rail === 0) dir = 1; else if (rail === r - 1) dir = -1; rail += dir; } const indices = pattern.map((p, i) => [p, i]).sort((a,b) => a[0] - b[0] || a[1] - b[1]); const result = Array(len); for (let i = 0; i < len; i++) result[indices[i][1]] = t[i]; return result.join(''); }

function scytaleEncode(t, cols) { const rows = Math.ceil(t.length / cols); const padded = t.padEnd(rows * cols, 'X'); let out = ''; for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) out += padded[r * cols + c]; return out.trimEnd(); }
function scytaleDecode(t, cols) { const rows = Math.ceil(t.length / cols); const padded = t.padEnd(rows * cols, 'X'); let out = ''; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out += padded[c * rows + r]; return out.replace(/X+$/, ''); }

function columnarEncode(t, key) { key = key.toUpperCase().replace(/[^A-Z]/g, ''); if (!key.length) return t; t = t.replace(/ /g, ''); const cols = key.length, rows = Math.ceil(t.length / cols); const padded = t.padEnd(rows * cols, 'X'); const order = [...key].map((c,i) => [c,i]).sort((a,b) => a[0].localeCompare(b[0])).map(x => x[1]); return order.map(col => { let s = ''; for (let r = 0; r < rows; r++) s += padded[r * cols + col]; return s; }).join(''); }
function columnarDecode(t, key) { key = key.toUpperCase().replace(/[^A-Z]/g, ''); if (!key.length) return t; const cols = key.length, rows = Math.ceil(t.length / cols); const order = [...key].map((c,i) => [c,i]).sort((a,b) => a[0].localeCompare(b[0])).map(x => x[1]); const cols_arr = new Array(cols); let pos = 0; for (const col of order) { cols_arr[col] = t.slice(pos, pos + rows).split(''); pos += rows; } let out = ''; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out += cols_arr[c][r]; return out.replace(/X+$/, ''); }

const polyGrid = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
function polybiusEncode(t) { return t.toUpperCase().replace(/[A-Z]/g, c => { if (c === 'J') c = 'I'; const i = polyGrid.indexOf(c); return i === -1 ? c : `${Math.floor(i/5)+1}${i%5+1}`; }); }
function polybiusDecode(t) { return t.replace(/[1-5][1-5]/g, g => polyGrid[(parseInt(g[0])-1)*5+(parseInt(g[1])-1)] || '?'); }

const bacon = { 'A':'AAAAA','B':'AAAAB','C':'AAABA','D':'AAABB','E':'AABAA','F':'AABAB','G':'AABBA','H':'AABBB','I':'ABAAA','J':'ABAAB','K':'ABABA','L':'ABABB','M':'ABBAA','N':'ABBAB','O':'ABBBA','P':'ABBBB','Q':'BAAAA','R':'BAAAB','S':'BAABA','T':'BAABB','U':'BABAA','V':'BABAB','W':'BABBA','X':'BABBB','Y':'BBAAA','Z':'BBAAB' };
const baconRev = Object.fromEntries(Object.entries(bacon).map(([k,v]) => [v,k]));
function baconEncode(t) { return t.toUpperCase().replace(/[A-Z]/g, c => bacon[c] || '?').split('').join(' '); }
function baconDecode(t) { return t.replace(/[AB]{5}/g, g => baconRev[g] || '?'); }

const nato = { A:'Alpha',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',J:'Juliet',K:'Kilo',L:'Lima',M:'Mike',N:'November',O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',T:'Tango',U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',Y:'Yankee',Z:'Zulu','0':'Zero','1':'One','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine' };
function toNato(t) { return t.toUpperCase().split('').map(c => nato[c] || c).join(' - '); }

function urlEncode(t) { return encodeURIComponent(t); }
function urlDecode(t) { try { return decodeURIComponent(t); } catch { return 'Error'; } }
function htmlEncode(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function htmlDecode(t) { return t.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'"); }

const t9 = { A:'2',B:'2',C:'2',D:'3',E:'3',F:'3',G:'4',H:'44',I:'444',J:'5',K:'55',L:'555',M:'6',N:'66',O:'666',P:'7',Q:'77',R:'777',S:'7777',T:'8',U:'88',V:'888',W:'9',X:'99',Y:'999',Z:'9999' };
function textToT9(t) { return t.toUpperCase().split('').map(c => t9[c] || (c === ' ' ? '0' : c)).join(' '); }

function xorCipher(t, k) { const key = k.charCodeAt(0); return [...t].map(c => String.fromCharCode(c.charCodeAt(0) ^ key)).join(''); }

const braille = { A:'⠁',B:'⠃',C:'⠉',D:'⠙',E:'⠑',F:'⠋',G:'⠛',H:'⠓',I:'⠊',J:'⠚',K:'⠅',L:'⠇',M:'⠍',N:'⠝',O:'⠕',P:'⠏',Q:'⠟',R:'⠗',S:'⠎',T:'⠞',U:'⠥',V:'⠧',W:'⠺',X:'⠭',Y:'⠽',Z:'⠵',' ':' ' };
function textToBraille(t) { return t.toUpperCase().split('').map(c => braille[c] || c).join(''); }

const phone = { A:'2',B:'2',C:'2',D:'3',E:'3',F:'3',G:'4',H:'4',I:'4',J:'5',K:'5',L:'5',M:'6',N:'6',O:'6',P:'7',Q:'7',R:'7',S:'7',T:'8',U:'8',V:'8',W:'9',X:'9',Y:'9',Z:'9' };
function textToPhone(t) { return t.toUpperCase().split('').map(c => phone[c] || c).join(''); }

function tapCodeEncode(t) { const grid = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; return t.toUpperCase().split('').map(c => { const i = grid.indexOf(c); if (i === -1) return c; return `${Math.floor(i/5)+1}.${i%5+1}`; }).join(' '); }
function tapCodeDecode(t) { const grid = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; return t.split(' ').map(p => { if (!p.includes('.')) return p; const [row, col] = p.split('.'); return grid[(parseInt(row)-1)*5+(parseInt(col)-1)] || '?'; }).join(''); }

function gronsfeldEncode(t, key) { key = key.replace(/[^0-9]/g, ''); if (!key.length) return t; let ki = 0; return t.replace(/[A-Za-z]/g, c => { const b = c < 'a' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + parseInt(key[ki++ % key.length])) % 26 + b); }); }
function gronsfeldDecode(t, key) { key = key.replace(/[^0-9]/g, ''); if (!key.length) return t; let ki = 0; return t.replace(/[A-Za-z]/g, c => { const b = c < 'a' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b - parseInt(key[ki++ % key.length]) + 26) % 26 + b); }); }

function autokeyEncode(t, key) { key = key.toUpperCase().replace(/[^A-Z]/g, ''); if (!key.length) return t; let fullKey = key + t.toUpperCase().replace(/[^A-Z]/g, ''); let ki = 0; return t.replace(/[A-Za-z]/g, c => { const b = c < 'a' ? 65 : 97; const s = fullKey[ki++ % fullKey.length].charCodeAt(0) - 65; return String.fromCharCode((c.charCodeAt(0) - b + s) % 26 + b); }); }

function snip(s, max = 1900) { return String(s).slice(0, max) + (String(s).length > max ? '…' : ''); }

// ========== ROBLOX BRUTE FORCE ==========
async function bruteForceRoblox(id) {
    const endpoints = {
        gameInfo: `https://games.roblox.com/v1/games?universeIds=${id}`,
        userV1: `https://users.roblox.com/v1/users/${id}`,
        groupV1: `https://groups.roblox.com/v1/groups/${id}`,
        assetV1: `https://economy.roblox.com/v2/assets/${id}/details`,
        placeV1: `https://api.roblox.com/places/info?placeId=${id}`,
        userFriends: `https://friends.roblox.com/v1/users/${id}/friends/count`,
        userFollowers: `https://friends.roblox.com/v1/users/${id}/followers/count`,
        userFollowing: `https://friends.roblox.com/v1/users/${id}/followings/count`,
        userGroups: `https://groups.roblox.com/v2/users/${id}/groups/roles`,
        userBadges: `https://badges.roblox.com/v1/users/${id}/badges?limit=10`,
        userAvatar: `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=420x420&format=Png`,
        userInventory: `https://inventory.roblox.com/v1/users/${id}/assets?limit=10`,
        userPresence: `https://presence.roblox.com/v1/presence/users`,
        groupMembers: `https://groups.roblox.com/v1/groups/${id}/members`,
        groupShout: `https://groups.roblox.com/v1/groups/${id}/shout`,
        groupRoles: `https://groups.roblox.com/v1/groups/${id}/roles`,
        groupWall: `https://groups.roblox.com/v1/groups/${id}/wall/posts?limit=5`,
        groupGames: `https://games.roblox.com/v1/groups/${id}/games`,
        badgeV1: `https://badges.roblox.com/v1/badges/${id}`,
        badgeStats: `https://badges.roblox.com/v1/badges/${id}/stats`,
        bundleV1: `https://economy.roblox.com/v1/bundles/${id}/details`,
        gameServers: `https://games.roblox.com/v1/games/${id}/servers/Public`,
        gameFavorites: `https://games.roblox.com/v1/games/${id}/favorites`,
        gameVotes: `https://games.roblox.com/v1/games/votes?universeIds=${id}`,
        gameBadges: `https://badges.roblox.com/v1/universes/${id}/badges`,
        gamePasses: `https://games.roblox.com/v1/games/${id}/game-passes`,
        universeV1: `https://apis.roblox.com/universes/v1/universes/${id}`,
        catalogItem: `https://catalog.roblox.com/v1/catalog/items/details?itemType=Asset&id=${id}`
    };
    const results = {};
    for (const [name, url] of Object.entries(endpoints)) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                results[name] = { success: true, status: res.status, data: data };
            } else {
                results[name] = { success: false, status: res.status };
            }
        } catch (err) {
            results[name] = { success: false, error: err.message };
        }
    }
    return results;
}

async function getRobloxGame(id) {
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${id}`);
    const json = await res.json();
    return json.data?.[0];
}

async function getRobloxUser(username) {
    const res = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [username] })
    });
    const json = await res.json();
    return json.data?.[0];
}

// ========== SLASH COMMANDS (ALL 60+) ==========
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('Show all Qarmander commands'),
    new SlashCommandBuilder().setName('brute_link').setDescription('Brute force a Roblox ID against all APIs').addStringOption(o => o.setName('id').setDescription('Roblox ID to scan').setRequired(true)),
    new SlashCommandBuilder().setName('robloxgame').setDescription('Look up a Roblox game by Universe ID').addStringOption(o => o.setName('id').setDescription('Universe ID').setRequired(true)),
    new SlashCommandBuilder().setName('robloxuser').setDescription('Look up a Roblox user by username').addStringOption(o => o.setName('username').setDescription('Roblox username').setRequired(true)),
    new SlashCommandBuilder().setName('rot13').setDescription('ROT13 encode/decode').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)),
    new SlashCommandBuilder().setName('rot47').setDescription('ROT47 cipher (printable ASCII)').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)),
    new SlashCommandBuilder().setName('atbash').setDescription('Atbash cipher').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)),
    new SlashCommandBuilder().setName('base64').setDescription('Base64 encode').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)),
    new SlashCommandBuilder().setName('base64d').setDescription('Base64 decode').addStringOption(o => o.setName('text').setDescription('Base64 to decode').setRequired(true)),
    new SlashCommandBuilder().setName('reverse').setDescription('Reverse text').addStringOption(o => o.setName('text').setDescription('Text to reverse').setRequired(true)),
    new SlashCommandBuilder().setName('bin').setDescription('Text to binary').addStringOption(o => o.setName('text').setDescription('Text to convert').setRequired(true)),
    new SlashCommandBuilder().setName('bindecode').setDescription('Binary to text').addStringOption(o => o.setName('binary').setDescription('Binary string').setRequired(true)),
    new SlashCommandBuilder().setName('hex').setDescription('Text to hex').addStringOption(o => o.setName('text').setDescription('Text to convert').setRequired(true)),
    new SlashCommandBuilder().setName('hexdecode').setDescription('Hex to text').addStringOption(o => o.setName('hex').setDescription('Hex string').setRequired(true)),
    new SlashCommandBuilder().setName('octal').setDescription('Text to octal').addStringOption(o => o.setName('text').setDescription('Text to convert').setRequired(true)),
    new SlashCommandBuilder().setName('octaldecode').setDescription('Octal to text').addStringOption(o => o.setName('octal').setDescription('Octal string').setRequired(true)),
    new SlashCommandBuilder().setName('ascii').setDescription('Text to ASCII codes').addStringOption(o => o.setName('text').setDescription('Text to convert').setRequired(true)),
    new SlashCommandBuilder().setName('asciidecode').setDescription('ASCII codes to text').addStringOption(o => o.setName('codes').setDescription('Space-separated ASCII codes').setRequired(true)),
    new SlashCommandBuilder().setName('md5').setDescription('MD5 hash').addStringOption(o => o.setName('text').setDescription('Text to hash').setRequired(true)),
    new SlashCommandBuilder().setName('sha1').setDescription('SHA-1 hash').addStringOption(o => o.setName('text').setDescription('Text to hash').setRequired(true)),
    new SlashCommandBuilder().setName('sha256').setDescription('SHA-256 hash').addStringOption(o => o.setName('text').setDescription('Text to hash').setRequired(true)),
    new SlashCommandBuilder().setName('sha512').setDescription('SHA-512 hash').addStringOption(o => o.setName('text').setDescription('Text to hash').setRequired(true)),
    new SlashCommandBuilder().setName('morse').setDescription('Text to Morse code').addStringOption(o => o.setName('text').setDescription('Text to convert').setRequired(true)),
    new SlashCommandBuilder().setName('morsedecode').setDescription('Morse to text').addStringOption(o => o.setName('morse').setDescription('Morse code').setRequired(true)),
    new SlashCommandBuilder().setName('caesar').setDescription('Caesar cipher').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)).addIntegerOption(o => o.setName('shift').setDescription('Shift amount').setRequired(false)),
    new SlashCommandBuilder().setName('caesarbf').setDescription('Caesar brute force (all 25 shifts)').addStringOption(o => o.setName('text').setDescription('Ciphertext to crack').setRequired(true)),
    new SlashCommandBuilder().setName('vigenere').setDescription('Vigenère encode').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Encryption key').setRequired(true)),
    new SlashCommandBuilder().setName('vigdecode').setDescription('Vigenère decode').addStringOption(o => o.setName('text').setDescription('Text to decode').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Decryption key').setRequired(true)),
    new SlashCommandBuilder().setName('beaufort').setDescription('Beaufort cipher').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Key').setRequired(true)),
    new SlashCommandBuilder().setName('affine').setDescription('Affine encode').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)).addIntegerOption(o => o.setName('a').setDescription('Multiplier (coprime with 26)').setRequired(true)).addIntegerOption(o => o.setName('b').setDescription('Shift').setRequired(true)),
    new SlashCommandBuilder().setName('affinedecode').setDescription('Affine decode').addStringOption(o => o.setName('text').setDescription('Text to decode').setRequired(true)).addIntegerOption(o => o.setName('a').setDescription('Multiplier used').setRequired(true)).addIntegerOption(o => o.setName('b').setDescription('Shift used').setRequired(true)),
    new SlashCommandBuilder().setName('railfence').setDescription('Rail fence encode').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)).addIntegerOption(o => o.setName('rails').setDescription('Number of rails').setRequired(false)),
    new SlashCommandBuilder().setName('railfencedecode').setDescription('Rail fence decode').addStringOption(o => o.setName('text').setDescription('Text to decode').setRequired(true)).addIntegerOption(o => o.setName('rails').setDescription('Number of rails').setRequired(false)),
    new SlashCommandBuilder().setName('scytale').setDescription('Scytale cipher encode').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)).addIntegerOption(o => o.setName('cols').setDescription('Number of columns').setRequired(false)),
    new SlashCommandBuilder().setName('scytaledecode').setDescription('Scytale cipher decode').addStringOption(o => o.setName('text').setDescription('Text to decode').setRequired(true)).addIntegerOption(o => o.setName('cols').setDescription('Number of columns').setRequired(false)),
    new SlashCommandBuilder().setName('columnar').setDescription('Columnar transposition encode').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Column order key').setRequired(true)),
    new SlashCommandBuilder().setName('columnardecode').setDescription('Columnar transposition decode').addStringOption(o => o.setName('text').setDescription('Text to decode').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Key used').setRequired(true)),
    new SlashCommandBuilder().setName('polybius').setDescription('Polybius square encode').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)),
    new SlashCommandBuilder().setName('polybiusdecode').setDescription('Polybius square decode').addStringOption(o => o.setName('numbers').setDescription('Number pairs').setRequired(true)),
    new SlashCommandBuilder().setName('baconian').setDescription('Baconian cipher encode').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)),
    new SlashCommandBuilder().setName('baconiandecode').setDescription('Baconian cipher decode').addStringOption(o => o.setName('bacon').setDescription('A/B groups').setRequired(true)),
    new SlashCommandBuilder().setName('nato').setDescription('NATO phonetic alphabet').addStringOption(o => o.setName('text').setDescription('Text to convert').setRequired(true)),
    new SlashCommandBuilder().setName('braille').setDescription('Text to Braille').addStringOption(o => o.setName('text').setDescription('Text to convert').setRequired(true)),
    new SlashCommandBuilder().setName('t9').setDescription('T9 phone keypad').addStringOption(o => o.setName('text').setDescription('Text to convert').setRequired(true)),
    new SlashCommandBuilder().setName('phone').setDescription('Phone digit mapping').addStringOption(o => o.setName('text').setDescription('Text to convert').setRequired(true)),
    new SlashCommandBuilder().setName('tapcode').setDescription('Tap code encode').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)),
    new SlashCommandBuilder().setName('tapcodedecode').setDescription('Tap code decode').addStringOption(o => o.setName('code').setDescription('Tap code (e.g., 1.1 2.3)').setRequired(true)),
    new SlashCommandBuilder().setName('urlencode').setDescription('URL encode').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)),
    new SlashCommandBuilder().setName('urldecode').setDescription('URL decode').addStringOption(o => o.setName('text').setDescription('URL to decode').setRequired(true)),
    new SlashCommandBuilder().setName('htmlencode').setDescription('HTML entity encode').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)),
    new SlashCommandBuilder().setName('htmldecode').setDescription('HTML entity decode').addStringOption(o => o.setName('text').setDescription('HTML to decode').setRequired(true)),
    new SlashCommandBuilder().setName('xor').setDescription('XOR cipher with single char key').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Single character key').setRequired(true)),
    new SlashCommandBuilder().setName('gronsfeld').setDescription('Gronsfeld cipher encode').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Numeric key').setRequired(true)),
    new SlashCommandBuilder().setName('gronsfelddecode').setDescription('Gronsfeld cipher decode').addStringOption(o => o.setName('text').setDescription('Text to decode').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Numeric key').setRequired(true)),
    new SlashCommandBuilder().setName('autokey').setDescription('Autokey cipher encode').addStringOption(o => o.setName('text').setDescription('Text to encode').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Primer key').setRequired(true)),
    new SlashCommandBuilder().setName('botstats').setDescription('Show bot statistics'),
    new SlashCommandBuilder().setName('menu').setDescription('Open interactive menu'),
];

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

client.once('ready', async () => {
    botStats.startCount++;
    saveStats(botStats);
    console.log(`✅ Qarmander online as ${client.user.tag} | Start #${botStats.startCount}`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands.map(c => c.toJSON()) });
    console.log(`📋 Registered ${commands.length} commands`);
});

client.on('interactionCreate', async i => {
    if (!i.isCommand()) return;
    if (!ALLOWED_GUILDS.includes(i.guildId)) {
        return i.reply({ content: '❌ Not authorized in this server.', ephemeral: true });
    }
    await i.deferReply();
    const e = new EmbedBuilder().setColor(0x7c3aed);

    try {
        switch (i.commandName) {
            case 'help': e.setTitle('🔐 Qarmander Commands').setDescription(`**Total Commands: ${commands.length}**\n\n🎮 **Roblox:** /brute_link, /robloxgame, /robloxuser\n🔄 **Basic:** /rot13, /rot47, /atbash, /reverse, /xor\n💻 **Encoding:** /base64, /bin, /hex, /octal, /ascii, /morse\n🔒 **Hashing:** /md5, /sha1, /sha256, /sha512\n🔑 **Ciphers:** /caesar, /vigenere, /beaufort, /affine\n🚂 **Transposition:** /railfence, /scytale, /columnar, /polybius\n📡 **Classic:** /baconian, /nato, /braille, /t9, /phone, /tapcode, /gronsfeld, /autokey\n🌐 **Web:** /urlencode, /urldecode, /htmlencode, /htmldecode\n🎛️ **Menu:** /menu, /botstats`); break;
            case 'brute_link': { const id = i.options.getString('id'); e.setTitle(`🔍 Results for ${id}`).setDescription('Scanning...'); await i.editReply({ embeds: [e] }); const results = await bruteForceRoblox(id); const good = Object.entries(results).filter(([_,v])=>v.success); e.setDescription(`✅ Found ${good.length} working endpoints\n${good.slice(0,10).map(([n,d])=>`**${n}**: ${d.data?.name || d.data?.data?.[0]?.name || 'Found'}`).join('\n')}`); break; }
            case 'robloxgame': { const g = await getRobloxGame(i.options.getString('id')); if(g) e.setTitle(`🎮 ${g.name}`).setDescription(`Playing: ${g.playing}\nVisits: ${g.visits}`); else e.setTitle('❌ Not found'); break; }
            case 'robloxuser': { const u = await getRobloxUser(i.options.getString('username')); if(u) e.setTitle(`👤 ${u.name}`).setDescription(`ID: ${u.id}\nDisplay: ${u.displayName}`); else e.setTitle('❌ Not found'); break; }
            case 'rot13': e.setTitle('ROT13').setDescription(`\`${snip(rot13(i.options.getString('text')))}\``); break;
            case 'rot47': e.setTitle('ROT47').setDescription(`\`${snip(rot47(i.options.getString('text')))}\``); break;
            case 'atbash': e.setTitle('Atbash').setDescription(`\`${snip(atbash(i.options.getString('text')))}\``); break;
            case 'base64': e.setTitle('Base64 Encode').setDescription(`\`${snip(base64e(i.options.getString('text')))}\``); break;
            case 'base64d': e.setTitle('Base64 Decode').setDescription(`\`${snip(base64d(i.options.getString('text')))}\``); break;
            case 'reverse': e.setTitle('Reversed').setDescription(`\`${snip(reverse(i.options.getString('text')))}\``); break;
            case 'bin': e.setTitle('Binary').setDescription(`\`${snip(textToBin(i.options.getString('text')))}\``); break;
            case 'bindecode': e.setTitle('Binary Decode').setDescription(`\`${snip(binToText(i.options.getString('binary')))}\``); break;
            case 'hex': e.setTitle('Hex').setDescription(`\`${snip(textToHex(i.options.getString('text')))}\``); break;
            case 'hexdecode': e.setTitle('Hex Decode').setDescription(`\`${snip(hexToText(i.options.getString('hex')))}\``); break;
            case 'octal': e.setTitle('Octal').setDescription(`\`${snip(textToOctal(i.options.getString('text')))}\``); break;
            case 'octaldecode': e.setTitle('Octal Decode').setDescription(`\`${snip(octalToText(i.options.getString('octal')))}\``); break;
            case 'ascii': e.setTitle('ASCII Codes').setDescription(`\`${snip(textToAscii(i.options.getString('text')))}\``); break;
            case 'asciidecode': e.setTitle('ASCII Decode').setDescription(`\`${snip(asciiToText(i.options.getString('codes')))}\``); break;
            case 'md5': e.setTitle('MD5').setDescription(`\`${md5(i.options.getString('text'))}\``); break;
            case 'sha1': e.setTitle('SHA-1').setDescription(`\`${sha1(i.options.getString('text'))}\``); break;
            case 'sha256': e.setTitle('SHA-256').setDescription(`\`${sha256(i.options.getString('text'))}\``); break;
            case 'sha512': e.setTitle('SHA-512').setDescription(`\`${sha512(i.options.getString('text'))}\``); break;
            case 'morse': e.setTitle('Morse').setDescription(`\`${snip(textToMorse(i.options.getString('text')))}\``); break;
            case 'morsedecode': e.setTitle('Morse Decode').setDescription(`\`${snip(morseToText(i.options.getString('morse')))}\``); break;
            case 'caesar': { const s = i.options.getInteger('shift') ?? 3; e.setTitle(`Caesar (shift ${s})`).setDescription(`\`${snip(caesar(i.options.getString('text'), s))}\``); break; }
            case 'caesarbf': e.setTitle('Caesar Brute Force').setDescription(`\`\`\`${snip(caesarBrute(i.options.getString('text')), 1900)}\`\`\``); break;
            case 'vigenere': e.setTitle('Vigenère Encode').setDescription(`\`${snip(vigenereEncode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'vigdecode': e.setTitle('Vigenère Decode').setDescription(`\`${snip(vigenereDecode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'beaufort': e.setTitle('Beaufort').setDescription(`\`${snip(beaufort(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'affine': e.setTitle('Affine Encode').setDescription(`\`${snip(affineEncode(i.options.getString('text'), i.options.getInteger('a'), i.options.getInteger('b')))}\``); break;
            case 'affinedecode': e.setTitle('Affine Decode').setDescription(`\`${snip(affineDecode(i.options.getString('text'), i.options.getInteger('a'), i.options.getInteger('b')))}\``); break;
            case 'railfence': { const r = i.options.getInteger('rails') ?? 3; e.setTitle(`Rail Fence (${r} rails)`).setDescription(`\`${snip(railFenceEncode(i.options.getString('text'), r))}\``); break; }
            case 'railfencedecode': { const r = i.options.getInteger('rails') ?? 3; e.setTitle(`Rail Fence Decode (${r} rails)`).setDescription(`\`${snip(railFenceDecode(i.options.getString('text'), r))}\``); break; }
            case 'scytale': { const c = i.options.getInteger('cols') ?? 4; e.setTitle(`Scytale (${c} cols)`).setDescription(`\`${snip(scytaleEncode(i.options.getString('text'), c))}\``); break; }
            case 'scytaledecode': { const c = i.options.getInteger('cols') ?? 4; e.setTitle(`Scytale Decode (${c} cols)`).setDescription(`\`${snip(scytaleDecode(i.options.getString('text'), c))}\``); break; }
            case 'columnar': e.setTitle('Columnar Encode').setDescription(`\`${snip(columnarEncode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'columnardecode': e.setTitle('Columnar Decode').setDescription(`\`${snip(columnarDecode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'polybius': e.setTitle('Polybius Encode').setDescription(`\`${snip(polybiusEncode(i.options.getString('text')))}\``); break;
            case 'polybiusdecode': e.setTitle('Polybius Decode').setDescription(`\`${snip(polybiusDecode(i.options.getString('numbers')))}\``); break;
            case 'baconian': e.setTitle('Baconian Encode').setDescription(`\`${snip(baconEncode(i.options.getString('text')))}\``); break;
            case 'baconiandecode': e.setTitle('Baconian Decode').setDescription(`\`${snip(baconDecode(i.options.getString('bacon')))}\``); break;
            case 'nato': e.setTitle('NATO').setDescription(`\`${snip(toNato(i.options.getString('text')))}\``); break;
            case 'braille': e.setTitle('Braille').setDescription(`\`${snip(textToBraille(i.options.getString('text')))}\``); break;
            case 't9': e.setTitle('T9 Keypad').setDescription(`\`${snip(textToT9(i.options.getString('text')))}\``); break;
            case 'phone': e.setTitle('Phone Digits').setDescription(`\`${snip(textToPhone(i.options.getString('text')))}\``); break;
            case 'tapcode': e.setTitle('Tap Code Encode').setDescription(`\`${snip(tapCodeEncode(i.options.getString('text')))}\``); break;
            case 'tapcodedecode': e.setTitle('Tap Code Decode').setDescription(`\`${snip(tapCodeDecode(i.options.getString('code')))}\``); break;
            case 'urlencode': e.setTitle('URL Encode').setDescription(`\`${snip(urlEncode(i.options.getString('text')))}\``); break;
            case 'urldecode': e.setTitle('URL Decode').setDescription(`\`${snip(urlDecode(i.options.getString('text')))}\``); break;
            case 'htmlencode': e.setTitle('HTML Encode').setDescription(`\`${snip(htmlEncode(i.options.getString('text')))}\``); break;
            case 'htmldecode': e.setTitle('HTML Decode').setDescription(`\`${snip(htmlDecode(i.options.getString('text')))}\``); break;
            case 'xor': e.setTitle('XOR').setDescription(`\`${snip(xorCipher(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'gronsfeld': e.setTitle('Gronsfeld Encode').setDescription(`\`${snip(gronsfeldEncode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'gronsfelddecode': e.setTitle('Gronsfeld Decode').setDescription(`\`${snip(gronsfeldDecode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'autokey': e.setTitle('Autokey Encode').setDescription(`\`${snip(autokeyEncode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'botstats': { const up = Math.floor((Date.now() - startTime) / 1000); const d = Math.floor(up / 86400), h = Math.floor((up % 86400) / 3600), m = Math.floor((up % 3600) / 60), s = up % 60; e.setTitle('🤖 Bot Stats').addFields({name:'Starts',value:`${botStats.startCount}`,inline:true},{name:'Uptime',value:`${d}d ${h}h ${m}m ${s}s`,inline:true},{name:'Commands',value:`${commands.length}`,inline:true}); break; }
            case 'menu': { const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('menu').setPlaceholder('Select cipher').addOptions([{label:'ROT13',value:'rot13'},{label:'Atbash',value:'atbash'},{label:'Base64',value:'base64'},{label:'Reverse',value:'reverse'},{label:'Morse',value:'morse'}])); await i.editReply({ embeds: [e.setTitle('🎛 Interactive Menu')], components: [row] }); const filter = m => m.user.id === i.user.id; const collector = i.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 }); collector.on('collect', async menu => { await menu.reply({ content: 'Type your message:', ephemeral: true }); const msgCollector = i.channel.createMessageCollector({ filter, time: 30000, max: 1 }); msgCollector.on('collect', async msg => { let res; if (menu.values[0] === 'rot13') res = rot13(msg.content); else if (menu.values[0] === 'atbash') res = atbash(msg.content); else if (menu.values[0] === 'base64') res = base64e(msg.content); else if (menu.values[0] === 'reverse') res = reverse(msg.content); else res = textToMorse(msg.content); await i.followUp({ embeds: [new EmbedBuilder().setColor(0x7c3aed).setTitle(menu.values[0].toUpperCase()).setDescription(`\`${snip(res)}\``)] }); }); }); return; }
        }
    } catch (err) { console.error(err); e.setTitle('❌ Error').setDescription('Something went wrong.'); }
    await i.editReply({ embeds: [e] });
});

client.login(TOKEN);