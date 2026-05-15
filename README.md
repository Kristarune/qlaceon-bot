
🔥 Qarmander Bot - Collaborator Guide

📖 Table of Contents

· Bot Commands
· Keeping the Bot Alive on GitHub Actions
· Pros & Cons
· Troubleshooting

---

🤖 Bot Commands

🎮 Roblox Commands

Command Description Example
/robloxgame Look up a Roblox game by Universe ID /robloxgame id:123456789
/robloxuser Look up a Roblox user by username /robloxuser username:RobloxUser
/brute_link Scan a Roblox ID against all APIs /brute_link id:123456789
/subplaces List all subplaces in a universe /subplaces universe_id:123456789

👑 Admin Commands (spanishrobey & gasheper only)

Command Description
/whitelist_server Add/remove servers from whitelist
/whitelist_game Add/remove games to monitor

🔐 Cipher Commands (40+ total)

Basic: /rot13, /rot47, /atbash, /reverse, /xor

Encoding: /base64, /base64d, /bin, /bindecode, /hex, /hexdecode, /octal, /octaldecode, /ascii, /asciidecode, /urlencode, /urldecode, /htmlencode, /htmldecode

Hashing: /md5, /sha1, /sha256, /sha512

Classic Ciphers: /caesar, /caesarbf, /vigenere, /vigdecode, /beaufort, /affine, /affinedecode, /gronsfeld, /gronsfelddecode, /autokey

Transposition: /railfence, /railfencedecode, /scytale, /scytaledecode, /columnar, /columnardecode

Other: /morse, /morsedecode, /polybius, /polybiusdecode, /baconian, /baconiandecode, /nato, /braille, /t9, /phone, /tapcode, /tapcodedecode

Utilities: /help, /menu, /botstats

---

🔄 Keeping the Bot Alive on GitHub Actions

How It Works

The bot runs in a loop that automatically restarts it if it crashes. GitHub Actions runs this for up to 6 hours, then the schedule triggers a new run.

Current Setup (Already Working)

Workflow file: .github/workflows/bot-24-7.yml

```yaml
name: Qarmander Bot 24/7

on:
  workflow_dispatch:
  schedule:
    - cron: "*/5 * * * *"

jobs:
  bot:
    runs-on: ubuntu-latest
    timeout-minutes: 355
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - run: npm install discord.js
      
      - name: Create .env
        run: |
          echo "DISCORD_TOKEN=${{ secrets.DISCORD_TOKEN }}" > Sacred-Stuff.env
          echo "CLIENT_ID=${{ secrets.CLIENT_ID }}" >> Sacred-Stuff.env
      
      - name: Run bot 24/7
        run: |
          while true; do
            echo "🟢 Bot online - $(date)"
            node index.js
            echo "🔴 Bot stopped, restarting in 5 seconds..."
            sleep 5
          done
```

What Happens Automatically

Event What the bot does
Bot crashes Restarts in 5 seconds
Bot runs for 6 hours GitHub stops it, next scheduled run starts it again (every 5 minutes)
Code is pushed Next run uses new code
Manual trigger Run instantly from Actions tab

How to Manually Restart

1. Go to Actions tab in GitHub repo
2. Click "Qarmander Bot 24/7" on the left
3. Click "Run workflow" button
4. Select "Run workflow" again

Environment Variables (Already Set)

These secrets are configured in Settings → Secrets and variables → Actions → Repository secrets:

Secret Status
DISCORD_TOKEN ✅ Set
CLIENT_ID ✅ Set

If the Bot Stops Unexpectedly

Check the last run:

1. Go to Actions tab
2. Click on the most recent workflow run
3. Look for error messages in the logs

Common fixes:

```bash
# If token expired - reset token in Discord Developer Portal
# Then update the DISCORD_TOKEN secret in GitHub Settings

# If rate limited - wait 5 minutes, bot will restart automatically

# If code error - push fix to GitHub, next run uses new code
```

---

📊 Pros & Cons of Qarmander Bot

✅ PROS

Category Benefit
Features 40+ cipher commands - most complete cipher bot on Discord
Roblox Game monitoring, subplace tracking, API brute forcing
Auto-Restart Bot restarts automatically on crash
Free Runs completely free on GitHub Actions
No Setup Collaborators just need Discord permissions
Slash Commands Easy to use with auto-complete
Whitelist Only authorized servers can use it
Interactive /menu command for easy cipher selection
Self-Contained Single file, easy to modify
Real-Time Game watcher checks every 5 minutes

❌ CONS

Category Issue
6-Hour Limit GitHub Actions stops every 6 hours (5 min downtime)
Rate Limits Discord API: 90 commands per minute
No 24/7 Small gaps between GitHub Actions runs
JSON Storage Can get large with many watched games
Admin Only Only spanishrobey & gasheper can whitelist
Manual Whitelist Need to manually add each server

🆚 Comparison

Feature Qarmander Most Bots
Cipher Commands 40+ 5-15
Roblox Monitoring ✅ ❌
Subplace Tracking ✅ ❌
Free Hosting ✅ Varies
Auto-Restart ✅ ❌
Interactive Menu ✅ Rare
Whitelist System ✅ Rare

---

🔧 Troubleshooting

Bot stops responding

Check if workflow is running:

1. Go to Actions tab
2. See if last run was successful
3. If failed, check logs

"An invalid token was provided"

Fix:

```bash
1. Go to Discord Developer Portal
2. Reset bot token
3. Update DISCORD_TOKEN secret in GitHub Settings
4. Run workflow manually
```

Bot not in server

Fix:

```bash
# Re-invite bot using OAuth2 URL from Discord Developer Portal
# Make sure permissions include: Send Messages, Embed Links, Use Slash Commands
```

Commands not showing up

Fix:

```bash
# Wait 5-10 minutes after bot starts
# Slash commands sync automatically
# Or kick and re-invite the bot
```

Workflow not running

Fix:

```bash
1. Go to Actions tab
2. Click "Qarmander Bot 24/7"
3. Click "Enable workflow" if disabled
4. Click "Run workflow" manually
```

Memory or timeout issues

Fix - reduce watch interval (in index.js):

```javascript
// Change from 5 minutes to 10 minutes
const WATCH_INTERVAL = 10 * 60 * 1000;
```

---

📝 Quick Commands Reference

For Regular Users

```bash
/help           # See all commands
/menu           # Open interactive cipher menu
/botstats       # See bot uptime and stats
/robloxgame     # Look up Roblox game
/subplaces      # List game subplaces
```

For Admins (spanishrobey & gasheper)

```bash
/whitelist_server action:add guild_id:123456789
/whitelist_server action:remove guild_id:123456789
/whitelist_game action:add universe_id:123456789 channel:#alerts
/whitelist_game action:list
/whitelist_game action:remove universe_id:123456789
```

---

🔗 Useful Links

· Discord Developer Portal
· GitHub Actions Status
· Repository Actions Tab

---

📞 Bot Status Check

To see if bot is running:

1. Go to Actions tab
2. Look for green checkmark ✅ on most recent run
3. Or try a command in Discord

The bot automatically: ✅ Starts every 5 minutes ✅ Restarts on crash ✅ Runs for 6 hours per cycle

---

🎉 The bot runs automatically - no manual intervention needed!
