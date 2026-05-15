const fs = require('fs');
const crypto = require('crypto');

if (fs.existsSync("./Sacred-Stuff.env")) {
    const envFile = fs.readFileSync("./Sacred-Stuff.env", "utf8");

    envFile.split("\n").forEach(line => {
        const [key, ...value] = line.split("=");

        if (key && value.length) {
            process.env[key.trim()] = value.join("=").trim();
        }
    });
}


const {
    Client, GatewayIntentBits, EmbedBuilder, REST, Routes,
    SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');

// ── Keep-alive ────────────────────────────────────────────────────────────────
http.createServer((req, res) => { res.writeHead(200); res.end('Qarmander is alive!'); }).listen(5000, '0.0.0.0');

// ── Stats ─────────────────────────────────────────────────────────────────────
const STATS_FILE = './bot-stats.json';
function loadStats() { try { return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')); } catch { return { startCount: 0 }; } }
function saveStats(stats) { fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2)); }
const botStats = loadStats();
const startTime = Date.now();

// ── Guild Whitelist ───────────────────────────────────────────────────────────
// Hardcoded original guilds — NEVER touched by /whitelist_server
const HARDCODED_GUILDS = ['1493304887252091061', '1502798100673335507'];
const GUILDS_FILE = './allowed-guilds.json';

function loadGuilds() {
    try { return JSON.parse(fs.readFileSync(GUILDS_FILE, 'utf8')); }
    catch { return []; }
}
function saveGuilds(arr) { fs.writeFileSync(GUILDS_FILE, JSON.stringify(arr, null, 2)); }

// Combined: hardcoded + dynamic file
function getAllowedGuilds() {
    const dynamic = loadGuilds();
    return [...new Set([...HARDCODED_GUILDS, ...dynamic])];
}

// Only these two Discord User IDs may run /whitelist_server and /whitelist_game
const BOT_ADMINS = ['1343208613430300744', '1268193957506744380']; // spanishrobey, gasheper

// ── Game Watcher ──────────────────────────────────────────────────────────────
const WATCHED_FILE   = './watched-games.json';
const WATCH_INTERVAL = 5 * 60 * 1000; // check every 5 minutes

function loadWatched() {
    try { return JSON.parse(fs.readFileSync(WATCHED_FILE, 'utf8')); }
    catch { return []; }
}
function saveWatched(arr) { fs.writeFileSync(WATCHED_FILE, JSON.stringify(arr, null, 2)); }

// watched entry shape:
// { universeId, name, channelId, guildId, lastUpdated, addedBy, subplaces: [{placeId, name, lastUpdated}] }

// ── Cipher Functions (all original, untouched) ────────────────────────────────
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

// ── Roblox Helpers ────────────────────────────────────────────────────────────
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

async function rblxPost(url, body) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    try {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
        clearTimeout(t);
        return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : null };
    } catch (e) {
        clearTimeout(t);
        return { ok: false, status: 0, error: e.message };
    }
}

async function getUniverseFromPlace(placeId) {
    let r = await rblxGet(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
    if (r.ok && r.data?.universeId) return r.data.universeId;
    r = await rblxGet(`https://api.roblox.com/universes/get-universe-containing-place?placeid=${placeId}`);
    if (r.ok && r.data?.UniverseId) return r.data.UniverseId;
    return null;
}

async function getGameInfo(universeId) {
    const r = await rblxGet(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    return r.ok ? r.data?.data?.[0] : null;
}

async function getSubplaces(universeId) {
    // Fetches all places in a universe (root + subplaces)
    const r = await rblxGet(`https://develop.roblox.com/v1/universes/${universeId}/places?isUniverseCreation=false&limit=50`);
    if (!r.ok || !r.data?.data) return [];
    return r.data.data.map(p => ({
        placeId: p.id,
        name: p.name,
        description: p.description || '',
        updated: p.updated || null,
    }));
}

async function getPlaceDetails(placeId) {
    const r = await rblxGet(`https://develop.roblox.com/v1/places/${placeId}`);
    return r.ok ? r.data : null;
}

async function getRobloxUser(username) {
    const r = await rblxPost('https://users.roblox.com/v1/usernames/users', { usernames: [username] });
    return r.ok ? r.data?.data?.[0] : null;
}

// ── Brute Force (original, preserved) ────────────────────────────────────────
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
            results[name] = res.ok
                ? { success: true,  status: res.status, data: await res.json() }
                : { success: false, status: res.status };
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

            // Check main game updated timestamp
            const newUpdated = game.updated;
            if (entry.lastUpdated && newUpdated !== entry.lastUpdated) {
                alerts.push({
                    type: '🔄 Game Updated',
                    desc: `**${game.name}** was updated!\n` +
                          `**Previous:** ${entry.lastUpdated}\n` +
                          `**Now:** ${newUpdated}\n` +
                          `**Visits:** ${game.visits?.toLocaleString() ?? 'N/A'}\n` +
                          `**Playing:** ${game.playing?.toLocaleString() ?? 'N/A'}\n` +
                          `[Open Game](https://www.roblox.com/games/${game.rootPlaceId})`,
                    thumb: `https://www.roblox.com/asset-thumbnail/image?assetId=${game.rootPlaceId}&width=512&height=512&format=png`
                });
                entry.lastUpdated = newUpdated;
            }

            // Check subplaces
            const subplaces = await getSubplaces(entry.universeId);
            if (!entry.subplaces) entry.subplaces = [];

            for (const sp of subplaces) {
                const existing = entry.subplaces.find(s => s.placeId === sp.placeId);
                if (!existing) {
                    // New subplace discovered
                    alerts.push({
                        type: '🆕 New Subplace Detected',
                        desc: `A new subplace was found in **${game.name}**!\n` +
                              `**Place:** ${sp.name}\n` +
                              `**Place ID:** \`${sp.placeId}\`\n` +
                              `**Updated:** ${sp.updated ?? 'Unknown'}\n` +
                              `[Open Place](https://www.roblox.com/games/${sp.placeId})`,
                        thumb: null
                    });
                    entry.subplaces.push({ placeId: sp.placeId, name: sp.name, lastUpdated: sp.updated });
                } else if (existing.lastUpdated && sp.updated && sp.updated !== existing.lastUpdated) {
                    // Existing subplace updated
                    alerts.push({
                        type: '🔧 Subplace Updated',
                        desc: `A subplace in **${game.name}** was updated!\n` +
                              `**Place:** ${sp.name}\n` +
                              `**Place ID:** \`${sp.placeId}\`\n` +
                              `**Previous:** ${existing.lastUpdated}\n` +
                              `**Now:** ${sp.updated}\n` +
                              `[Open Place](https://www.roblox.com/games/${sp.placeId})`,
                        thumb: null
                    });
                    existing.lastUpdated = sp.updated;
                }
            }

            // Send alerts to Discord channel
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

// ── Slash Commands ────────────────────────────────────────────────────────────
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('Show all Qarmander commands'),

    // ── NEW: Server Whitelist (bot-admin only) ──
    new SlashCommandBuilder()
        .setName('whitelist_server')
        .setDescription('Add or remove a server from the bot whitelist (spanishrobey & gasheper only)')
        .addStringOption(o => o.setName('action').setDescription('add or remove').setRequired(true)
            .addChoices({ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }))
        .addStringOption(o => o.setName('guild_id').setDescription('The Discord Guild ID to whitelist/unwhitelist').setRequired(true)),

    // ── NEW: Game Watcher ──
    new SlashCommandBuilder()
        .setName('whitelist_game')
        .setDescription('Watch a Roblox game for updates & subplace changes (bot-admins only)')
        .addStringOption(o => o.setName('action').setDescription('add, remove, list, or change channel').setRequired(true)
            .addChoices(
                { name: 'add', value: 'add' },
                { name: 'remove', value: 'remove' },
                { name: 'list', value: 'list' },
                { name: 'change_channel', value: 'change_channel' }
            ))
        .addStringOption(o => o.setName('universe_id').setDescription('Roblox Universe ID to watch (required for add/remove)').setRequired(false))
        .addStringOption(o => o.setName('channel').setDescription('Channel ID to post update alerts to (required for add)').setRequired(false)),

    // ── NEW: List Subplaces ──
    new SlashCommandBuilder()
        .setName('subplaces')
        .setDescription('List all subplaces in a Roblox universe')
        .addStringOption(o => o.setName('universe_id').setDescription('Universe ID').setRequired(true)),

    // ── Roblox (original) ──
    new SlashCommandBuilder().setName('brute_link').setDescription('Brute force a Roblox ID against all APIs').addStringOption(o => o.setName('id').setDescription('Roblox ID to scan').setRequired(true)),
    new SlashCommandBuilder().setName('robloxgame').setDescription('Look up a Roblox game by Universe ID').addStringOption(o => o.setName('id').setDescription('Universe ID').setRequired(true)),
    new SlashCommandBuilder().setName('robloxuser').setDescription('Look up a Roblox user by username').addStringOption(o => o.setName('username').setDescription('Roblox username').setRequired(true)),

    // ── Ciphers (all original, unchanged) ──
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

// ── Bot Ready ─────────────────────────────────────────────────────────────────
const TOKEN     = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

client.once('ready', async () => {
    botStats.startCount++;
    saveStats(botStats);
    console.log(`✅ Qarmander online as ${client.user.tag} | Start #${botStats.startCount}`);

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands.map(c => c.toJSON()) });
    console.log(`📋 Registered ${commands.length} commands`);

    // Start game watcher
    setInterval(checkWatchedGames, WATCH_INTERVAL);
    console.log(`🎮 Game watcher started (every ${WATCH_INTERVAL / 60000} min)`);
});

// ── Interaction Handler ───────────────────────────────────────────────────────
client.on('interactionCreate', async i => {
    if (!i.isCommand()) return;

    // ── Guild whitelist check (uses combined list, hardcoded guilds always pass) ──
    if (!getAllowedGuilds().includes(i.guildId)) {
        return i.reply({ content: '❌ Not authorized in this server.', ephemeral: true });
    }

    await i.deferReply();
    const e = new EmbedBuilder().setColor(0x7c3aed);

    try {
        switch (i.commandName) {

            // ── Help ──────────────────────────────────────────────────────────
            case 'help':
                e.setTitle('🔐 Qarmander Commands').setDescription(
                    `**Total Commands: ${commands.length}**\n\n` +
                    `🎮 **Roblox:** /brute_link, /robloxgame, /robloxuser, /subplaces\n` +
                    `📺 **Watcher:** /whitelist_game (watch games for updates + subplace changes)\n` +
                    `🔐 **Admin:** /whitelist_server (spanishrobey & gasheper only)\n` +
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

            // ── WHITELIST SERVER ──────────────────────────────────────────────
            case 'whitelist_server': {
                // Only spanishrobey and gasheper can run this
                if (!BOT_ADMINS.includes(i.user.id)) {
                    await i.editReply({ embeds: [e.setTitle('❌ Access Denied').setDescription('Only **spanishrobey** and **gasheper** can manage the server whitelist.')] });
                    break;
                }

                const action  = i.options.getString('action');
                const guildId = i.options.getString('guild_id').trim();

                // Protect the hardcoded guilds from removal
                if (action === 'remove' && HARDCODED_GUILDS.includes(guildId)) {
                    await i.editReply({ embeds: [e.setTitle('⚠️ Protected Guild').setDescription(`Guild \`${guildId}\` is a permanently hardcoded guild and cannot be removed.`).setColor(0xf59e0b)] });
                    break;
                }

                const dynamic = loadGuilds();

                if (action === 'add') {
                    if (dynamic.includes(guildId) || HARDCODED_GUILDS.includes(guildId)) {
                        await i.editReply({ embeds: [e.setTitle('ℹ️ Already Whitelisted').setDescription(`Guild \`${guildId}\` is already whitelisted.`)] });
                    } else {
                        dynamic.push(guildId);
                        saveGuilds(dynamic);
                        e.setTitle('✅ Server Whitelisted')
                            .setDescription(`Guild \`${guildId}\` has been added to the whitelist.`)
                            .setColor(0x10b981)
                            .addFields(
                                { name: 'Added by',      value: `<@${i.user.id}>`, inline: true },
                                { name: 'Total Guilds',  value: `${getAllowedGuilds().length}`,  inline: true }
                            );
                        await i.editReply({ embeds: [e] });
                    }
                } else {
                    const idx = dynamic.indexOf(guildId);
                    if (idx === -1) {
                        await i.editReply({ embeds: [e.setTitle('❌ Not Found').setDescription(`Guild \`${guildId}\` was not in the dynamic whitelist.`)] });
                    } else {
                        dynamic.splice(idx, 1);
                        saveGuilds(dynamic);
                        e.setTitle('🗑️ Server Removed')
                            .setDescription(`Guild \`${guildId}\` has been removed from the whitelist.`)
                            .setColor(0xef4444)
                            .addFields({ name: 'Removed by', value: `<@${i.user.id}>`, inline: true });
                        await i.editReply({ embeds: [e] });
                    }
                }
                break;
            }

            // ── WHITELIST GAME (game watcher) ─────────────────────────────────
            case 'whitelist_game': {
                if (!BOT_ADMINS.includes(i.user.id)) {
                    await i.editReply({ embeds: [e.setTitle('❌ Access Denied').setDescription('Only **spanishrobey** and **gasheper** can manage watched games.')] });
                    break;
                }

                const action = i.options.getString('action');
                const watched = loadWatched();

                // ── LIST ──
                if (action === 'list') {
                    if (!watched.length) {
                        e.setTitle('📺 Watched Games').setDescription('No games are currently being watched.');
                    } else {
                        e.setTitle('📺 Watched Games').setDescription(
                            watched.map((w, idx) =>
                                `**${idx+1}. ${w.name || w.universeId}**\n` +
                                `Universe ID: \`${w.universeId}\`\n` +
                                `Channel: <#${w.channelId}>\n` +
                                `Subplaces tracked: ${w.subplaces?.length ?? 0}\n` +
                                `Added by: <@${w.addedBy}>`
                            ).join('\n\n')
                        ).setColor(0x06b6d4);
                    }
                    await i.editReply({ embeds: [e] });
                    break;
                }

                const universeId = i.options.getString('universe_id')?.trim();
                if (!universeId) {
                    await i.editReply({ embeds: [e.setTitle('❌ Missing universe_id').setDescription('You must provide a `universe_id` for add/remove.')] });
                    break;
                }


                // ── CHANGE CHANNEL ──
                if (action === 'change_channel') {
                    const newChannelId = i.options.getString('channel')?.trim();

                    if (!newChannelId) {
                        await i.editReply({
                            embeds: [
                                e.setTitle('❌ Missing Channel')
                                 .setDescription('You must provide a channel ID.')
                            ]
                        });
                        break;
                    }

                    const gameEntry = watched.find(w => w.universeId === universeId);

                    if (!gameEntry) {
                        await i.editReply({
                            embeds: [
                                e.setTitle('❌ Not Found')
                                 .setDescription(`Universe \`${universeId}\` is not being watched.`)
                            ]
                        });
                        break;
                    }

                    const oldChannel = gameEntry.channelId;
                    gameEntry.channelId = newChannelId;

                    saveWatched(watched);

                    const updateEmbed = new EmbedBuilder()
                        .setTitle('🔄 Watch Channel Updated')
                        .setColor(0xf59e0b)
                        .setDescription(
                            `The alert channel for **${gameEntry.name || universeId}** was updated.`
                        )
                        .addFields(
                            { name: 'Universe ID', value: `\`${universeId}\``, inline: true },
                            { name: 'Old Channel', value: `<#${oldChannel}>`, inline: true },
                            { name: 'New Channel', value: `<#${newChannelId}>`, inline: true },
                            { name: 'Updated By', value: `<@${i.user.id}>`, inline: true }
                        )
                        .setTimestamp();

                    const targetChannel = await client.channels.fetch(newChannelId).catch(() => null);

                    if (targetChannel) {
                        await targetChannel.send({ embeds: [updateEmbed] }).catch(() => {});
                    }

                    await i.editReply({ embeds: [updateEmbed] });
                    break;
                }

                // ── REMOVE ──
                if (action === 'remove') {
                    const idx = watched.findIndex(w => w.universeId === universeId);
                    if (idx === -1) {
                        await i.editReply({ embeds: [e.setTitle('❌ Not Found').setDescription(`Universe \`${universeId}\` is not in the watch list.`)] });
                    } else {
                        const removed = watched.splice(idx, 1)[0];
                        saveWatched(watched);
                        e.setTitle('🗑️ Game Unwatched')
                            .setDescription(`**${removed.name || universeId}** has been removed from the watch list.`)
                            .setColor(0xef4444);
                        await i.editReply({ embeds: [e] });
                    }
                    break;
                }

                // ── ADD ──
                const channelId = i.options.getString('channel')?.trim() || i.channelId;
                if (watched.find(w => w.universeId === universeId)) {
                    await i.editReply({ embeds: [e.setTitle('ℹ️ Already Watching').setDescription(`Universe \`${universeId}\` is already in the watch list.`)] });
                    break;
                }

                // Fetch initial game info
                e.setTitle('⏳ Fetching game info...').setDescription('Please wait...');
                await i.editReply({ embeds: [e] });

                const game = await getGameInfo(universeId);
                if (!game) {
                    await i.editReply({ embeds: [e.setTitle('❌ Game Not Found').setDescription(`Could not find a game with Universe ID \`${universeId}\`. Make sure it's a valid Universe ID (not a Place ID).`)] });
                    break;
                }

                // Fetch initial subplaces
                const subplaces = await getSubplaces(universeId);

                const entry = {
                    universeId,
                    name:        game.name,
                    channelId,
                    guildId:     i.guildId,
                    lastUpdated: game.updated,
                    addedBy:     i.user.id,
                    addedAt:     new Date().toISOString(),
                    subplaces:   subplaces.map(sp => ({
                        placeId:     sp.placeId,
                        name:        sp.name,
                        lastUpdated: sp.updated
                    }))
                };
                watched.push(entry);
                saveWatched(watched);

                e.setTitle('✅ Game Added to Watch List')
                    .setDescription(`Now watching **${game.name}** for updates!`)
                    .setColor(0x10b981)
                    .setThumbnail(`https://www.roblox.com/asset-thumbnail/image?assetId=${game.rootPlaceId}&width=512&height=512&format=png`)
                    .addFields(
                        { name: 'Universe ID',      value: `\`${universeId}\``,        inline: true },
                        { name: 'Root Place ID',    value: `\`${game.rootPlaceId}\``,  inline: true },
                        { name: 'Alert Channel',    value: `<#${channelId}>`,           inline: true },
                        { name: 'Subplaces Found',  value: `${subplaces.length}`,       inline: true },
                        { name: 'Check Interval',   value: `Every ${WATCH_INTERVAL/60000} minutes`, inline: true },
                        { name: 'Current Updated',  value: game.updated ?? 'Unknown',  inline: true },
                        { name: 'Subplaces',
                          value: subplaces.length
                            ? subplaces.map(sp => `• **${sp.name}** (\`${sp.placeId}\`)`).join('\n').slice(0, 1000)
                            : 'None found' }
                    );
                await i.editReply({ embeds: [e] });
                break;
            }

            // ── SUBPLACES ─────────────────────────────────────────────────────
            case 'subplaces': {
                const universeId = i.options.getString('universe_id').trim();
                e.setTitle('⏳ Fetching subplaces...').setDescription('Please wait...');
                await i.editReply({ embeds: [e] });

                const [game, subplaces] = await Promise.all([
                    getGameInfo(universeId),
                    getSubplaces(universeId)
                ]);

                if (!game) {
                    await i.editReply({ embeds: [e.setTitle('❌ Not Found').setDescription(`No game found for Universe ID \`${universeId}\`.`)] });
                    break;
                }

                e.setTitle(`📦 Subplaces — ${game.name}`)
                    .setColor(0x06b6d4)
                    .setURL(`https://www.roblox.com/games/${game.rootPlaceId}`)
                    .setThumbnail(`https://www.roblox.com/asset-thumbnail/image?assetId=${game.rootPlaceId}&width=512&height=512&format=png`)
                    .addFields({ name: 'Universe ID', value: `\`${universeId}\``, inline: true },
                               { name: 'Total Subplaces', value: `${subplaces.length}`, inline: true });

                if (subplaces.length === 0) {
                    e.setDescription('No subplaces found (may require authentication to view private places).');
                } else {
                    const placeList = subplaces.map((sp, idx) =>
                        `**${idx+1}.** ${sp.name}\n` +
                        `Place ID: \`${sp.placeId}\`\n` +
                        `Updated: ${sp.updated ?? 'Unknown'}\n` +
                        `[Open](https://www.roblox.com/games/${sp.placeId})`
                    ).join('\n\n');
                    e.setDescription(placeList.slice(0, 4000));
                }
                await i.editReply({ embeds: [e] });
                break;
            }

            // ── BRUTE LINK (original, preserved) ─────────────────────────────
            case 'brute_link': {
                const id = i.options.getString('id');
                e.setTitle(`🔍 Scanning ID: ${id}`).setDescription('Checking all Roblox endpoints...');
                await i.editReply({ embeds: [e] });

                const results = await bruteForceRoblox(id);
                const good = Object.entries(results).filter(([,v]) => v.success);
                const bad  = Object.entries(results).filter(([,v]) => !v.success);

                e.setTitle(`🔗 Bruteforce — ID: ${id}`)
                    .setColor(good.length ? 0x10b981 : 0xef4444)
                    .setDescription(
                        `✅ **${good.length}** endpoints found  |  ❌ **${bad.length}** failed\n\n` +
                        good.slice(0, 10).map(([n, d]) => {
                            const name = d.data?.name || d.data?.data?.[0]?.name || d.data?.Name || 'Found';
                            return `**${n}**: ${name}`;
                        }).join('\n')
                    );

                if (good.length > 0) {
                    e.addFields({
                        name: '❌ Failed Endpoints',
                        value: bad.map(([n, d]) => `• ${n} (${d.status || d.error || 'error'})`).join('\n').slice(0, 1000) || 'None'
                    });
                }
                await i.editReply({ embeds: [e] });
                break;
            }

            // ── ROBLOX GAME ───────────────────────────────────────────────────
            case 'robloxgame': {
                const game = await getGameInfo(i.options.getString('id'));
                if (game) {
                    e.setTitle(`🎮 ${game.name}`)
                        .setURL(`https://www.roblox.com/games/${game.rootPlaceId}`)
                        .setThumbnail(`https://www.roblox.com/asset-thumbnail/image?assetId=${game.rootPlaceId}&width=512&height=512&format=png`)
                        .addFields(
                            { name: 'Playing',      value: game.playing?.toLocaleString() ?? 'N/A', inline: true },
                            { name: 'Visits',       value: game.visits?.toLocaleString()  ?? 'N/A', inline: true },
                            { name: 'Creator',      value: game.creator?.name ?? 'Unknown',          inline: true },
                            { name: 'Universe ID',  value: `\`${game.id}\``,                         inline: true },
                            { name: 'Place ID',     value: `\`${game.rootPlaceId}\``,                inline: true },
                            { name: 'Max Players',  value: `${game.maxPlayers}`,                     inline: true },
                            { name: 'Last Updated', value: game.updated ?? 'Unknown',                inline: true }
                        );
                } else {
                    e.setTitle('❌ Not found');
                }
                break;
            }

            // ── ROBLOX USER ───────────────────────────────────────────────────
            case 'robloxuser': {
                const u = await getRobloxUser(i.options.getString('username'));
                if (u) {
                    e.setTitle(`👤 ${u.name}`).setDescription(`ID: ${u.id}\nDisplay: ${u.displayName}`);
                } else {
                    e.setTitle('❌ Not found');
                }
                break;
            }

            // ── ALL ORIGINAL CIPHER CASES (untouched) ────────────────────────
            case 'rot13':         e.setTitle('ROT13').setDescription(`\`${snip(rot13(i.options.getString('text')))}\``); break;
            case 'rot47':         e.setTitle('ROT47').setDescription(`\`${snip(rot47(i.options.getString('text')))}\``); break;
            case 'atbash':        e.setTitle('Atbash').setDescription(`\`${snip(atbash(i.options.getString('text')))}\``); break;
            case 'base64':        e.setTitle('Base64 Encode').setDescription(`\`${snip(base64e(i.options.getString('text')))}\``); break;
            case 'base64d':       e.setTitle('Base64 Decode').setDescription(`\`${snip(base64d(i.options.getString('text')))}\``); break;
            case 'reverse':       e.setTitle('Reversed').setDescription(`\`${snip(reverse(i.options.getString('text')))}\``); break;
            case 'bin':           e.setTitle('Binary').setDescription(`\`${snip(textToBin(i.options.getString('text')))}\``); break;
            case 'bindecode':     e.setTitle('Binary Decode').setDescription(`\`${snip(binToText(i.options.getString('binary')))}\``); break;
            case 'hex':           e.setTitle('Hex').setDescription(`\`${snip(textToHex(i.options.getString('text')))}\``); break;
            case 'hexdecode':     e.setTitle('Hex Decode').setDescription(`\`${snip(hexToText(i.options.getString('hex')))}\``); break;
            case 'octal':         e.setTitle('Octal').setDescription(`\`${snip(textToOctal(i.options.getString('text')))}\``); break;
            case 'octaldecode':   e.setTitle('Octal Decode').setDescription(`\`${snip(octalToText(i.options.getString('octal')))}\``); break;
            case 'ascii':         e.setTitle('ASCII Codes').setDescription(`\`${snip(textToAscii(i.options.getString('text')))}\``); break;
            case 'asciidecode':   e.setTitle('ASCII Decode').setDescription(`\`${snip(asciiToText(i.options.getString('codes')))}\``); break;
            case 'md5':           e.setTitle('MD5').setDescription(`\`${md5(i.options.getString('text'))}\``); break;
            case 'sha1':          e.setTitle('SHA-1').setDescription(`\`${sha1(i.options.getString('text'))}\``); break;
            case 'sha256':        e.setTitle('SHA-256').setDescription(`\`${sha256(i.options.getString('text'))}\``); break;
            case 'sha512':        e.setTitle('SHA-512').setDescription(`\`${sha512(i.options.getString('text'))}\``); break;
            case 'morse':         e.setTitle('Morse').setDescription(`\`${snip(textToMorse(i.options.getString('text')))}\``); break;
            case 'morsedecode':   e.setTitle('Morse Decode').setDescription(`\`${snip(morseToText(i.options.getString('morse')))}\``); break;
            case 'caesar':        { const s = i.options.getInteger('shift') ?? 3; e.setTitle(`Caesar (shift ${s})`).setDescription(`\`${snip(caesar(i.options.getString('text'), s))}\``); break; }
            case 'caesarbf':      e.setTitle('Caesar Brute Force').setDescription(`\`\`\`${snip(caesarBrute(i.options.getString('text')), 1900)}\`\`\``); break;
            case 'vigenere':      e.setTitle('Vigenère Encode').setDescription(`\`${snip(vigenereEncode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'vigdecode':     e.setTitle('Vigenère Decode').setDescription(`\`${snip(vigenereDecode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'beaufort':      e.setTitle('Beaufort').setDescription(`\`${snip(beaufort(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'affine':        e.setTitle('Affine Encode').setDescription(`\`${snip(affineEncode(i.options.getString('text'), i.options.getInteger('a'), i.options.getInteger('b')))}\``); break;
            case 'affinedecode':  e.setTitle('Affine Decode').setDescription(`\`${snip(affineDecode(i.options.getString('text'), i.options.getInteger('a'), i.options.getInteger('b')))}\``); break;
            case 'railfence':     { const r = i.options.getInteger('rails') ?? 3; e.setTitle(`Rail Fence (${r} rails)`).setDescription(`\`${snip(railFenceEncode(i.options.getString('text'), r))}\``); break; }
            case 'railfencedecode': { const r = i.options.getInteger('rails') ?? 3; e.setTitle(`Rail Fence Decode (${r} rails)`).setDescription(`\`${snip(railFenceDecode(i.options.getString('text'), r))}\``); break; }
            case 'scytale':       { const c = i.options.getInteger('cols') ?? 4; e.setTitle(`Scytale (${c} cols)`).setDescription(`\`${snip(scytaleEncode(i.options.getString('text'), c))}\``); break; }
            case 'scytaledecode': { const c = i.options.getInteger('cols') ?? 4; e.setTitle(`Scytale Decode (${c} cols)`).setDescription(`\`${snip(scytaleDecode(i.options.getString('text'), c))}\``); break; }
            case 'columnar':      e.setTitle('Columnar Encode').setDescription(`\`${snip(columnarEncode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'columnardecode': e.setTitle('Columnar Decode').setDescription(`\`${snip(columnarDecode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'polybius':      e.setTitle('Polybius Encode').setDescription(`\`${snip(polybiusEncode(i.options.getString('text')))}\``); break;
            case 'polybiusdecode': e.setTitle('Polybius Decode').setDescription(`\`${snip(polybiusDecode(i.options.getString('numbers')))}\``); break;
            case 'baconian':      e.setTitle('Baconian Encode').setDescription(`\`${snip(baconEncode(i.options.getString('text')))}\``); break;
            case 'baconiandecode': e.setTitle('Baconian Decode').setDescription(`\`${snip(baconDecode(i.options.getString('bacon')))}\``); break;
            case 'nato':          e.setTitle('NATO').setDescription(`\`${snip(toNato(i.options.getString('text')))}\``); break;
            case 'braille':       e.setTitle('Braille').setDescription(`\`${snip(textToBraille(i.options.getString('text')))}\``); break;
            case 't9':            e.setTitle('T9 Keypad').setDescription(`\`${snip(textToT9(i.options.getString('text')))}\``); break;
            case 'phone':         e.setTitle('Phone Digits').setDescription(`\`${snip(textToPhone(i.options.getString('text')))}\``); break;
            case 'tapcode':       e.setTitle('Tap Code Encode').setDescription(`\`${snip(tapCodeEncode(i.options.getString('text')))}\``); break;
            case 'tapcodedecode': e.setTitle('Tap Code Decode').setDescription(`\`${snip(tapCodeDecode(i.options.getString('code')))}\``); break;
            case 'urlencode':     e.setTitle('URL Encode').setDescription(`\`${snip(urlEncode(i.options.getString('text')))}\``); break;
            case 'urldecode':     e.setTitle('URL Decode').setDescription(`\`${snip(urlDecode(i.options.getString('text')))}\``); break;
            case 'htmlencode':    e.setTitle('HTML Encode').setDescription(`\`${snip(htmlEncode(i.options.getString('text')))}\``); break;
            case 'htmldecode':    e.setTitle('HTML Decode').setDescription(`\`${snip(htmlDecode(i.options.getString('text')))}\``); break;
            case 'xor':           e.setTitle('XOR').setDescription(`\`${snip(xorCipher(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'gronsfeld':     e.setTitle('Gronsfeld Encode').setDescription(`\`${snip(gronsfeldEncode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'gronsfelddecode': e.setTitle('Gronsfeld Decode').setDescription(`\`${snip(gronsfeldDecode(i.options.getString('text'), i.options.getString('key')))}\``); break;
            case 'autokey':       e.setTitle('Autokey Encode').setDescription(`\`${snip(autokeyEncode(i.options.getString('text'), i.options.getString('key')))}\``); break;

            case 'botstats': {
                const up = Math.floor((Date.now() - startTime) / 1000);
                const d = Math.floor(up / 86400), h = Math.floor((up % 86400) / 3600), m = Math.floor((up % 3600) / 60), s = up % 60;
                e.setTitle('🤖 Bot Stats')
                    .addFields(
                        { name: 'Starts',         value: `${botStats.startCount}`, inline: true },
                        { name: 'Uptime',         value: `${d}d ${h}h ${m}m ${s}s`, inline: true },
                        { name: 'Commands',       value: `${commands.length}`, inline: true },
                        { name: 'Watched Games',  value: `${loadWatched().length}`, inline: true },
                        { name: 'Whitelisted',    value: `${getAllowedGuilds().length} servers`, inline: true }
                    );
                break;
            }

            case 'menu': {
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('menu').setPlaceholder('Select cipher').addOptions([
                        { label: 'ROT13',   value: 'rot13'   },
                        { label: 'Atbash',  value: 'atbash'  },
                        { label: 'Base64',  value: 'base64'  },
                        { label: 'Reverse', value: 'reverse' },
                        { label: 'Morse',   value: 'morse'   },
                    ])
                );
                await i.editReply({ embeds: [e.setTitle('🎛 Interactive Menu')], components: [row] });
                const filter = m => m.user.id === i.user.id;
                const collector = i.channel.createMessageComponentCollector({ filter, time: 60000, max: 1 });
                collector.on('collect', async menu => {
                    await menu.reply({ content: 'Type your message:', ephemeral: true });
                    const msgCollector = i.channel.createMessageCollector({ filter, time: 30000, max: 1 });
                    msgCollector.on('collect', async msg => {
                        const map = { rot13, atbash, base64: base64e, reverse, morse: textToMorse };
                        const fn  = map[menu.values[0]];
                        const res = fn ? fn(msg.content) : msg.content;
                        await i.followUp({ embeds: [new EmbedBuilder().setColor(0x7c3aed).setTitle(menu.values[0].toUpperCase()).setDescription(`\`${snip(res)}\``)] });
                    });
                });
                return;
            }
        }
    } catch (err) {
        console.error(err);
        e.setTitle('❌ Error').setDescription('Something went wrong. Check your input and try again.');
    }

    await i.editReply({ embeds: [e] });
});

client.login(TOKEN);
