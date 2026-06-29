const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes,
    SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const readline = require('readline');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http');

// ============================================
// CONSOLE SETUP
// ============================================
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
});

// ============================================
// LOAD ENVIRONMENT VARIABLES
// ============================================
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
    console.log('⚠️ Sacred-Stuff.env not found');
}

console.log('=== ENVIRONMENT DIAGNOSTIC ===');
console.log('DISCORD_TOKEN:', process.env.DISCORD_TOKEN ? '✅ Present' : '❌ MISSING');
console.log('CLIENT_ID:', process.env.CLIENT_ID ? '✅ Present' : '❌ MISSING');
console.log('================================');

// ============================================
// CLIENT SETUP
// ============================================
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

http.createServer((req, res) => { res.writeHead(200); res.end('Qarmander is alive!'); }).listen(5000, '0.0.0.0');

// Stats
const STATS_FILE = './bot-stats.json';
function loadStats() { try { return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')); } catch { return { startCount: 0 }; } }
function saveStats(stats) { fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2)); }
const botStats = loadStats();
const startTime = Date.now();

// Guild Whitelist
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

const BOT_ADMINS = ['1343208613430300744', '871464358817959946'];

// Game Watcher
const WATCHED_FILE = './watched-games.json';
const REQUESTS_FILE = './game-requests.json';
const POLL_MS = 30_000;
const sentAlerts = new Set();

function loadWatched() {
    try { return JSON.parse(fs.readFileSync(WATCHED_FILE, 'utf8')); }
    catch { return []; }
}
function saveWatched(arr) { fs.writeFileSync(WATCHED_FILE, JSON.stringify(arr, null, 2)); }

function loadRequests() {
    try { return JSON.parse(fs.readFileSync(REQUESTS_FILE, 'utf8')); }
    catch { return []; }
}
function saveRequests(arr) { fs.writeFileSync(REQUESTS_FILE, JSON.stringify(arr, null, 2)); }

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

// ========== ALL CIPHER FUNCTIONS ==========
function snip(s, max = 1900) { return String(s).slice(0, max) + (String(s).length > max ? '…' : ''); }
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

// ========== ROBLOX HELPERS ==========
async function getGameInfo(universeId) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    try {
        const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`, { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) {
            const data = await res.json();
            return data.data?.[0];
        }
    } catch (e) { clearTimeout(t); }
    return null;
}

async function getSubplaces(universeId) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    let placeIds = [];
    try {
        const res = await fetch(`https://develop.roblox.com/v1/universes/${universeId}/places?isUniverseCreation=false&limit=50`, { signal: ctrl.signal });
        clearTimeout(t);
        if (res.ok) {
            const data = await res.json();
            placeIds = (data.data || []).map(p => p.id);
        }
    } catch (e) { clearTimeout(t); }

    const game = await getGameInfo(universeId);
    if (game?.rootPlaceId && !placeIds.includes(game.rootPlaceId)) placeIds.unshift(game.rootPlaceId);
    if (!placeIds.length) return [];

    const results = [];
    const chunkSize = 10;
    for (let i = 0; i < placeIds.length; i += chunkSize) {
        const chunk = placeIds.slice(i, i + chunkSize);
        const ctrl2 = new AbortController();
        const t2 = setTimeout(() => ctrl2.abort(), 6000);
        try {
            const ids = chunk.join('&placeIds=');
            const r = await fetch(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${ids}`, { signal: ctrl2.signal });
            clearTimeout(t2);
            if (r.ok) {
                const data = await r.json();
                for (const place of (data || [])) {
                    results.push({ id: place.placeId, name: place.name || `Place ${place.placeId}`, updated: String(place.currentVersion ?? place.versionNumber ?? ''), universeId: String(place.universeId ?? universeId) });
                }
            }
        } catch (e) { clearTimeout(t2); }
    }

    const foundIds = new Set(results.map(r => String(r.id)));
    const missing = placeIds.filter(id => !foundIds.has(String(id)));
    for (const pid of missing) {
        const ctrl3 = new AbortController();
        const t3 = setTimeout(() => ctrl3.abort(), 5000);
        try {
            const r = await fetch(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${pid}`, { signal: ctrl3.signal });
            clearTimeout(t3);
            if (r.ok) {
                const data = await r.json();
                const place = data?.[0];
                if (place) results.push({ id: place.placeId, name: place.name || `Place ${pid}`, updated: String(place.currentVersion ?? ''), universeId: String(universeId) });
            }
        } catch (e) { clearTimeout(t3); }
    }
    return results;
}

async function checkWatchedGames() {
    const watched = loadWatched();
    if (!watched.length) return;
    let dirty = false;
    await Promise.all(watched.map(async entry => {
        try {
            const game = await getGameInfo(entry.universeId);
            if (!game) return;
            const channel = await client.channels.fetch(entry.channelId).catch(() => null);
            const alertKey = `${entry.universeId}:${game.updated}`;
            if (game.updated && entry.lastUpdated && game.updated !== entry.lastUpdated && !sentAlerts.has(alertKey)) {
                sentAlerts.add(alertKey);
                if (channel) {
                    const embed = new EmbedBuilder().setColor(0xf59e0b).setTitle('🔄 Game Updated!').setDescription(`**[${game.name}](https://www.roblox.com/games/${game.rootPlaceId})** just pushed an update!`).setThumbnail(`https://www.roblox.com/asset-thumbnail/image?assetId=${game.rootPlaceId}&width=512&height=512&format=png`).addFields({ name: '🕒 Previous', value: entry.lastUpdated ?? 'Unknown', inline: true }, { name: '🕒 Now', value: game.updated ?? 'Unknown', inline: true }, { name: '👥 Playing', value: game.playing?.toLocaleString() ?? 'N/A', inline: true }, { name: '🏆 Visits', value: game.visits?.toLocaleString() ?? 'N/A', inline: true }, { name: '🔗 Open', value: `[Click here](https://www.roblox.com/games/${game.rootPlaceId})` }).setTimestamp().setFooter({ text: `Universe ID: ${entry.universeId}` });
                    await channel.send({ embeds: [embed] }).catch(() => {});
                }
                entry.lastUpdated = game.updated;
                dirty = true;
            } else if (!entry.lastUpdated && game.updated) { entry.lastUpdated = game.updated; dirty = true; }
            const subplaces = await getSubplaces(entry.universeId);
            if (!entry.subplaces) { entry.subplaces = []; dirty = true; }
            for (const sp of subplaces) {
                const existing = entry.subplaces.find(s => String(s.placeId) === String(sp.id));
                if (!existing) {
                    const subKey = `${entry.universeId}:sub:${sp.id}:new`;
                    if (!sentAlerts.has(subKey)) {
                        sentAlerts.add(subKey);
                        if (channel) {
                            const embed = new EmbedBuilder().setColor(0x10b981).setTitle('🆕 New Subplace Detected!').setDescription(`A new subplace was found in **${game.name}**!`).addFields({ name: '📦 Name', value: sp.name ?? 'Unknown', inline: true }, { name: '🆔 Place ID', value: `\`${sp.id}\``, inline: true }, { name: '🕒 Updated', value: sp.updated ?? 'Unknown', inline: true }, { name: '🔗 Open', value: `[Click here](https://www.roblox.com/games/${sp.id})` }).setTimestamp().setFooter({ text: `Universe ID: ${entry.universeId}` });
                            await channel.send({ embeds: [embed] }).catch(() => {});
                        }
                        entry.subplaces.push({ placeId: sp.id, name: sp.name, lastUpdated: sp.updated });
                        dirty = true;
                    }
                } else if (sp.updated && existing.lastUpdated && sp.updated !== existing.lastUpdated) {
                    const subKey = `${entry.universeId}:sub:${sp.id}:${sp.updated}`;
                    if (!sentAlerts.has(subKey)) {
                        sentAlerts.add(subKey);
                        if (channel) {
                            const embed = new EmbedBuilder().setColor(0x06b6d4).setTitle('🔧 Subplace Updated!').setDescription(`A subplace in **${game.name}** was updated!`).addFields({ name: '📦 Name', value: sp.name ?? 'Unknown', inline: true }, { name: '🆔 Place ID', value: `\`${sp.id}\``, inline: true }, { name: '🕒 Previous', value: existing.lastUpdated, inline: true }, { name: '🕒 Now', value: sp.updated, inline: true }, { name: '🔗 Open', value: `[Click here](https://www.roblox.com/games/${sp.id})` }).setTimestamp().setFooter({ text: `Universe ID: ${entry.universeId}` });
                            await channel.send({ embeds: [embed] }).catch(() => {});
                        }
                        existing.lastUpdated = sp.updated;
                        existing.name = sp.name;
                        dirty = true;
                    }
                } else if (!existing.lastUpdated && sp.updated) { existing.lastUpdated = sp.updated; dirty = true; }
            }
        } catch (err) { console.error(`[Watcher] Error checking ${entry.universeId}:`, err.message); }
    }));
    if (dirty) saveWatched(watched);
}

async function watcherLoop() {
    while (true) {
        await checkWatchedGames();
        await new Promise(r => setTimeout(r, POLL_MS));
    }
}

// ========== SLASH COMMANDS ==========
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('Show all Qarmander commands'),
    new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
    new SlashCommandBuilder().setName('botstats').setDescription('Show bot statistics'),
    new SlashCommandBuilder().setName('menu').setDescription('Open interactive menu'),
    // Whitelist & Requests
    new SlashCommandBuilder().setName('whitelist_server').setDescription('Add/remove server from whitelist (bot admins only)').addStringOption(o => o.setName('action').setDescription('add or remove').setRequired(true).addChoices({ name:'add', value:'add' }, { name:'remove', value:'remove' })).addStringOption(o => o.setName('guild_id').setDescription('Discord Guild ID').setRequired(true)),
    new SlashCommandBuilder().setName('whitelist_game').setDescription('Watch a Roblox game for updates (bot admins only)').addStringOption(o => o.setName('action').setDescription('add, remove, list, change_channel').setRequired(true).addChoices({ name:'add', value:'add' }, { name:'remove', value:'remove' }, { name:'list', value:'list' }, { name:'change_channel', value:'change_channel' })).addStringOption(o => o.setName('universe_id').setDescription('Roblox Universe ID').setRequired(false)).addStringOption(o => o.setName('channel').setDescription('Channel ID for alerts').setRequired(false)),
    new SlashCommandBuilder().setName('request_game').setDescription('Suggest a Roblox game to be monitored').addStringOption(o => o.setName('universe_id').setDescription('Roblox Universe ID').setRequired(false)).addStringOption(o => o.setName('place_id').setDescription('Roblox Place ID').setRequired(false)),
    new SlashCommandBuilder().setName('manage_requests').setDescription('Browse, approve, or reject game requests (owners only)').addStringOption(o => o.setName('action').setDescription('Action').setRequired(true).addChoices({ name:'list', value:'list' }, { name:'approve', value:'approve' }, { name:'reject', value:'reject' }, { name:'browse', value:'browse' })).addStringOption(o => o.setName('request_id').setDescription('Request ID').setRequired(false)),
    // Roblox search
    new SlashCommandBuilder().setName('gamesearch').setDescription('Search for a Roblox game by name').addStringOption(o => o.setName('query').setDescription('Game name').setRequired(true)),
    new SlashCommandBuilder().setName('robloxuserinfo').setDescription('Get info about a Roblox user by username').addStringOption(o => o.setName('username').setDescription('Roblox username').setRequired(true)),
    new SlashCommandBuilder().setName('robloxuserid').setDescription('Get info about a Roblox user by ID').addStringOption(o => o.setName('userid').setDescription('Roblox user ID').setRequired(true)),
    new SlashCommandBuilder().setName('groupinfo').setDescription('Get info about a Roblox group').addStringOption(o => o.setName('groupid').setDescription('Roblox group ID').setRequired(true)),
    new SlashCommandBuilder().setName('assetinfo').setDescription('Get info about a Roblox asset').addStringOption(o => o.setName('assetid').setDescription('Asset ID').setRequired(true)),
    // Soggy image
    new SlashCommandBuilder().setName('sogme').setDescription('Get a random soggy image').addStringOption(o => o.setName('query').setDescription('Search for a specific image (optional)').setRequired(false)),
    // Original Roblox commands
    new SlashCommandBuilder().setName('subplaces').setDescription('List all subplaces in a Roblox universe').addStringOption(o => o.setName('universe_id').setDescription('Universe ID').setRequired(true)),
    new SlashCommandBuilder().setName('brute_link').setDescription('Brute force a Roblox ID against all APIs').addStringOption(o => o.setName('id').setDescription('Roblox ID').setRequired(true)),
    new SlashCommandBuilder().setName('robloxgame').setDescription('Look up a Roblox game by Universe ID').addStringOption(o => o.setName('id').setDescription('Universe ID').setRequired(true)),
    new SlashCommandBuilder().setName('robloxuser').setDescription('Look up a Roblox user by username').addStringOption(o => o.setName('username').setDescription('Roblox username').setRequired(true)),
    // All cipher commands
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
];

// ============================================
// READY EVENT
// ============================================
client.once('ready', async () => {
    botStats.startCount++;
    saveStats(botStats);
    console.log(`✅ Qarmander online as ${client.user.tag} | Start #${botStats.startCount}`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands.map(c => c.toJSON()) });
    console.log(`📋 Registered ${commands.length} commands`);

    watcherLoop();
    console.log(`🎮 Game watcher started (polling every ${POLL_MS/1000}s)`);

    const CONSOLE_CHANNEL_ID = '1493304893405134931';
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💬 CONSOLE MODE ACTIVE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    rl.on('line', async (input) => {
        if (input.toLowerCase() === 'exit') process.exit(0);
        if (input.trim()) {
            try {
                const channel = await client.channels.fetch(CONSOLE_CHANNEL_ID);
                if (channel) await channel.send(input);
            } catch(e) {}
        }
    });

    function updateUptimeStatus() {
        client.user.setPresence({ activities: [{ name: `${commands.length} commands`, type: 3 }], status: 'online' });
    }
    updateUptimeStatus();
    setInterval(updateUptimeStatus, 60000);
});

// ============================================
// INTERACTION HANDLER
// ============================================
client.on('interactionCreate', async i => {
    if (!i.isCommand()) return;
    if (!getAllowedGuilds().includes(i.guildId)) {
        return i.reply({ content: '❌ Not authorized in this server.', ephemeral: true });
    }

    try {
        await i.deferReply();
    } catch (err) {
        if (!i.replied && !i.deferred) {
            return i.reply({ content: '❌ Command timed out.', ephemeral: true });
        }
        return;
    }

    const e = new EmbedBuilder().setColor(0x7c3aed);

    switch (i.commandName) {
        case 'help':
            e.setTitle('🔐 Qarmander Commands').setDescription(`**Total Commands: ${commands.length}**\n\n🎮 **Roblox Search:** /gamesearch, /robloxuserinfo, /robloxuserid, /groupinfo, /assetinfo\n🎮 **Roblox:** /robloxgame, /robloxuser, /subplaces, /brute_link\n📺 **Watcher:** /whitelist_game, /request_game, /manage_requests\n🔐 **Admin:** /whitelist_server\n🔄 **Basic:** /rot13, /rot47, /atbash, /reverse, /xor\n💻 **Encoding:** /base64, /bin, /hex, /octal, /ascii, /morse\n🔒 **Hashing:** /md5, /sha1, /sha256, /sha512\n🔑 **Ciphers:** /caesar, /vigenere, /beaufort, /affine\n🚂 **Transposition:** /railfence, /scytale, /columnar, /polybius\n📡 **Classic:** /baconian, /nato, /braille, /t9, /phone, /tapcode\n🌐 **Web:** /urlencode, /urldecode, /htmlencode, /htmldecode\n🦈 **Fun:** /sogme\n🎛️ **Other:** /menu, /botstats`);
            break;

        case 'ping':
            e.setTitle('🏓 Pong!').setDescription(`Latency: ${Date.now() - i.createdTimestamp}ms`);
            break;

        // ----- /gamesearch -----
        case 'gamesearch': {
            const query = i.options.getString('query');
            await i.editReply(`🔍 Searching Roblox for "${query}"...`);
            try {
                const res = await fetch(`https://games.roblox.com/v1/games/search?keyword=${encodeURIComponent(query)}&limit=10`);
                if (!res.ok) throw new Error('Search API failed');
                const data = await res.json();
                const games = data.searchResults || [];
                if (!games.length) {
                    await i.editReply(`❌ No games found for "${query}"`);
                    break;
                }
                let result = `**🎮 Results for "${query}":**\n\n`;
                for (let idx = 0; idx < Math.min(games.length, 10); idx++) {
                    const game = games[idx];
                    const gameName = game.name || 'Unknown';
                    const creatorName = game.creator?.name || 'Unknown';
                    const placeId = game.rootPlaceId || 'N/A';
                    const playing = game.playing?.toLocaleString() || '0';
                    result += `${idx+1}. **${gameName}**\n   👤 ${creatorName} | 🆔 \`${placeId}\` | 👥 ${playing} playing\n\n`;
                }
                await i.editReply(result);
            } catch (err) {
                console.error(err);
                await i.editReply('❌ Search failed. Try using `/robloxgame` with a known Universe ID instead.');
            }
            break;
        }

        // ----- /robloxuserinfo -----
        case 'robloxuserinfo': {
            const username = i.options.getString('username');
            await i.editReply(`🔍 Looking up ${username}...`);
            try {
                const res = await fetch(`https://users.roblox.com/v1/usernames/users`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usernames: [username] })
                });
                const data = await res.json();
                const user = data.data?.[0];
                if (!user) {
                    await i.editReply(`❌ User "${username}" not found`);
                    break;
                }
                const userId = user.id;
                const detailRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
                const details = await detailRes.json();
                e.setTitle(`👤 ${details.name}`)
                 .setDescription(details.displayName ? `Also known as: ${details.displayName}` : '*No display name*')
                 .addFields(
                     { name: '🆔 User ID', value: `\`${details.id}\``, inline: true },
                     { name: '📅 Join Date', value: details.created ? new Date(details.created).toLocaleDateString() : 'Unknown', inline: true },
                     { name: '✅ Verified', value: details.isVerified ? '✅ Yes' : '❌ No', inline: true },
                     { name: '🔗 Profile', value: `[Click here](https://www.roblox.com/users/${details.id}/profile)`, inline: false }
                 )
                 .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${details.id}&width=420&height=420&format=png`);
                await i.editReply({ embeds: [e] });
            } catch (err) {
                console.error(err);
                await i.editReply('❌ User not found or API error.');
            }
            break;
        }

        // ----- /robloxuserid -----
        case 'robloxuserid': {
            const userId = i.options.getString('userid');
            await i.editReply(`🔍 Looking up user ID ${userId}...`);
            try {
                const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
                if (!res.ok) throw new Error('User not found');
                const details = await res.json();
                e.setTitle(`👤 ${details.name}`)
                 .setDescription(details.displayName ? `Also known as: ${details.displayName}` : '*No display name*')
                 .addFields(
                     { name: '🆔 User ID', value: `\`${details.id}\``, inline: true },
                     { name: '📅 Join Date', value: details.created ? new Date(details.created).toLocaleDateString() : 'Unknown', inline: true },
                     { name: '✅ Verified', value: details.isVerified ? '✅ Yes' : '❌ No', inline: true },
                     { name: '🔗 Profile', value: `[Click here](https://www.roblox.com/users/${details.id}/profile)`, inline: false }
                 )
                 .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${details.id}&width=420&height=420&format=png`);
                await i.editReply({ embeds: [e] });
            } catch (err) {
                console.error(err);
                await i.editReply('❌ Invalid user ID or not found.');
            }
            break;
        }

        // ----- /groupinfo -----
        case 'groupinfo': {
            const groupId = i.options.getString('groupid');
            await i.editReply(`🔍 Looking up group ${groupId}...`);
            try {
                const res = await fetch(`https://groups.roblox.com/v1/groups/${groupId}`);
                if (!res.ok) throw new Error('Group not found');
                const group = await res.json();
                e.setTitle(`👥 ${group.name}`)
                 .setDescription(group.description?.slice(0, 200) || '*No description*')
                 .addFields(
                     { name: '🆔 Group ID', value: `\`${group.id}\``, inline: true },
                     { name: '👤 Members', value: group.memberCount?.toLocaleString() || 'Unknown', inline: true },
                     { name: '👑 Owner', value: group.owner ? group.owner.username : 'Unknown', inline: true },
                     { name: '🏷️ Public', value: group.publicEntriesAllowed ? '✅ Yes' : '❌ No', inline: true },
                     { name: '🔗 Link', value: `[Click here](https://www.roblox.com/groups/${group.id})`, inline: false }
                 );
                if (group.emblemUrl) e.setThumbnail(group.emblemUrl);
                await i.editReply({ embeds: [e] });
            } catch (err) {
                console.error(err);
                await i.editReply('❌ Group not found or private.');
            }
            break;
        }

        // ----- /assetinfo -----
        case 'assetinfo': {
            const assetId = i.options.getString('assetid');
            await i.editReply(`🔍 Looking up asset ${assetId}...`);
            try {
                const res = await fetch(`https://economy.roblox.com/v2/assets/${assetId}/details`);
                if (!res.ok) throw new Error('Asset not found');
                const asset = await res.json();
                e.setTitle(`📦 ${asset.Name}`)
                 .setDescription(asset.Description?.slice(0, 200) || '*No description*')
                 .addFields(
                     { name: '🆔 Asset ID', value: `\`${asset.AssetId}\``, inline: true },
                     { name: '👤 Creator', value: asset.Creator?.Name || 'Unknown', inline: true },
                     { name: '💰 Price', value: asset.PriceInRobux ? `${asset.PriceInRobux} Robux` : 'Free', inline: true },
                     { name: '📅 Created', value: asset.Created ? new Date(asset.Created).toLocaleDateString() : 'Unknown', inline: true },
                     { name: '🔗 Link', value: `[Click here](https://www.roblox.com/library/${asset.AssetId})`, inline: false }
                 );
                if (asset.ImageUrl) e.setThumbnail(asset.ImageUrl);
                await i.editReply({ embeds: [e] });
            } catch (err) {
                console.error(err);
                await i.editReply('❌ Asset not found or private.');
            }
            break;
        }

        // ----- /sogme -----
        case 'sogme': {
            const query = i.options.getString('query')?.toLowerCase() || '';
            await i.editReply('🌊 **Searching...**');

            try {
                const res = await fetch('https://mirror.guweh.com/images.json');
                if (!res.ok) throw new Error('Failed to fetch images');
                const images = await res.json();

                let filteredImages = images;
                if (query) {
                    filteredImages = images.filter(img => img.toLowerCase().includes(query));
                    if (!filteredImages.length) {
                        await i.editReply(`❌ No images found for "${query}"`);
                        break;
                    }
                }

                const randomImage = filteredImages[Math.floor(Math.random() * filteredImages.length)];
                const imageUrl = `https://mirror.guweh.com/${encodeURIComponent(randomImage)}`;

                const embed = new EmbedBuilder()
                    .setColor(0x00bfff)
                    .setTitle('🦈 Soggy')
                    .setImage(imageUrl);

                await i.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('Sogme error:', error);
                await i.editReply('❌ Failed to fetch image.');
            }
            break;
        }

        // ----- /whitelist_server -----
        case 'whitelist_server': {
            if (!BOT_ADMINS.includes(i.user.id)) {
                await i.editReply({ embeds: [e.setTitle('❌ Access Denied').setDescription('Only bot owners can use this.')] });
                break;
            }
            const action = i.options.getString('action');
            const guildId = i.options.getString('guild_id').trim();
            const dynamic = loadGuilds();
            if (action === 'add') {
                if (dynamic.includes(guildId) || HARDCODED_GUILDS.includes(guildId)) {
                    e.setTitle('ℹ️ Already whitelisted');
                } else {
                    dynamic.push(guildId);
                    saveGuilds(dynamic);
                    e.setTitle('✅ Server Whitelisted').setDescription(`Added \`${guildId}\``).setColor(0x10b981);
                }
            } else { // remove
                if (HARDCODED_GUILDS.includes(guildId)) {
                    e.setTitle('⚠️ Cannot remove hardcoded guild');
                } else {
                    const idx = dynamic.indexOf(guildId);
                    if (idx === -1) {
                        e.setTitle('❌ Not found');
                    } else {
                        dynamic.splice(idx, 1);
                        saveGuilds(dynamic);
                        e.setTitle('🗑️ Removed').setDescription(`Removed \`${guildId}\``).setColor(0xef4444);
                    }
                }
            }
            await i.editReply({ embeds: [e] });
            break;
        }

        // ----- /whitelist_game -----
        case 'whitelist_game': {
            if (!BOT_ADMINS.includes(i.user.id)) {
                await i.editReply({ embeds: [e.setTitle('❌ Access Denied').setDescription('Only bot owners can manage games.')] });
                break;
            }
            const action = i.options.getString('action');
            const watched = loadWatched();
            if (action === 'list') {
                if (!watched.length) e.setTitle('📺 Watched Games').setDescription('No games being watched.');
                else e.setTitle('📺 Watched Games').setDescription(watched.map((w, idx) => `**${idx+1}. ${w.name || w.universeId}**\nUniverse: \`${w.universeId}\`\nChannel: <#${w.channelId}>\nSubplaces: ${w.subplaces?.length ?? 0}`).join('\n\n').slice(0, 4000));
                await i.editReply({ embeds: [e] });
                break;
            }
            const universeId = i.options.getString('universe_id')?.trim();
            if (!universeId) {
                await i.editReply({ embeds: [e.setTitle('❌ Missing universe_id')] });
                break;
            }
            if (action === 'remove') {
                const idx = watched.findIndex(w => w.universeId === universeId);
                if (idx === -1) {
                    e.setTitle('❌ Not found');
                } else {
                    watched.splice(idx, 1);
                    saveWatched(watched);
                    e.setTitle('🗑️ Game Unwatched');
                }
                await i.editReply({ embeds: [e] });
                break;
            }
            if (action === 'change_channel') {
                const newChan = i.options.getString('channel')?.trim();
                if (!newChan) {
                    e.setTitle('❌ Missing channel');
                    await i.editReply({ embeds: [e] });
                    break;
                }
                const entry = watched.find(w => w.universeId === universeId);
                if (!entry) {
                    e.setTitle('❌ Not watched');
                    await i.editReply({ embeds: [e] });
                    break;
                }
                entry.channelId = newChan;
                saveWatched(watched);
                e.setTitle('🔄 Channel Updated').setDescription(`**${entry.name || universeId}** now alerts in <#${newChan}>`);
                await i.editReply({ embeds: [e] });
                break;
            }
            if (action === 'add') {
                const channelId = i.options.getString('channel')?.trim() || i.channelId;
                if (watched.find(w => w.universeId === universeId)) {
                    e.setTitle('ℹ️ Already watching');
                    await i.editReply({ embeds: [e] });
                    break;
                }
                await i.editReply('⏳ Fetching game info...');
                const game = await getGameInfo(universeId);
                if (!game) {
                    e.setTitle('❌ Game not found');
                    await i.editReply({ embeds: [e] });
                    break;
                }
                const subplaces = await getSubplaces(universeId);
                const newEntry = {
                    universeId,
                    name: game.name,
                    channelId,
                    guildId: i.guildId,
                    lastUpdated: game.updated,
                    addedBy: i.user.id,
                    addedAt: new Date().toISOString(),
                    subplaces: subplaces.map(sp => ({ placeId: sp.id, name: sp.name, lastUpdated: sp.updated }))
                };
                watched.push(newEntry);
                saveWatched(watched);
                e.setTitle('✅ Game Added').setDescription(`Now watching **${game.name}**`).setColor(0x10b981)
                 .setThumbnail(`https://www.roblox.com/asset-thumbnail/image?assetId=${game.rootPlaceId}&width=512&height=512&format=png`)
                 .addFields({ name: 'Universe', value: `\`${universeId}\``, inline: true }, { name: 'Channel', value: `<#${channelId}>`, inline: true }, { name: 'Subplaces', value: `${subplaces.length}`, inline: true });
                await i.editReply({ embeds: [e] });
            }
            break;
        }

        // ----- /request_game -----
        case 'request_game': {
            const universeIdInput = i.options.getString('universe_id');
            const placeIdInput = i.options.getString('place_id');
            if (!universeIdInput && !placeIdInput) {
                await i.editReply({ embeds: [e.setTitle('❌ Missing ID').setDescription('Provide either `universe_id` or `place_id`.')] });
                break;
            }
            let targetUniverseId = universeIdInput;
            let originalPlaceId = null;
            if (placeIdInput) {
                originalPlaceId = placeIdInput;
                await i.editReply('⏳ Resolving place...');
                targetUniverseId = await getUniverseFromPlace(placeIdInput);
                if (!targetUniverseId) {
                    e.setTitle('❌ Invalid Place').setDescription(`Could not find universe for place \`${placeIdInput}\``);
                    await i.editReply({ embeds: [e] });
                    break;
                }
            }
            const watched = loadWatched();
            if (watched.some(w => w.universeId === targetUniverseId)) {
                e.setTitle('ℹ️ Already Watched');
                await i.editReply({ embeds: [e] });
                break;
            }
            const gameInfo = await getGameInfo(targetUniverseId);
            if (!gameInfo) {
                e.setTitle('❌ Game Not Found');
                await i.editReply({ embeds: [e] });
                break;
            }
            const requests = loadRequests();
            if (requests.some(r => r.universeId === targetUniverseId && r.status === 'pending')) {
                e.setTitle('⚠️ Already Requested');
                await i.editReply({ embeds: [e] });
                break;
            }
            const newReq = {
                id: Date.now().toString(),
                universeId: targetUniverseId,
                placeId: originalPlaceId,
                name: gameInfo.name,
                requestedBy: i.user.id,
                requestedAt: new Date().toISOString(),
                status: 'pending'
            };
            requests.push(newReq);
            saveRequests(requests);
            e.setTitle('📨 Game Request Submitted').setDescription(`**${gameInfo.name}** submitted for review.`).setColor(0x06b6d4)
             .addFields({ name: 'Universe ID', value: `\`${targetUniverseId}\``, inline: true }, { name: 'Request ID', value: `\`${newReq.id}\``, inline: true });
            if (originalPlaceId) e.addFields({ name: 'Place ID', value: `\`${originalPlaceId}\``, inline: true });
            await i.editReply({ embeds: [e] });
            // Notify owners
            for (const ownerId of BOT_ADMINS) {
                const owner = await client.users.fetch(ownerId).catch(() => null);
                if (owner) owner.send(`📨 New request: **${gameInfo.name}** (Universe \`${targetUniverseId}\`) by <@${i.user.id}>`).catch(() => {});
            }
            break;
        }

        // ----- /manage_requests -----
        case 'manage_requests': {
            if (!BOT_ADMINS.includes(i.user.id)) {
                await i.editReply({ embeds: [e.setTitle('❌ Access Denied').setDescription('Only bot owners can manage requests.')] });
                break;
            }
            const action = i.options.getString('action');
            const requests = loadRequests();
            const pending = requests.filter(r => r.status === 'pending');
            if (action === 'list') {
                if (!pending.length) e.setTitle('📋 Requests').setDescription('No pending requests.');
                else e.setTitle(`📋 Pending Requests (${pending.length})`).setDescription(pending.map(r => `**${r.name}** (ID: \`${r.id}\`)`).join('\n'));
                await i.editReply({ embeds: [e] });
                break;
            }
            if (action === 'browse') {
                if (!pending.length) {
                    e.setTitle('No pending requests');
                    await i.editReply({ embeds: [e] });
                    break;
                }
                let index = 0;
                const generateEmbed = () => {
                    const req = pending[index];
                    return new EmbedBuilder().setColor(0x06b6d4).setTitle(`Request ${index+1}/${pending.length}`).setDescription(`**Game:** ${req.name}\n**Universe:** \`${req.universeId}\`\n**Requested by:** <@${req.requestedBy}>\n**At:** ${new Date(req.requestedAt).toLocaleString()}`).addFields({ name: 'ID', value: `\`${req.id}\``, inline: true });
                };
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('prev_req').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(pending.length === 1),
                    new ButtonBuilder().setCustomId('next_req').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(pending.length === 1),
                    new ButtonBuilder().setCustomId('approve_req').setLabel('✅ Approve').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('reject_req').setLabel('❌ Reject').setStyle(ButtonStyle.Danger)
                );
                await i.editReply({ embeds: [generateEmbed()], components: [row] });
                const collector = i.channel.createMessageComponentCollector({ filter: btn => btn.user.id === i.user.id, time: 120000 });
                collector.on('collect', async btn => {
                    if (btn.customId === 'prev_req') { index = (index - 1 + pending.length) % pending.length; await btn.update({ embeds: [generateEmbed()], components: [row] }); }
                    else if (btn.customId === 'next_req') { index = (index + 1) % pending.length; await btn.update({ embeds: [generateEmbed()], components: [row] }); }
                    else if (btn.customId === 'approve_req') {
                        const req = pending[index];
                        const watched = loadWatched();
                        if (!watched.some(w => w.universeId === req.universeId)) {
                            const game = await getGameInfo(req.universeId);
                            if (game) {
                                const subplaces = await getSubplaces(req.universeId);
                                watched.push({ universeId: req.universeId, name: game.name, channelId: i.channelId, guildId: i.guildId, lastUpdated: game.updated, addedBy: i.user.id, addedAt: new Date().toISOString(), subplaces: subplaces.map(sp => ({ placeId: sp.id, name: sp.name, lastUpdated: sp.updated })) });
                                saveWatched(watched);
                            }
                        }
                        req.status = 'approved';
                        saveRequests(requests);
                        await btn.update({ embeds: [new EmbedBuilder().setColor(0x10b981).setTitle('✅ Approved').setDescription(`**${req.name}** added to watch list.`)], components: [] });
                        collector.stop();
                    } else if (btn.customId === 'reject_req') {
                        const req = pending[index];
                        req.status = 'rejected';
                        saveRequests(requests);
                        await btn.update({ embeds: [new EmbedBuilder().setColor(0xef4444).setTitle('❌ Rejected').setDescription(`**${req.name}** rejected.`)], components: [] });
                        collector.stop();
                    }
                });
                break;
            }
            if (action === 'approve' || action === 'reject') {
                const reqId = i.options.getString('request_id');
                const request = requests.find(r => r.id === reqId);
                if (!request || request.status !== 'pending') {
                    e.setTitle('❌ Not found or not pending');
                    await i.editReply({ embeds: [e] });
                    break;
                }
                if (action === 'approve') {
                    const watched = loadWatched();
                    if (!watched.some(w => w.universeId === request.universeId)) {
                        const game = await getGameInfo(request.universeId);
                        if (game) {
                            const subplaces = await getSubplaces(request.universeId);
                            watched.push({ universeId: request.universeId, name: game.name, channelId: i.channelId, guildId: i.guildId, lastUpdated: game.updated, addedBy: i.user.id, addedAt: new Date().toISOString(), subplaces: subplaces.map(sp => ({ placeId: sp.id, name: sp.name, lastUpdated: sp.updated })) });
                            saveWatched(watched);
                        }
                    }
                    request.status = 'approved';
                    saveRequests(requests);
                    e.setTitle('✅ Approved').setDescription(`**${request.name}** added to watch list.`).setColor(0x10b981);
                } else {
                    request.status = 'rejected';
                    saveRequests(requests);
                    e.setTitle('❌ Rejected').setDescription(`**${request.name}** rejected.`).setColor(0xef4444);
                }
                await i.editReply({ embeds: [e] });
                const requester = await client.users.fetch(request.requestedBy).catch(() => null);
                if (requester) requester.send(`Your request for **${request.name}** was ${action}ed.`).catch(() => {});
            }
            break;
        }

        // ----- /robloxgame -----
        case 'robloxgame': {
            const id = i.options.getString('id');
            const game = await getGameInfo(id);
            if (game) {
                e.setTitle(`🎮 ${game.name}`)
                 .setURL(`https://www.roblox.com/games/${game.rootPlaceId}`)
                 .addFields(
                     { name: '👥 Playing', value: game.playing?.toLocaleString() ?? 'N/A', inline: true },
                     { name: '🏆 Visits', value: game.visits?.toLocaleString() ?? 'N/A', inline: true },
                     { name: '👤 Creator', value: game.creator?.name ?? 'Unknown', inline: true }
                 );
            } else {
                e.setTitle('❌ Game not found');
            }
            break;
        }

        // ----- /robloxuser -----
        case 'robloxuser': {
            const username = i.options.getString('username');
            const user = await getRobloxUser(username);
            if (user) {
                e.setTitle(`👤 ${user.name}`).setDescription(`ID: ${user.id}\nDisplay: ${user.displayName}`);
            } else {
                e.setTitle('❌ User not found');
            }
            break;
        }

        // ----- /subplaces -----
        case 'subplaces': {
            const uid = i.options.getString('universe_id');
            const subs = await getSubplaces(uid);
            e.setTitle(`Subplaces for ${uid}`).setDescription(subs.length ? subs.map(p => `• ${p.name} (${p.id})`).join('\n').slice(0, 4000) : 'None found');
            break;
        }

        // ----- /brute_link -----
        case 'brute_link': {
            const id = i.options.getString('id');
            const results = await bruteForceRoblox(id);
            e.setTitle(`🔍 Bruteforce for ${id}`).setDescription(Object.entries(results).map(([k,v]) => `${k}: ${v.success ? '✅' : '❌'}`).join('\n'));
            break;
        }

        // ----- /botstats -----
        case 'botstats': {
            const up = Math.floor((Date.now() - startTime) / 1000);
            const d = Math.floor(up / 86400), h = Math.floor((up % 86400) / 3600), m = Math.floor((up % 3600) / 60);
            e.setTitle('🤖 Bot Stats').addFields(
                { name: 'Starts', value: `${botStats.startCount}`, inline: true },
                { name: 'Uptime', value: `${d}d ${h}h ${m}m`, inline: true },
                { name: 'Commands', value: `${commands.length}`, inline: true }
            );
            break;
        }

        // ----- /menu (simple) -----
        case 'menu': {
            e.setTitle('🎛️ Menu').setDescription('Use slash commands directly. Type `/` to see all available commands.');
            await i.editReply({ embeds: [e] });
            break;
        }

        // ----- Cipher commands (all) -----
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
        case 'xor': e.setTitle('XOR').setDescription(`\`${snip(xorCipher(i.options.getString('text'), i.options.getString('key')))}\``); break;
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
        case 'gronsfeld': e.setTitle('Gronsfeld Encode').setDescription(`\`${snip(gronsfeldEncode(i.options.getString('text'), i.options.getString('key')))}\``); break;
        case 'gronsfelddecode': e.setTitle('Gronsfeld Decode').setDescription(`\`${snip(gronsfeldDecode(i.options.getString('text'), i.options.getString('key')))}\``); break;
        case 'autokey': e.setTitle('Autokey Encode').setDescription(`\`${snip(autokeyEncode(i.options.getString('text'), i.options.getString('key')))}\``); break;

        default:
            e.setTitle('ℹ️ Command').setDescription(`/${i.commandName} executed!`);
    }

    if (i.deferred && !i.replied) await i.editReply({ embeds: [e] });
});

// ========== Helpers ==========
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
        gameInfo: `https://games.roblox.com/v1/games?universeIds=${id}`,
        userV1: `https://users.roblox.com/v1/users/${id}`,
        groupV1: `https://groups.roblox.com/v1/groups/${id}`,
    };
    const results = {};
    for (const [name, url] of Object.entries(endpoints)) {
        try {
            const ctrl = new AbortController();
            const tId = setTimeout(() => ctrl.abort(), 5000);
            const res = await fetch(url, { signal: ctrl.signal });
            clearTimeout(tId);
            results[name] = res.ok ? { success: true, data: await res.json() } : { success: false };
        } catch (err) {
            results[name] = { success: false, error: err.message };
        }
    }
    return results;
}

// ============================================
// LOGIN
// ============================================
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN) { console.error('❌ FATAL: DISCORD_TOKEN missing!'); process.exit(1); }
if (!CLIENT_ID) { console.error('❌ FATAL: CLIENT_ID missing!'); process.exit(1); }

client.login(TOKEN);
