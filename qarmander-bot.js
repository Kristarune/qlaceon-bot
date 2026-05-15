const fs = require('fs');
const crypto = require('crypto');

// ── Load Sacred-Stuff.env if it exists ───────────────────────────────────────
if (fs.existsSync("./Sacred-Stuff.env")) {
    const envFile = fs.readFileSync("./Sacred-Stuff.env", "utf8");
    envFile.split("\n").forEach(line => {
        const [key, ...value] = line.split("=");
        if (key && value.length) {
            process.env[key.trim()] = value.join("=").trim();
        }
    });
    console.log('✅ Sacred-Stuff.env loaded');
} else {
    console.log('⚠️ Sacred-Stuff.env not found, using system environment variables');
}

// ── Diagnostic (remove after confirming token loads) ─────────────────────────
console.log('=== ENVIRONMENT DIAGNOSTIC ===');
console.log('DISCORD_TOKEN from env:', process.env.DISCORD_TOKEN ? `present (length: ${process.env.DISCORD_TOKEN.length})` : 'MISSING');
console.log('CLIENT_ID from env:', process.env.CLIENT_ID || 'MISSING');
console.log('Sacred-Stuff.env exists?', fs.existsSync('./Sacred-Stuff.env'));
if (fs.existsSync('./Sacred-Stuff.env')) {
    const content = fs.readFileSync('./Sacred-Stuff.env', 'utf8');
    console.log('File has lines:', content.split('\n').length);
    console.log('Contains DISCORD_TOKEN?', content.includes('DISCORD_TOKEN'));
}
console.log('================================');

const {
    Client, GatewayIntentBits, EmbedBuilder, REST, Routes,
    SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const http = require('http');

// ── Keep-alive server (for Replit / UptimeRobot) ─────────────────────────────
http.createServer((req, res) => { res.writeHead(200); res.end('Qarmander is alive!'); }).listen(5000, '0.0.0.0');

// ── Stats ─────────────────────────────────────────────────────────────────────
const STATS_FILE = './bot-stats.json';
function loadStats() { try { return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')); } catch { return { startCount: 0 }; } }
function saveStats(stats) { fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2)); }
const botStats = loadStats();
const startTime = Date.now();

// ── Guild Whitelist (hardcoded + dynamic file) ───────────────────────────────
const HARDCODED_GUILDS = ['1493304887252091061', '1502798100673335507'];
const GUILDS_FILE = './allowed-guilds.json';

function loadGuilds() {
    try { return JSON.parse(fs.readFileSync(GUILDS_FILE, 'utf8')); }
    catch { return []; }
}
function saveGuilds(arr) { fs.writeFileSync(GUILDS_FILE, JSON.stringify(arr, null, 2)); }

function getAllowedGuilds() {
    const dynamic = loadGuilds();
    return [...new Set([...HARDCODED_GUILDS, ...dynamic])];
}

const BOT_ADMINS = ['1343208613430300744', '871464358817959946']; // spanishrobey, gasheper

// ── Game Watcher ──────────────────────────────────────────────────────────────
const WATCHED_FILE   = './watched-games.json';
const WATCH_INTERVAL = 5 * 60 * 1000;

function loadWatched() {
    try { return JSON.parse(fs.readFileSync(WATCHED_FILE, 'utf8')); }
    catch { return []; }
}
function saveWatched(arr) { fs.writeFileSync(WATCHED_FILE, JSON.stringify(arr, null, 2)); }

// ── Game Requests System ─────────────────────────────────────────────────────
const REQUESTS_FILE = './game-requests.json';

function loadRequests() {
    try { return JSON.parse(fs.readFileSync(REQUESTS_FILE, 'utf8')); }
    catch { return []; }
}
function saveRequests(arr) { fs.writeFileSync(REQUESTS_FILE, JSON.stringify(arr, null, 2)); }

// Helper: resolve place ID to universe ID
async function getUniverseFromPlace(placeId) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    try {
        const res = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`, { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) {
            const data = await res.json();
            return data.universeId;
        }
    } catch (e) { clearTimeout(t); }
    return null;
}

// ========== ALL CIPHER FUNCTIONS (unchanged) ==========
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
function vigenereEncode(t, k) { k = k.toUpperCase().replace(/[^A-Z]/g,''); if (!k.length) return t; let ki = 0; return t.replace(/[A-Za-z]/g, c => { const b = c < 'a' ? 65 : 97; const s = k[ki++ % k.length].charCodeAt(0) - 65; return String.fromCharCode((c.charCodeAt(0) - b + s) % 26 + b); }); }
function vigenereDecode(t, k) { k = k.toUpperCase().replace(/[^A-Z]/g,''); if (!k.length) return t; let ki = 0; return t.replace(/[A-Za-z]/g, c => { const b = c < 'a' ? 65 : 97; const s = k[ki++ % k.length].charCodeAt(0) - 65; return String.fromCharCode((c.charCodeAt(0) - b - s + 26) % 26 + b); }); }
function beaufort(t, k) { k = k.toUpperCase().replace(/[^A-Z]/g,''); if (!k.length) return t; let ki = 0; return t.replace(/[A-Za-z]/g, c => { const pt = c.toUpperCase().charCodeAt(0) - 65; const kt = k[ki++ % k.length].charCodeAt(0) - 65; return String.fromCharCode((kt - pt + 26) % 26 + 65); }); }
function affineEncode(t, a, b) { return t.replace(/[A-Za-z]/g, c => { const base = c < 'a' ? 65 : 97; return String.fromCharCode((a * (c.charCodeAt(0) - base) + b) % 26 + base); }); }
function affineDecode(t, a, b) { let aInv = -1; for (let i = 1; i < 26; i++) if ((a * i) % 26 === 1) { aInv = i; break; } if (aInv === -1) return 'Error: a must be coprime with 26'; return t.replace(/[A-Za-z]/g, c => { const base = c < 'a' ? 65 : 97; return String.fromCharCode(((aInv * (c.charCodeAt(0) - base - b % 26 + 26)) % 26 + 26) % 26 + base); }); }
function railFenceEncode(t, r) { if (r < 2) return t; const fence = Array(r).fill().map(() => []); let rail = 0, dir = 1; for (const c of t) { fence[rail].push(c); if (rail === 0) dir = 1; else if (rail === r - 1) dir = -1; rail += dir; } return fence.flat().join(''); }
function railFenceDecode(t, r) { if (r < 2) return t; const len = t.length, pattern = []; let rail = 0, dir = 1; for (let i = 0; i < len; i++) { pattern.push(rail); if (rail === 0) dir = 1; else if (rail === r - 1) dir = -1; rail += dir; } const indices = pattern.map((p, i) => [p, i]).sort((a,b) => a[0] - b[0] || a[1] - b[1]); const result = Array(len); for (let i = 0; i < len; i++) result[indices[i][1]] = t[i]; return result.join(''); }
function scytaleEncode(t, cols) { const rows = Math.ceil(t.length / cols); const padded = t.padEnd(rows * cols, 'X'); let out = ''; for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) out += padded[r * cols + c]; return out.trimEnd(); }
function scytaleDecode(t, cols) { const rows = Math.ceil(t.length / cols); const padded = t.padEnd(rows * cols, 'X'); let out = ''; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out += padded[c * rows + r]; return out.replace(/X+$/, ''); }
function columnarEncode(t, key) { key = key.toUpperCase().replace(/[^A-Z]/g,''); if (!key.length) return t; t = t.replace(/ /g,''); const cols = key.length, rows = Math.ceil(t.length / cols); const padded = t.padEnd(rows * cols, 'X'); const order = [...key].map((c,i) => [c,i]).sort((a,b) => a[0].localeCompare(b[0])).map(x => x[1]); return order.map(col => { let s = ''; for (let r = 0; r < rows; r++) s += padded[r * cols + col]; return s; }).join(''); }
function columnarDecode(t, key) { key = key.toUpperCase().replace(/[^A-Z]/g,''); if (!key.length) return t; const cols = key.length, rows = Math.ceil(t.length / cols); const order = [...key].map((c,i) => [c,i]).sort((a,b) => a[0].localeCompare(b[0])).map(x => x[1]); const cols_arr = new Array(cols); let pos = 0; for (const col of order) { cols_arr[col] = t.slice(pos, pos + rows).split(''); pos += rows; } let out = ''; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out += cols_arr[c][r]; return out.replace(/X+$/, ''); }
const polyGrid = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
function polybiusEncode(t) { return t.toUpperCase().replace(/[A-Z]/g, c => { if (c === 'J') c = 'I'; const i = polyGrid.indexOf(c); return i === -1 ? c : `${Math.floor(i/5)+1}${i%5+1}`; }); }
function polybiusDecode(t) { return t.replace(/[1-5][1-5]/g, g => polyGrid[(parseInt(g[0])-1)*5+(parseInt(g[1])-1)] || '?'); }
const bacon = { 'A':'AAAAA','B':'AAAAB','C':'AAABA','D':'AAABB','E':'AABAA','F':'AABAB','G':'AABBA','H':'AABBB','I':'ABAAA','J':'ABAAB','K':'ABABA','L':'ABABB','M':'ABBAA','N':'ABBAB','O':'ABBBA','P':'ABBBB','Q':'BAAAA','R':'BAAAB','S':'BAABA','T':'BAABB','U':'BABAA','V':'BABAB','W':'BABBA','X':'BABBB','Y':'BBAAA','Z':'BBAAB' };
const baconRev = Object.fromEntries(Object.entries(bacon).map(([k,v]) => [v,k]));
function baconEncode(t) { return t.toUpperCase().replace(/[A-Z]/g, c => bacon[c] || '?').split('').join(' '); }
function baconDecode(t) { return t.replace(/[AB]{5}/g, g => baconRev[g] || '?'); }
const natoMap = { A:'Alpha',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',J:'Juliet',K:'Kilo',L:'Lima',M:'Mike',N:'November',O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',T:'Tango',U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',Y:'Yankee',Z:'Zulu','0':'Zero','1':'One','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Nine' };
function toNato(t) { return t.toUpperCase().split('').map(c => natoMap[c] || c).join(' - '); }
function urlEncode(t) { return encodeURIComponent(t); }
function urlDecode(t) { try { return decodeURIComponent(t); } catch { return 'Error'; } }
function htmlEncode(t) { return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function htmlDecode(t) { return t.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'"); }
const t9map = { A:'2',B:'2',C:'2',D:'3',E:'3',F:'3',G:'4',H:'44',I:'444',J:'5',K:'55',L:'555',M:'6',N:'66',O:'666',P:'7',Q:'77',R:'777',S:'7777',T:'8',U:'88',V:'888',W:'9',X:'99',Y:'999',Z:'9999' };
function textToT9(t) { return t.toUpperCase().split('').map(c => t9map[c] || (c === ' ' ? '0' : c)).join(' '); }
function xorCipher(t, k) { const key = k.charCodeAt(0); return [...t].map(c => String.fromCharCode(c.charCodeAt(0) ^ key)).join(''); }
const brailleMap = { A:'⠁',B:'⠃',C:'⠉',D:'⠙',E:'⠑',F:'⠋',G:'⠛',H:'⠓',I:'⠊',J:'⠚',K:'⠅',L:'⠇',M:'⠍',N:'⠝',O:'⠕',P:'⠏',Q:'⠟',R:'⠗',S:'⠎',T:'⠞',U:'⠥',V:'⠧',W:'⠺',X:'⠭',Y:'⠽',Z:'⠵',' ':' ' };
function textToBraille(t) { return t.toUpperCase().split('').map(c => brailleMap[c] || c).join(''); }
const phoneMap = { A:'2',B:'2',C:'2',D:'3',E:'3',F:'3',G:'4',H:'4',I:'4',J:'5',K:'5',L:'5',M:'6',N:'6',O:'6',P:'7',Q:'7',R:'7',S:'7',T:'8',U:'8',V:'8',W:'9',X:'9',Y:'9',Z:'9' };
function textToPhone(t) { return t.toUpperCase().split('').map(c => phoneMap[c] || c).join(''); }
function tapCodeEncode(t) { const grid = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; return t.toUpperCase().split('').map(c => { const i = grid.indexOf(c); if (i === -1) return c; return `${Math.floor(i/5)+1}.${i%5+1}`; }).join(' '); }
function tapCodeDecode(t) { const grid = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; return t.split(' ').map(p => { if (!p.includes('.')) return p; const [row, col] = p.split('.'); return grid[(parseInt(row)-1)*5+(parseInt(col)-1)] || '?'; }).join(''); }
function gronsfeldEncode(t, key) { key = key.replace(/[^0-9]/g,''); if (!key.length) return t; let ki = 0; return t.replace(/[A-Za-z]/g, c => { const b = c < 'a' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b + parseInt(key[ki++ % key.length])) % 26 + b); }); }
function gronsfeldDecode(t, key) { key = key.replace(/[^0-9]/g,''); if (!key.length) return t; let ki = 0; return t.replace(/[A-Za-z]/g, c => { const b = c < 'a' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - b - parseInt(key[ki++ % key.length]) + 26) % 26 + b); }); }
function autokeyEncode(t, key) { key = key.toUpperCase().replace(/[^A-Z]/g,''); if (!key.length) return t; let fullKey = key + t.toUpperCase().replace(/[^A-Z]/g,''); let ki = 0; return t.replace(/[A-Za-z]/g, c => { const b = c < 'a' ? 65 : 97; const s = fullKey[ki++ % fullKey.length].charCodeAt(0) - 65; return String.fromCharCode((c.charCodeAt(0) - b + s) % 26 + b); }); }
function snip(s, max = 1900) { return String(s).slice(0, max) + (String(s).length > max ? '…' : ''); }

// ========== ROBLOX HELPERS ==========
async function rblxGet(url) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    try {
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(t);
        return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : null };
    } catch (e) {
        clearTimeout(t);
        return { ok: false, status: 0, error: e.message };
    }
}

async function getGameInfo(universeId) {
    const r = await rblxGet(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    return r.ok ? r.data?.data?.[0] : null;
}

async function getSubplaces(universeId) {
    const r = await rblxGet(`https://develop.roblox.com/v1/universes/${universeId}/places?isUniverseCreation=false&limit=50`);
    if (!r.ok || !r.data?.data) return [];
    return r.data.data.map(p => ({
        placeId: p.id,
        name: p.name,
        description: p.description || '',
        updated: p.updated || null,
    }));
}

async function getRobloxUser(username) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    try {
        const res = await fetch('https://users.roblox.com/v1/usernames/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usernames: [username] }),
            signal: ctrl.signal
        });
        clearTimeout(t);
        const json = await res.json();
        return json.data?.[0];
    } catch (e) {
        clearTimeout(t);
        return null;
    }
}

async function bruteForceRoblox(id) {
    const endpoints = {
        gameInfo:      `https://games.roblox.com/v1/games?universeIds=${id}`,
        userV1:        `https://users.roblox.com/v1/users/${id}`,
        groupV1:       `https://groups.roblox.com/v1/groups/${id}`,
        assetV1:       `https://economy.roblox.com/v2/assets/${id}/details`,
        placeV1:       `https://api.roblox.com/places/info?placeId=${id}`,
        userFriends:   `https://friends.roblox.com/v1/users/${id}/friends/count`,
        userFollowers: `https://friends.roblox.com/v1/users/${id}/followers/count`,
        userFollowing: `https://friends.roblox.com/v1/users/${id}/followings/count`,
        userGroups:    `https://groups.roblox.com/v2/users/${id}/groups/roles`,
        userBadges:    `https://badges.roblox.com/v1/users/${id}/badges?limit=10`,
        userAvatar:    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=420x420&format=Png`,
        userInventory: `https://inventory.roblox.com/v1/users/${id}/assets?limit=10`,
        groupMembers:  `https://groups.roblox.com/v1/groups/${id}/members`,
        groupShout:    `https://groups.roblox.com/v1/groups/${id}/shout`,
        groupRoles:    `https://groups.roblox.com/v1/groups/${id}/roles`,
        groupWall:     `https://groups.roblox.com/v1/groups/${id}/wall/posts?limit=5`,
        groupGames:    `https://games.roblox.com/v1/groups/${id}/games`,
        badgeV1:       `https://badges.roblox.com/v1/badges/${id}`,
        badgeStats:    `https://badges.roblox.com/v1/badges/${id}/stats`,
        bundleV1:      `https://economy.roblox.com/v1/bundles/${id}/details`,
        gameServers:   `https://games.roblox.com/v1/games/${id}/servers/Public`,
        gameFavorites: `https://games.roblox.com/v1/games/${id}/favorites`,
        gameVotes:     `https://games.roblox.com/v1/games/votes?universeIds=${id}`,
        gameBadges:    `https://badges.roblox.com/v1/universes/${id}/badges`,
        gamePasses:    `https://games.roblox.com/v1/games/${id}/game-passes`,
        universeV1:    `https://apis.roblox.com/universes/v1/universes/${id}`,
        catalogItem:   `https://catalog.roblox.com/v1/catalog/items/details?itemType=Asset&id=${id}`
    };
    const results = {};
    for (const [name, url] of Object.entries(endpoints)) {
        try {
            const ctrl = new AbortController();
            const tId = setTimeout(() => ctrl.abort(), 5000);
            const res = await fetch(url, { signal: ctrl.signal });
            clearTimeout(tId);
            results[name] = res.ok ? { success: true, status: res.status, data: await res.json() } : { success: false, status: res.status };
        } catch (err) {
            results[name] = { success: false, error: err.message };
        }
    }
    return results;
}

// ── Game Watcher Logic ────────────────────────────────────────────────────────
async function checkWatchedGames() {
    const watched = loadWatched();
    if (!watched.length) return;

    for (const entry of watched) {
        try {
            const game = await getGameInfo(entry.universeId);
            if (!game) continue;

            const alerts = [];

            const newUpdated = game.updated;
            if (entry.lastUpdated && newUpdated !== entry.lastUpdated) {
                alerts.push({
                    type: '🔄 Game Updated',
                    desc: `**${game.name}** was updated!\n**Previous:** ${entry.lastUpdated}\n**Now:** ${newUpdated}\n**Visits:** ${game.visits?.toLocaleString() ?? 'N/A'}\n**Playing:** ${game.playing?.toLocaleString() ?? 'N/A'}\n[Open Game](https://www.roblox.com/games/${game.rootPlaceId})`,
                    thumb: `https://www.roblox.com/asset-thumbnail/image?assetId=${game.rootPlaceId}&width=512&height=512&format=png`
                });
                entry.lastUpdated = newUpdated;
            }

            const subplaces = await getSubplaces(entry.universeId);
            if (!entry.subplaces) entry.subplaces = [];

            for (const sp of subplaces) {
                const existing = entry.subplaces.find(s => s.placeId === sp.placeId);
                if (!existing) {
                    alerts.push({
                        type: '🆕 New Subplace Detected',
                        desc: `A new subplace was found in **${game.name}**!\n**Place:** ${sp.name}\n**Place ID:** \`${sp.placeId}\`\n**Updated:** ${sp.updated ?? 'Unknown'}\n[Open Place](https://www.roblox.com/games/${sp.placeId})`,
                        thumb: null
                    });
                    entry.subplaces.push({ placeId: sp.placeId, name: sp.name, lastUpdated: sp.updated });
                } else if (existing.lastUpdated && sp.updated && sp.updated !== existing.lastUpdated) {
                    alerts.push({
                        type: '🔧 Subplace Updated',
                        desc: `A subplace in **${game.name}** was updated!\n**Place:** ${sp.name}\n**Place ID:** \`${sp.placeId}\`\n**Previous:** ${existing.lastUpdated}\n**Now:** ${sp.updated}\n[Open Place](https://www.roblox.com/games/${sp.placeId})`,
                        thumb: null
                    });
                    existing.lastUpdated = sp.updated;
                }
            }

            if (alerts.length) {
                const channel = await client.channels.fetch(entry.channelId).catch(() => null);
                if (channel) {
                    for (const alert of alerts) {
                        const embed = new EmbedBuilder()
                            .setColor(0xf59e0b)
                            .setTitle(alert.type)
                            .setDescription(alert.desc)
                            .setTimestamp()
                            .setFooter({ text: `Universe ID: ${entry.universeId}` });
                        if (alert.thumb) embed.setThumbnail(alert.thumb);
                        await channel.send({ embeds: [embed] }).catch(() => {});
                    }
                }
            }
        } catch (err) {
            console.error(`[GameWatcher] Error checking ${entry.universeId}:`, err.message);
        }
    }
    saveWatched(watched);
}

// ========== SLASH COMMANDS (full list) ==========
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('Show all Qarmander commands'),
    // ── Request System ──────────────────────────────────────────────────────
    new SlashCommandBuilder().setName('request_game')
        .setDescription('Suggest a Roblox game to be monitored (for owners to review)')
        .addStringOption(o => o.setName('universe_id').setDescription('Roblox Universe ID').setRequired(false))
        .addStringOption(o => o.setName('place_id').setDescription('Roblox Place ID (will resolve to universe)').setRequired(false)),
    new SlashCommandBuilder().setName('manage_requests')
        .setDescription('Browse, approve, or reject game requests (owners only)')
        .addStringOption(o => o.setName('action').setDescription('Action to perform').setRequired(true)
            .addChoices(
                { name: 'list', value: 'list' },
                { name: 'approve', value: 'approve' },
                { name: 'reject', value: 'reject' },
                { name: 'browse', value: 'browse' }
            ))
        .addStringOption(o => o.setName('request_id').setDescription('Request ID (for approve/reject)').setRequired(false)),
    // ── Existing commands ───────────────────────────────────────────────────
    new SlashCommandBuilder().setName('whitelist_server').setDescription('Add/remove server from whitelist (bot admins only)')
        .addStringOption(o => o.setName('action').setDescription('add or remove').setRequired(true).addChoices({ name:'add', value:'add' }, { name:'remove', value:'remove' }))
        .addStringOption(o => o.setName('guild_id').setDescription('Discord Guild ID').setRequired(true)),
    new SlashCommandBuilder().setName('whitelist_game').setDescription('Watch a Roblox game for updates (bot admins only)')
        .addStringOption(o => o.setName('action').setDescription('add, remove, list, change_channel').setRequired(true).addChoices({ name:'add', value:'add' }, { name:'remove', value:'remove' }, { name:'list', value:'list' }, { name:'change_channel', value:'change_channel' }))
        .addStringOption(o => o.setName('universe_id').setDescription('Roblox Universe ID').setRequired(false))
        .addStringOption(o => o.setName('channel').setDescription('Channel ID for alerts').setRequired(false)),
    new SlashCommandBuilder().setName('subplaces').setDescription('List all subplaces in a Roblox universe').addStringOption(o => o.setName('universe_id').setDescription('Universe ID').setRequired(true)),
    new SlashCommandBuilder().setName('brute_link').setDescription('Brute force a Roblox ID against all APIs').addStringOption(o => o.setName('id').setDescription('Roblox ID').setRequired(true)),
    new SlashCommandBuilder().setName('robloxgame').setDescription('Look up a Roblox game by Universe ID').addStringOption(o => o.setName('id').setDescription('Universe ID').setRequired(true)),
    new SlashCommandBuilder().setName('robloxuser').setDescription('Look up a Roblox user by username').addStringOption(o => o.setName('username').setDescription('Roblox username').setRequired(true)),
    new SlashCommandBuilder().setName('rot13').setDescription('ROT13 encode/decode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('rot47').setDescription('ROT47 cipher').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('atbash').setDescription('Atbash cipher').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('base64').setDescription('Base64 encode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('base64d').setDescription('Base64 decode').addStringOption(o => o.setName('text').setDescription('Base64').setRequired(true)),
    new SlashCommandBuilder().setName('reverse').setDescription('Reverse text').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('bin').setDescription('Text to binary').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('bindecode').setDescription('Binary to text').addStringOption(o => o.setName('binary').setDescription('Binary').setRequired(true)),
    new SlashCommandBuilder().setName('hex').setDescription('Text to hex').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('hexdecode').setDescription('Hex to text').addStringOption(o => o.setName('hex').setDescription('Hex').setRequired(true)),
    new SlashCommandBuilder().setName('octal').setDescription('Text to octal').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('octaldecode').setDescription('Octal to text').addStringOption(o => o.setName('octal').setDescription('Octal').setRequired(true)),
    new SlashCommandBuilder().setName('ascii').setDescription('Text to ASCII codes').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('asciidecode').setDescription('ASCII to text').addStringOption(o => o.setName('codes').setDescription('ASCII codes').setRequired(true)),
    new SlashCommandBuilder().setName('md5').setDescription('MD5 hash').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('sha1').setDescription('SHA-1 hash').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('sha256').setDescription('SHA-256 hash').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('sha512').setDescription('SHA-512 hash').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('morse').setDescription('Text to Morse').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('morsedecode').setDescription('Morse to text').addStringOption(o => o.setName('morse').setDescription('Morse').setRequired(true)),
    new SlashCommandBuilder().setName('caesar').setDescription('Caesar cipher').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addIntegerOption(o => o.setName('shift').setDescription('Shift').setRequired(false)),
    new SlashCommandBuilder().setName('caesarbf').setDescription('Caesar brute force').addStringOption(o => o.setName('text').setDescription('Ciphertext').setRequired(true)),
    new SlashCommandBuilder().setName('vigenere').setDescription('Vigenère encode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Key').setRequired(true)),
    new SlashCommandBuilder().setName('vigdecode').setDescription('Vigenère decode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Key').setRequired(true)),
    new SlashCommandBuilder().setName('beaufort').setDescription('Beaufort cipher').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Key').setRequired(true)),
    new SlashCommandBuilder().setName('affine').setDescription('Affine encode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addIntegerOption(o => o.setName('a').setDescription('Multiplier').setRequired(true)).addIntegerOption(o => o.setName('b').setDescription('Shift').setRequired(true)),
    new SlashCommandBuilder().setName('affinedecode').setDescription('Affine decode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addIntegerOption(o => o.setName('a').setDescription('Multiplier').setRequired(true)).addIntegerOption(o => o.setName('b').setDescription('Shift').setRequired(true)),
    new SlashCommandBuilder().setName('railfence').setDescription('Rail fence encode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addIntegerOption(o => o.setName('rails').setDescription('Rails').setRequired(false)),
    new SlashCommandBuilder().setName('railfencedecode').setDescription('Rail fence decode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addIntegerOption(o => o.setName('rails').setDescription('Rails').setRequired(false)),
    new SlashCommandBuilder().setName('scytale').setDescription('Scytale encode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addIntegerOption(o => o.setName('cols').setDescription('Columns').setRequired(false)),
    new SlashCommandBuilder().setName('scytaledecode').setDescription('Scytale decode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addIntegerOption(o => o.setName('cols').setDescription('Columns').setRequired(false)),
    new SlashCommandBuilder().setName('columnar').setDescription('Columnar encode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Key').setRequired(true)),
    new SlashCommandBuilder().setName('columnardecode').setDescription('Columnar decode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Key').setRequired(true)),
    new SlashCommandBuilder().setName('polybius').setDescription('Polybius encode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('polybiusdecode').setDescription('Polybius decode').addStringOption(o => o.setName('numbers').setDescription('Number pairs').setRequired(true)),
    new SlashCommandBuilder().setName('baconian').setDescription('Baconian encode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('baconiandecode').setDescription('Baconian decode').addStringOption(o => o.setName('bacon').setDescription('A/B groups').setRequired(true)),
    new SlashCommandBuilder().setName('nato').setDescription('NATO alphabet').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('braille').setDescription('Text to Braille').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('t9').setDescription('T9 keypad').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('phone').setDescription('Phone digits').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('tapcode').setDescription('Tap code encode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('tapcodedecode').setDescription('Tap code decode').addStringOption(o => o.setName('code').setDescription('Tap code').setRequired(true)),
    new SlashCommandBuilder().setName('urlencode').setDescription('URL encode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('urldecode').setDescription('URL decode').addStringOption(o => o.setName('text').setDescription('URL').setRequired(true)),
    new SlashCommandBuilder().setName('htmlencode').setDescription('HTML encode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)),
    new SlashCommandBuilder().setName('htmldecode').setDescription('HTML decode').addStringOption(o => o.setName('text').setDescription('HTML').setRequired(true)),
    new SlashCommandBuilder().setName('xor').setDescription('XOR cipher').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Char key').setRequired(true)),
    new SlashCommandBuilder().setName('gronsfeld').setDescription('Gronsfeld encode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Numeric key').setRequired(true)),
    new SlashCommandBuilder().setName('gronsfelddecode').setDescription('Gronsfeld decode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Numeric key').setRequired(true)),
    new SlashCommandBuilder().setName('autokey').setDescription('Autokey encode').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)).addStringOption(o => o.setName('key').setDescription('Key').setRequired(true)),
    new SlashCommandBuilder().setName('botstats').setDescription('Show bot statistics'),
    new SlashCommandBuilder().setName('menu').setDescription('Open interactive menu'),
];

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// ── Validate token before starting ───────────────────────────────────────────
if (!TOKEN) {
    console.error('❌ FATAL: DISCORD_TOKEN is missing!');
    console.error('   Please set DISCORD_TOKEN in Sacred-Stuff.env or GitHub Secrets');
    process.exit(1);
}
if (!CLIENT_ID) {
    console.error('❌ FATAL: CLIENT_ID is missing!');
    console.error('   Please set CLIENT_ID in Sacred-Stuff.env or GitHub Secrets');
    process.exit(1);
}
if (!TOKEN.match(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)) {
    console.error('❌ FATAL: DISCORD_TOKEN format looks invalid!');
    console.error('   Token should have three parts separated by dots.');
    process.exit(1);
}
console.log(`✅ Token validated (length: ${TOKEN.length})`);
console.log(`✅ Client ID: ${CLIENT_ID}`);

client.once('ready', async () => {
    botStats.startCount++;
    saveStats(botStats);
    console.log(`✅ Qarmander online as ${client.user.tag} | Start #${botStats.startCount}`);

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands.map(c => c.toJSON()) });
    console.log(`📋 Registered ${commands.length} commands`);

    setInterval(checkWatchedGames, WATCH_INTERVAL);
    console.log(`🎮 Game watcher started (every ${WATCH_INTERVAL / 60000} min)`);

    // Uptime status updater
    function updateUptimeStatus() {
        const uptimeSeconds = Math.floor(process.uptime());
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        let uptimeString = '';
        if (days > 0) uptimeString += `${days}d `;
        if (hours > 0 || days > 0) uptimeString += `${hours}h `;
        uptimeString += `${minutes}m`;
        client.user.setPresence({
            activities: [{ name: `Uptime: ${uptimeString}`, type: 3 }],
            status: 'online'
        });
    }
    updateUptimeStatus();
    setInterval(updateUptimeStatus, 60000);
});

// ── Interaction Handler with safe deferReply and request handlers ────────────
client.on('interactionCreate', async i => {
    if (!i.isCommand()) return;
    if (!getAllowedGuilds().includes(i.guildId)) {
        return i.reply({ content: '❌ Not authorized in this server.', ephemeral: true });
    }

    try {
        await i.deferReply();
    } catch (err) {
        console.error(`Defer error for /${i.commandName}:`, err);
        if (!i.replied && !i.deferred) {
            return i.reply({ content: '❌ Command timed out. Please try again.', ephemeral: true });
        }
        return;
    }

    const e = new EmbedBuilder().setColor(0x7c3aed);

    try {
        switch (i.commandName) {
            // ====================== REQUEST_GAME ======================
            case 'request_game': {
                const universeIdInput = i.options.getString('universe_id');
                const placeIdInput = i.options.getString('place_id');

                if (!universeIdInput && !placeIdInput) {
                    await i.editReply({ embeds: [e.setTitle('❌ Missing ID').setDescription('You must provide either a `universe_id` or a `place_id`.')] });
                    break;
                }

                let targetUniverseId = universeIdInput;
                let originalPlaceId = null;

                if (placeIdInput) {
                    originalPlaceId = placeIdInput;
                    e.setDescription(`Resolving place ID ${placeIdInput} to universe...`);
                    await i.editReply({ embeds: [e] });
                    targetUniverseId = await getUniverseFromPlace(placeIdInput);
                    if (!targetUniverseId) {
                        await i.editReply({ embeds: [e.setTitle('❌ Invalid Place').setDescription(`Could not find a universe for place ID \`${placeIdInput}\`.`)] });
                        break;
                    }
                }

                // Check if already watched
                const watched = loadWatched();
                if (watched.some(w => w.universeId === targetUniverseId)) {
                    await i.editReply({ embeds: [e.setTitle('ℹ️ Already Watched').setDescription(`Universe \`${targetUniverseId}\` is already being monitored.`)] });
                    break;
                }

                // Fetch game info
                const gameInfo = await getGameInfo(targetUniverseId);
                if (!gameInfo) {
                    await i.editReply({ embeds: [e.setTitle('❌ Game Not Found').setDescription(`Universe ID \`${targetUniverseId}\` does not exist.`) ] });
                    break;
                }

                // Create request
                const requests = loadRequests();
                const existingRequest = requests.find(r => r.universeId === targetUniverseId && r.status === 'pending');
                if (existingRequest) {
                    await i.editReply({ embeds: [e.setTitle('⚠️ Already Requested').setDescription(`A request for **${gameInfo.name}** is already pending.`) ] });
                    break;
                }

                const newRequest = {
                    id: Date.now().toString(),
                    universeId: targetUniverseId,
                    placeId: originalPlaceId,
                    name: gameInfo.name,
                    requestedBy: i.user.id,
                    requestedAt: new Date().toISOString(),
                    status: 'pending'
                };
                requests.push(newRequest);
                saveRequests(requests);

                e.setTitle('📨 Game Request Submitted')
                    .setDescription(`**${gameInfo.name}** has been submitted for review.`)
                    .setColor(0x06b6d4)
                    .addFields(
                        { name: 'Universe ID', value: `\`${targetUniverseId}\``, inline: true },
                        { name: 'Request ID', value: `\`${newRequest.id}\``, inline: true },
                        { name: 'Requested by', value: `<@${i.user.id}>`, inline: true }
                    );
                if (originalPlaceId) e.addFields({ name: 'Original Place ID', value: `\`${originalPlaceId}\``, inline: true });
                await i.editReply({ embeds: [e] });

                // Notify owners
                for (const ownerId of BOT_ADMINS) {
                    const owner = await client.users.fetch(ownerId).catch(() => null);
                    if (owner) {
                        owner.send({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('📨 New Game Request').setDescription(`**${gameInfo.name}**\nUniverse: \`${targetUniverseId}\`\nRequested by: <@${i.user.id}>\nUse \`/manage_requests browse\` to review.`)] }).catch(() => {});
                    }
                }
                break;
            }

            // ====================== MANAGE_REQUESTS ======================
            case 'manage_requests': {
                if (!BOT_ADMINS.includes(i.user.id)) {
                    await i.editReply({ embeds: [e.setTitle('❌ Access Denied').setDescription('Only bot owners can manage requests.')] });
                    break;
                }
                const action = i.options.getString('action');
                const requests = loadRequests();
                const pending = requests.filter(r => r.status === 'pending');

                if (action === 'list') {
                    if (!pending.length) e.setTitle('📋 Game Requests').setDescription('No pending requests.').setColor(0x06b6d4);
                    else e.setTitle(`📋 Pending Requests (${pending.length})`).setDescription(pending.map(r => `**ID:** \`${r.id}\` | **${r.name}** (Universe: \`${r.universeId}\`)\nRequested by: <@${r.requestedBy}> at ${new Date(r.requestedAt).toLocaleString()}`).join('\n\n')).setColor(0x06b6d4);
                    await i.editReply({ embeds: [e] });
                    break;
                }

                if (action === 'browse') {
                    if (!pending.length) {
                        await i.editReply({ embeds: [e.setTitle('📋 No Requests').setDescription('There are no pending game requests.')] });
                        break;
                    }
                    let currentIndex = 0;
                    const generateBrowseEmbed = (idx) => {
                        const req = pending[idx];
                        const embed = new EmbedBuilder().setTitle(`📨 Game Request ${idx+1}/${pending.length}`).setDescription(`**Game:** ${req.name}\n**Universe ID:** \`${req.universeId}\`\n**Request ID:** \`${req.id}\`\n**Requested by:** <@${req.requestedBy}>\n**Requested at:** ${new Date(req.requestedAt).toLocaleString()}`).setColor(0x06b6d4);
                        if (req.placeId) embed.addFields({ name: 'Original Place ID', value: `\`${req.placeId}\``, inline: true });
                        return embed;
                    };
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('prev_req').setLabel('◀ Previous').setStyle(ButtonStyle.Secondary).setDisabled(pending.length === 1),
                        new ButtonBuilder().setCustomId('next_req').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(pending.length === 1),
                        new ButtonBuilder().setCustomId('approve_req').setLabel('✅ Approve').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('reject_req').setLabel('❌ Reject').setStyle(ButtonStyle.Danger)
                    );
                    await i.editReply({ embeds: [generateBrowseEmbed(0)], components: [row] });

                    const collector = i.channel.createMessageComponentCollector({ filter: btn => btn.user.id === i.user.id, time: 120000 });
                    collector.on('collect', async btn => {
                        if (btn.customId === 'prev_req') {
                            currentIndex = (currentIndex - 1 + pending.length) % pending.length;
                            await btn.update({ embeds: [generateBrowseEmbed(currentIndex)], components: [row] });
                        } else if (btn.customId === 'next_req') {
                            currentIndex = (currentIndex + 1) % pending.length;
                            await btn.update({ embeds: [generateBrowseEmbed(currentIndex)], components: [row] });
                        } else if (btn.customId === 'approve_req') {
                            const req = pending[currentIndex];
                            const watched = loadWatched();
                            if (!watched.some(w => w.universeId === req.universeId)) {
                                const game = await getGameInfo(req.universeId);
                                if (game) {
                                    const subplaces = await getSubplaces(req.universeId);
                                    const newEntry = {
                                        universeId: req.universeId, name: game.name, channelId: i.channelId, guildId: i.guildId,
                                        lastUpdated: game.updated, addedBy: i.user.id, addedAt: new Date().toISOString(),
                                        subplaces: subplaces.map(sp => ({ placeId: sp.placeId, name: sp.name, lastUpdated: sp.updated }))
                                    };
                                    watched.push(newEntry);
                                    saveWatched(watched);
                                }
                            }
                            req.status = 'approved';
                            saveRequests(requests);
                            await btn.update({ embeds: [new EmbedBuilder().setColor(0x10b981).setTitle('✅ Request Approved').setDescription(`**${req.name}** has been added to the watch list.`)], components: [] });
                            collector.stop();
                            return;
                        } else if (btn.customId === 'reject_req') {
                            const req = pending[currentIndex];
                            req.status = 'rejected';
                            saveRequests(requests);
                            await btn.update({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('❌ Request Rejected').setDescription(`**${req.name}** has been rejected.`)], components: [] });
                            collector.stop();
                            return;
                        }
                    });
                    collector.on('end', () => { i.editReply({ components: [] }).catch(() => {}); });
                    break;
                }

                if (action === 'approve') {
                    const reqId = i.options.getString('request_id');
                    const request = requests.find(r => r.id === reqId);
                    if (!request || request.status !== 'pending') {
                        await i.editReply({ embeds: [e.setTitle('❌ Not Found').setDescription(`No pending request with ID \`${reqId}\`.`)] });
                        break;
                    }
                    const watched = loadWatched();
                    if (!watched.some(w => w.universeId === request.universeId)) {
                        const game = await getGameInfo(request.universeId);
                        if (game) {
                            const subplaces = await getSubplaces(request.universeId);
                            const newEntry = {
                                universeId: request.universeId, name: game.name, channelId: i.channelId, guildId: i.guildId,
                                lastUpdated: game.updated, addedBy: i.user.id, addedAt: new Date().toISOString(),
                                subplaces: subplaces.map(sp => ({ placeId: sp.placeId, name: sp.name, lastUpdated: sp.updated }))
                            };
                            watched.push(newEntry);
                            saveWatched(watched);
                        }
                    }
                    request.status = 'approved';
                    saveRequests(requests);
                    e.setTitle('✅ Request Approved').setDescription(`**${request.name}** has been added to the watch list.`).setColor(0x10b981);
                    await i.editReply({ embeds: [e] });
                    const requester = await client.users.fetch(request.requestedBy).catch(() => null);
                    if (requester) requester.send({ embeds: [new EmbedBuilder().setColor(0x10b981).setTitle('✅ Your game request was approved!').setDescription(`**${request.name}** is now being monitored.`)] }).catch(() => {});
                    break;
                }

                if (action === 'reject') {
                    const reqId = i.options.getString('request_id');
                    const request = requests.find(r => r.id === reqId);
                    if (!request || request.status !== 'pending') {
                        await i.editReply({ embeds: [e.setTitle('❌ Not Found').setDescription(`No pending request with ID \`${reqId}\`.`)] });
                        break;
                    }
                    request.status = 'rejected';
                    saveRequests(requests);
                    e.setTitle('❌ Request Rejected').setDescription(`**${request.name}** has been rejected.`).setColor(0xef4444);
                    await i.editReply({ embeds: [e] });
                    const requester = await client.users.fetch(request.requestedBy).catch(() => null);
                    if (requester) requester.send({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('❌ Your game request was rejected').setDescription(`**${request.name}** was not approved.`)] }).catch(() => {});
                    break;
                }
                break;
            }

            // ====================== HELP ======================
            case 'help':
                e.setTitle('🔐 Qarmander Commands').setDescription(
                    `**Total Commands: ${commands.length}**\n\n` +
                    `🎮 **Roblox:** /brute_link, /robloxgame, /robloxuser, /subplaces\n` +
                    `📺 **Watcher:** /whitelist_game (admin only)\n` +
                    `📨 **Requests:** /request_game (everyone) | /manage_requests (owners)\n` +
                    `🔐 **Admin:** /whitelist_server\n` +
                    `🔄 **Basic:** /rot13, /rot47, /atbash, /reverse, /xor\n` +
                    `💻 **Encoding:** /base64, /bin, /hex, /octal, /ascii, /morse\n` +
                    `🔒 **Hashing:** /md5, /sha1, /sha256, /sha512\n` +
                    `🔑 **Ciphers:** /caesar, /vigenere, /beaufort, /affine, /gronsfeld, /autokey\n` +
                    `🚂 **Transposition:** /railfence, /scytale, /columnar, /polybius\n` +
                    `📡 **Classic:** /baconian, /nato, /braille, /t9, /phone, /tapcode\n` +
                    `🌐 **Web:** /urlencode, /urldecode, /htmlencode, /htmldecode\n` +
                    `🎛️ **Other:** /menu, /botstats`
                );
                break;

            // ====================== WHITELIST_SERVER ======================
            case 'whitelist_server':
                if (!BOT_ADMINS.includes(i.user.id)) {
                    await i.editReply({ embeds: [e.setTitle('❌ Access Denied').setDescription('Only spanishrobey & gasheper can use this.')] });
                    break;
                }
                const actionWS = i.options.getString('action');
                const guildId = i.options.getString('guild_id').trim();
                if (actionWS === 'remove' && HARDCODED_GUILDS.includes(guildId)) {
                    await i.editReply({ embeds: [e.setTitle('⚠️ Protected').setDescription('Cannot remove hardcoded guild.')] });
                    break;
                }
                const dynamic = loadGuilds();
                if (actionWS === 'add') {
                    if (dynamic.includes(guildId) || HARDCODED_GUILDS.includes(guildId)) {
                        await i.editReply({ embeds: [e.setTitle('ℹ️ Already whitelisted')] });
                    } else {
                        dynamic.push(guildId);
                        saveGuilds(dynamic);
                        e.setTitle('✅ Server Whitelisted').setDescription(`Added \`${guildId}\``).setColor(0x10b981).addFields({ name:'Added by', value:`<@${i.user.id}>`, inline:true });
                        await i.editReply({ embeds: [e] });
                    }
                } else {
                    const idx = dynamic.indexOf(guildId);
                    if (idx === -1) {
                        await i.editReply({ embeds: [e.setTitle('❌ Not found')] });
                    } else {
                        dynamic.splice(idx,1);
                        saveGuilds(dynamic);
                        e.setTitle('🗑️ Removed').setDescription(`Removed \`${guildId}\``).setColor(0xef4444);
                        await i.editReply({ embeds: [e] });
                    }
                }
                break;

            // ====================== WHITELIST_GAME ======================
            case 'whitelist_game':
                if (!BOT_ADMINS.includes(i.user.id)) {
                    await i.editReply({ embeds: [e.setTitle('❌ Access Denied').setDescription('Only spanishrobey & gasheper can manage games.')] });
                    break;
                }
                const actWG = i.options.getString('action');
                const watched = loadWatched();
                if (actWG === 'list') {
                    if (!watched.length) e.setTitle('📺 Watched Games').setDescription('No games being watched.');
                    else e.setTitle('📺 Watched Games').setDescription(watched.map((w,i)=>`**${i+1}. ${w.name||w.universeId}**\nUniverse: \`${w.universeId}\`\nChannel: <#${w.channelId}>\nSubplaces: ${w.subplaces?.length??0}\nAdded by: <@${w.addedBy}>`).join('\n\n')).setColor(0x06b6d4);
                    await i.editReply({ embeds: [e] });
                    break;
                }
                const universeIdWG = i.options.getString('universe_id')?.trim();
                if (!universeIdWG) {
                    await i.editReply({ embeds: [e.setTitle('❌ Missing universe_id')] });
                    break;
                }
                if (actWG === 'change_channel') {
                    const newChan = i.options.getString('channel')?.trim();
                    if (!newChan) { await i.editReply({ embeds: [e.setTitle('❌ Missing channel')] }); break; }
                    const entry = watched.find(w => w.universeId === universeIdWG);
                    if (!entry) { await i.editReply({ embeds: [e.setTitle('❌ Not watched')] }); break; }
                    const old = entry.channelId;
                    entry.channelId = newChan;
                    saveWatched(watched);
                    e.setTitle('🔄 Channel Updated').setDescription(`**${entry.name||universeIdWG}** now alerts in <#${newChan}>`).addFields({ name:'Old', value:`<#${old}>`, inline:true }, { name:'New', value:`<#${newChan}>`, inline:true });
                    await i.editReply({ embeds: [e] });
                    break;
                }
                if (actWG === 'remove') {
                    const idx = watched.findIndex(w => w.universeId === universeIdWG);
                    if (idx === -1) { await i.editReply({ embeds: [e.setTitle('❌ Not found')] }); break; }
                    const removed = watched.splice(idx,1)[0];
                    saveWatched(watched);
                    e.setTitle('🗑️ Game Unwatched').setDescription(`**${removed.name||universeIdWG}** removed.`);
                    await i.editReply({ embeds: [e] });
                    break;
                }
                if (actWG === 'add') {
                    const channelId = i.options.getString('channel')?.trim() || i.channelId;
                    if (watched.find(w => w.universeId === universeIdWG)) {
                        await i.editReply({ embeds: [e.setTitle('ℹ️ Already watching')] });
                        break;
                    }
                    e.setTitle('⏳ Fetching...');
                    await i.editReply({ embeds: [e] });
                    const game = await getGameInfo(universeIdWG);
                    if (!game) {
                        await i.editReply({ embeds: [e.setTitle('❌ Game not found')] });
                        break;
                    }
                    const subplaces = await getSubplaces(universeIdWG);
                    const newEntry = {
                        universeId: universeIdWG, name: game.name, channelId, guildId: i.guildId,
                        lastUpdated: game.updated, addedBy: i.user.id, addedAt: new Date().toISOString(),
                        subplaces: subplaces.map(sp => ({ placeId: sp.placeId, name: sp.name, lastUpdated: sp.updated }))
                    };
                    watched.push(newEntry);
                    saveWatched(watched);
                    e.setTitle('✅ Game Added').setDescription(`Now watching **${game.name}**`).setColor(0x10b981)
                        .setThumbnail(`https://www.roblox.com/asset-thumbnail/image?assetId=${game.rootPlaceId}&width=512&height=512&format=png`)
                        .addFields({ name:'Universe', value:`\`${universeIdWG}\``, inline:true }, { name:'Channel', value:`<#${channelId}>`, inline:true }, { name:'Subplaces', value:`${subplaces.length}`, inline:true });
                    await i.editReply({ embeds: [e] });
                }
                break;

            // ====================== SUBPLACES ======================
            case 'subplaces':
                const uid = i.options.getString('universe_id').trim();
                e.setTitle('⏳ Fetching...');
                await i.editReply({ embeds: [e] });
                const [gameSub, subs] = await Promise.all([getGameInfo(uid), getSubplaces(uid)]);
                if (!gameSub) { await i.editReply({ embeds: [e.setTitle('❌ Not found')] }); break; }
                e.setTitle(`📦 Subplaces — ${gameSub.name}`).setColor(0x06b6d4).setURL(`https://www.roblox.com/games/${gameSub.rootPlaceId}`)
                    .setThumbnail(`https://www.roblox.com/asset-thumbnail/image?assetId=${gameSub.rootPlaceId}&width=512&height=512&format=png`)
                    .addFields({ name:'Universe ID', value:`\`${uid}\``, inline:true }, { name:'Total', value:`${subs.length}`, inline:true });
                if (subs.length) e.setDescription(subs.map((sp,i)=>`**${i+1}.** ${sp.name}\nPlace ID: \`${sp.placeId}\`\nUpdated: ${sp.updated??'Unknown'}\n[Open](https://www.roblox.com/games/${sp.placeId})`).join('\n\n').slice(0,4000));
                else e.setDescription('No subplaces found (may require authentication).');
                await i.editReply({ embeds: [e] });
                break;

            // ====================== BRUTE_LINK ======================
            case 'brute_link':
                const id = i.options.getString('id');
                e.setTitle(`🔍 Scanning ID: ${id}`).setDescription('Checking endpoints...');
                await i.editReply({ embeds: [e] });
                const results = await bruteForceRoblox(id);
                const good = Object.entries(results).filter(([,v])=>v.success);
                e.setTitle(`🔗 Bruteforce — ${id}`).setColor(good.length ? 0x10b981 : 0xef4444)
                    .setDescription(`✅ ${good.length} endpoints found\n${good.slice(0,10).map(([n,d])=>`**${n}**: ${d.data?.name || d.data?.data?.[0]?.name || 'Found'}`).join('\n')}`);
                if (good.length) e.addFields({ name:'❌ Failed', value:Object.entries(results).filter(([,v])=>!v.success).map(([n,d])=>`• ${n} (${d.status || d.error || 'error'})`).join('\n').slice(0,1000) });
                break;

            // ====================== ROBLOXGAME ======================
            case 'robloxgame':
                const g = await getGameInfo(i.options.getString('id'));
                if (g) e.setTitle(`🎮 ${g.name}`).setURL(`https://www.roblox.com/games/${g.rootPlaceId}`).setThumbnail(`https://www.roblox.com/asset-thumbnail/image?assetId=${g.rootPlaceId}&width=512&height=512&format=png`).addFields({name:'Playing', value:`${g.playing?.toLocaleString()??'N/A'}`, inline:true},{name:'Visits', value:`${g.visits?.toLocaleString()??'N/A'}`, inline:true},{name:'Creator', value:g.creator?.name??'Unknown', inline:true},{name:'Universe ID', value:`\`${g.id}\``, inline:true},{name:'Place ID', value:`\`${g.rootPlaceId}\``, inline:true},{name:'Updated', value:g.updated??'Unknown', inline:true});
                else e.setTitle('❌ Not found');
                break;

            // ====================== ROBLOXUSER ======================
            case 'robloxuser':
                const u = await getRobloxUser(i.options.getString('username'));
                if (u) e.setTitle(`👤 ${u.name}`).setDescription(`ID: ${u.id}\nDisplay: ${u.displayName}`);
                else e.setTitle('❌ Not found');
                break;

            // ====================== CIPHER CASES ======================
            case 'rot13': e.setTitle('ROT13').setDescription(`\`${snip(rot13(i.options.getString('text')))}\``); break;
            case 'rot47': e.setTitle('ROT47').setDescription(`\`${snip(rot47(i.options.getString('text')))}\``); break;
            case 'atbash': e.setTitle('Atbash').setDescription(`\`${snip(atbash(i.options.getString('text')))}\``); break;
            case 'base64': e.setTitle('Base64').setDescription(`\`${snip(base64e(i.options.getString('text')))}\``); break;
            case 'base64d': e.setTitle('Base64 Decode').setDescription(`\`${snip(base64d(i.options.getString('text')))}\``); break;
            case 'reverse': e.setTitle('Reverse').setDescription(`\`${snip(reverse(i.options.getString('text')))}\``); break;
            case 'bin': e.setTitle('Binary').setDescription(`\`${snip(textToBin(i.options.getString('text')))}\``); break;
            case 'bindecode': e.setTitle('Binary Decode').setDescription(`\`${snip(binToText(i.options.getString('binary')))}\``); break;
            case 'hex': e.setTitle('Hex').setDescription(`\`${snip(textToHex(i.options.getString('text')))}\``); break;
            case 'hexdecode': e.setTitle('Hex Decode').setDescription(`\`${snip(hexToText(i.options.getString('hex')))}\``); break;
            case 'octal': e.setTitle('Octal').setDescription(`\`${snip(textToOctal(i.options.getString('text')))}\``); break;
            case 'octaldecode': e.setTitle('Octal Decode').setDescription(`\`${snip(octalToText(i.options.getString('octal')))}\``); break;
            case 'ascii': e.setTitle('ASCII').setDescription(`\`${snip(textToAscii(i.options.getString('text')))}\``); break;
            case 'asciidecode': e.setTitle('ASCII Decode').setDescription(`\`${snip(asciiToText(i.options.getString('codes')))}\``); break;
            case 'md5': e.setTitle('MD5').setDescription(`\`${md5(i.options.getString('text'))}\``); break;
            case 'sha1': e.setTitle('SHA-1').setDescription(`\`${sha1(i.options.getString('text'))}\``); break;
            case 'sha256': e.setTitle('SHA-256').setDescription(`\`${sha256(i.options.getString('text'))}\``); break;
            case 'sha512': e.setTitle('SHA-512').setDescription(`\`${sha512(i.options.getString('text'))}\``); break;
            case 'morse': e.setTitle('Morse').setDescription(`\`${snip(textToMorse(i.options.getString('text')))}\``); break;
            case 'morsedecode': e.setTitle('Morse Decode').setDescription(`\`${snip(morseToText(i.options.getString('morse')))}\``); break;
            case 'caesar': { const s = i.options.getInteger('shift') ?? 3; e.setTitle(`Caesar (shift ${s})`).setDescription(`\`${snip(caesar(i.options.getString('text'), s))}\``); break; }
            case 'caesarbf': e.setTitle('Caesar Brute').setDescription(`\`\`\`${snip(caesarBrute(i.options.getString('text')),1900)}\`\`\``); break;
            case 'vigenere': e.setTitle('Vigenère Encode').setDescription(`\`${snip(vigenereEncode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'vigdecode': e.setTitle('Vigenère Decode').setDescription(`\`${snip(vigenereDecode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'beaufort': e.setTitle('Beaufort').setDescription(`\`${snip(beaufort(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'affine': e.setTitle('Affine Encode').setDescription(`\`${snip(affineEncode(i.options.getString('text'), i.options.getInteger('a'), i.options.getInteger('b')))}\``); break;
            case 'affinedecode': e.setTitle('Affine Decode').setDescription(`\`${snip(affineDecode(i.options.getString('text'), i.options.getInteger('a'), i.options.getInteger('b')))}\``); break;
            case 'railfence': { const r = i.options.getInteger('rails') ?? 3; e.setTitle(`Rail Fence (${r} rails)`).setDescription(`\`${snip(railFenceEncode(i.options.getString('text'), r))}\``); break; }
            case 'railfencedecode': { const r = i.options.getInteger('rails') ?? 3; e.setTitle(`Rail Fence Decode`).setDescription(`\`${snip(railFenceDecode(i.options.getString('text'), r))}\``); break; }
            case 'scytale': { const c = i.options.getInteger('cols') ?? 4; e.setTitle(`Scytale (${c} cols)`).setDescription(`\`${snip(scytaleEncode(i.options.getString('text'), c))}\``); break; }
            case 'scytaledecode': { const c = i.options.getInteger('cols') ?? 4; e.setTitle(`Scytale Decode`).setDescription(`\`${snip(scytaleDecode(i.options.getString('text'), c))}\``); break; }
            case 'columnar': e.setTitle('Columnar Encode').setDescription(`\`${snip(columnarEncode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'columnardecode': e.setTitle('Columnar Decode').setDescription(`\`${snip(columnarDecode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'polybius': e.setTitle('Polybius Encode').setDescription(`\`${snip(polybiusEncode(i.options.getString('text')))}\``); break;
            case 'polybiusdecode': e.setTitle('Polybius Decode').setDescription(`\`${snip(polybiusDecode(i.options.getString('numbers')))}\``); break;
            case 'baconian': e.setTitle('Baconian Encode').setDescription(`\`${snip(baconEncode(i.options.getString('text')))}\``); break;
            case 'baconiandecode': e.setTitle('Baconian Decode').setDescription(`\`${snip(baconDecode(i.options.getString('bacon')))}\``); break;
            case 'nato': e.setTitle('NATO').setDescription(`\`${snip(toNato(i.options.getString('text')))}\``); break;
            case 'braille': e.setTitle('Braille').setDescription(`\`${snip(textToBraille(i.options.getString('text')))}\``); break;
            case 't9': e.setTitle('T9').setDescription(`\`${snip(textToT9(i.options.getString('text')))}\``); break;
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

            // ====================== BOTSTATS ======================
            case 'botstats':
                const up = Math.floor((Date.now() - startTime) / 1000);
                const d = Math.floor(up / 86400), h = Math.floor((up % 86400) / 3600), m = Math.floor((up % 3600) / 60), s = up % 60;
                e.setTitle('🤖 Bot Stats').addFields({ name:'Starts', value:`${botStats.startCount}`, inline:true }, { name:'Uptime', value:`${d}d ${h}h ${m}m ${s}s`, inline:true }, { name:'Commands', value:`${commands.length}`, inline:true }, { name:'Watched', value:`${loadWatched().length}`, inline:true }, { name:'Whitelisted', value:`${getAllowedGuilds().length} servers`, inline:true });
                break;

            // ====================== MENU ======================
            case 'menu': {
                const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('menu').setPlaceholder('Select cipher').addOptions([{ label:'ROT13', value:'rot13' }, { label:'Atbash', value:'atbash' }, { label:'Base64', value:'base64' }, { label:'Reverse', value:'reverse' }, { label:'Morse', value:'morse' }]));
                await i.editReply({ embeds: [e.setTitle('🎛 Interactive Menu')], components: [row] });
                const filter = m => m.user.id === i.user.id;
                const collector = i.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });
                collector.on('collect', async menu => {
                    await menu.reply({ content: 'Type your message:', ephemeral: true });
                    const msgCollector = i.channel.createMessageCollector({ filter, time: 30000, max: 1 });
                    msgCollector.on('collect', async msg => {
                        const fn = { rot13, atbash, base64: base64e, reverse, morse: textToMorse }[menu.values[0]];
                        const res = fn ? fn(msg.content) : msg.content;
                        await i.followUp({ embeds: [new EmbedBuilder().setColor(0x7c3aed).setTitle(menu.values[0].toUpperCase()).setDescription(`\`${snip(res)}\``)] });
                    });
                });
                break;
            }
        }
    } catch (err) {
        console.error(err);
        e.setTitle('❌ Error').setDescription('Something went wrong.');
        if (i.deferred && !i.replied) await i.editReply({ embeds: [e] });
        else if (!i.replied) await i.reply({ embeds: [e], ephemeral: true });
        return;
    }

    if (i.deferred && !i.replied) await i.editReply({ embeds: [e] });
    else if (!i.replied) await i.reply({ embeds: [e] });
});

client.login(TOKEN);