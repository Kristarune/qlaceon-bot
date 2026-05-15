/**
 * ╔══════════════════════════════════════════════════════╗
 * ║           QARMANDER — REPLIT KEEP-ALIVE              ║
 * ║  Pings the bot's built-in HTTP server every minute   ║
 * ║  so Replit never puts it to sleep.   
 * ║ being real honest here this is fucking well made
 * ║                                                      ║
 * ║  HOW TO USE:                                         ║
 * ║  1. Run this file alongside your bot:                ║
 * ║       node keep_alive.js                             ║
 * ║  OR add to package.json scripts:                     ║
 * ║       "start": "node qarmander-bot.js & node keep_alive.js" ║
 * ║                                                      ║
 * ║  2. (Optional but recommended) Also paste your       ║
 * ║     Replit URL into UptimeRobot (uptimerobot.com)    ║
 * ║     to ping it from outside every 5 min — free tier  ║
 * ║     is enough.                                       ║
 * ╚══════════════════════════════════════════════════════╝
 */

const http  = require('http');
const https = require('https');

// ── Config ────────────────────────────────────────────────────────────────────

// The bot's own local server (already running inside qarmander-bot.js on port 5000)
const LOCAL_URL = 'http://127.0.0.1:5000/';

// (Optional) Your public Replit URL — paste it here to also ping from outside.
// Example: 'https://qarmander.yourname.repl.co'
// Leave as null to skip the external ping.
const REPLIT_URL = process.env.REPLIT_URL || https://4b103412-9af9-41d0-a283-4535129939fb-00-7eqpa0s00aho.worf.replit.dev/;

// How often to ping (milliseconds). 60 seconds is safe — Replit sleeps after ~30 min idle.
const PING_INTERVAL_MS = 45.000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function timestamp() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function ping(url) {
    return new Promise((resolve) => {
        const lib     = url.startsWith('https') ? https : http;
        const timeout = setTimeout(() => resolve({ ok: false, status: 0, ms: -1, url }), 8000);

        const start = Date.now();
        const req   = lib.get(url, (res) => {
            clearTimeout(timeout);
            res.resume(); // drain response body
            resolve({ ok: res.statusCode < 400, status: res.statusCode, ms: Date.now() - start, url });
        });

        req.on('error', (err) => {
            clearTimeout(timeout);
            resolve({ ok: false, status: 0, ms: Date.now() - start, url, error: err.message });
        });

        req.end();
    });
}

// ── Ping loop ─────────────────────────────────────────────────────────────────

let pingCount = 0;

async function runPing() {
    pingCount++;
    const targets = [LOCAL_URL, REPLIT_URL].filter(Boolean);
    const results = await Promise.all(targets.map(ping));

    for (const r of results) {
        const icon   = r.ok ? '✅' : '❌';
        const source = r.url === LOCAL_URL ? 'local' : 'replit';
        const detail = r.ok
            ? `${r.status} — ${r.ms}ms`
            : r.error ? `error: ${r.error}` : `HTTP ${r.status}`;

        console.log(`[${timestamp()}] ${icon} ping #${pingCount} (${source}) → ${detail}`);
    }
}

// ── Startup ───────────────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════╗');
console.log('║   Qarmander Keep-Alive  started      ║');
console.log(`║   Pinging every ${PING_INTERVAL_MS / 1000}s                  ║`);
console.log(`║   Local  : ${LOCAL_URL.padEnd(26)}║`);
console.log(`║   Replit : ${(REPLIT_URL ?? 'not set').padEnd(26)}║`);
console.log('╚══════════════════════════════════════╝\n');

// Ping immediately, then on interval
runPing();
setInterval(runPing, PING_INTERVAL_MS);
