const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const crypto = require('crypto');

// Cipher functions
function rot13(t) { return t.replace(/[A-Za-z]/g, c => String.fromCharCode((c.charCodeAt(0) - (c < 'a' ? 65 : 97) + 13) % 26 + (c < 'a' ? 65 : 97))); }
function atbash(t) { return t.replace(/[A-Za-z]/g, c => String.fromCharCode((c < 'a' ? 90 : 122) - (c.charCodeAt(0) - (c < 'a' ? 65 : 97)))); }
function base64e(t) { return Buffer.from(t).toString('base64'); }
function base64d(t) { return Buffer.from(t, 'base64').toString('utf8'); }
function md5(t) { return crypto.createHash('md5').update(t).digest('hex'); }
function sha256(t) { return crypto.createHash('sha256').update(t).digest('hex'); }
function reverse(t) { return t.split('').reverse().join(''); }
function textToBin(t) { return [...t].map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '); }
function textToHex(t) { return [...t].map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '); }

const morse = { 'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.' };
const morseRev = Object.fromEntries(Object.entries(morse).map(([k, v]) => [v, k]));
function textToMorse(t) { return t.toUpperCase().split(' ').map(w => w.split('').map(c => morse[c] || '?').join(' ')).join(' / '); }
function morseToText(m) { return m.split('/').map(w => w.trim().split(' ').map(l => morseRev[l.trim()] || '?').join('')).join(' '); }

const commands = [
    new SlashCommandBuilder().setName('help').setDescription('Show all commands'),
    new SlashCommandBuilder().setName('rot13').setDescription('ROT13 encode').addStringOption(o => o.setName('text').setRequired(true)),
    new SlashCommandBuilder().setName('atbash').setDescription('Atbash encode').addStringOption(o => o.setName('text').setRequired(true)),
    new SlashCommandBuilder().setName('base64').setDescription('Base64 encode').addStringOption(o => o.setName('text').setRequired(true)),
    new SlashCommandBuilder().setName('base64d').setDescription('Base64 decode').addStringOption(o => o.setName('text').setRequired(true)),
    new SlashCommandBuilder().setName('md5').setDescription('MD5 hash').addStringOption(o => o.setName('text').setRequired(true)),
    new SlashCommandBuilder().setName('sha256').setDescription('SHA256 hash').addStringOption(o => o.setName('text').setRequired(true)),
    new SlashCommandBuilder().setName('reverse').setDescription('Reverse text').addStringOption(o => o.setName('text').setRequired(true)),
    new SlashCommandBuilder().setName('bin').setDescription('Text to binary').addStringOption(o => o.setName('text').setRequired(true)),
    new SlashCommandBuilder().setName('hex').setDescription('Text to hex').addStringOption(o => o.setName('text').setRequired(true)),
    new SlashCommandBuilder().setName('morse').setDescription('Text to Morse').addStringOption(o => o.setName('text').setRequired(true)),
    new SlashCommandBuilder().setName('morsed').setDescription('Morse to text').addStringOption(o => o.setName('morse').setRequired(true)),
    new SlashCommandBuilder().setName('menu').setDescription('Interactive menu'),
];

const TOKEN = process.env.DISCORD_TOKEN || 'YOUR_TOKEN_HERE';
const CLIENT_ID = process.env.CLIENT_ID || 'YOUR_CLIENT_ID_HERE';

client.once('ready', async () => {
    console.log(`✅ Qarmander online as ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands.map(c => c.toJSON()) });
});

client.on('interactionCreate', async i => {
    if (!i.isCommand()) return;
    await i.deferReply();
    const e = new EmbedBuilder().setColor(0x7c3aed);
    let r = '';
    switch(i.commandName) {
        case 'help': e.setTitle('🔐 Qarmander Commands').addFields({ name: 'Commands', value: '/rot13, /atbash, /base64, /md5, /sha256, /reverse, /bin, /hex, /morse, /menu' }); break;
        case 'rot13': r = rot13(i.options.getString('text')); e.setTitle('ROT13').setDescription(`\`${r}\``); break;
        case 'atbash': r = atbash(i.options.getString('text')); e.setTitle('Atbash').setDescription(`\`${r}\``); break;
        case 'base64': r = base64e(i.options.getString('text')); e.setTitle('Base64').setDescription(`\`${r}\``); break;
        case 'base64d': r = base64d(i.options.getString('text')); e.setTitle('Base64 Decode').setDescription(`\`${r}\``); break;
        case 'md5': r = md5(i.options.getString('text')); e.setTitle('MD5').setDescription(`\`${r}\``); break;
        case 'sha256': r = sha256(i.options.getString('text')); e.setTitle('SHA256').setDescription(`\`${r}\``); break;
        case 'reverse': r = reverse(i.options.getString('text')); e.setTitle('Reversed').setDescription(`\`${r}\``); break;
        case 'bin': r = textToBin(i.options.getString('text')); e.setTitle('Binary').setDescription(`\`${r}\``); break;
        case 'hex': r = textToHex(i.options.getString('text')); e.setTitle('Hex').setDescription(`\`${r}\``); break;
        case 'morse': r = textToMorse(i.options.getString('text')); e.setTitle('Morse').setDescription(`\`${r}\``); break;
        case 'morsed': r = morseToText(i.options.getString('morse')); e.setTitle('Morse Decode').setDescription(`\`${r}\``); break;
        case 'menu': 
            const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('menu').setPlaceholder('Choose cipher').addOptions([{ label: 'ROT13', value: 'rot13' }, { label: 'Atbash', value: 'atbash' }, { label: 'Base64', value: 'base64' }, { label: 'Reverse', value: 'reverse' }, { label: 'Morse', value: 'morse' }]));
            await i.editReply({ embeds: [e.setTitle('Interactive Menu').setDescription('Select a cipher, then type your message')], components: [row] });
            const filter = m => m.user.id === i.user.id;
            const collector = i.channel.createMessageComponentCollector({ filter, time: 30000, max: 1 });
            collector.on('collect', async menu => {
                await menu.reply({ content: 'Type your message:', ephemeral: true });
                const msgCollector = i.channel.createMessageCollector({ filter, time: 30000, max: 1 });
                msgCollector.on('collect', async msg => {
                    let res = '';
                    if (menu.values[0] === 'rot13') res = rot13(msg.content);
                    else if (menu.values[0] === 'atbash') res = atbash(msg.content);
                    else if (menu.values[0] === 'base64') res = base64e(msg.content);
                    else if (menu.values[0] === 'reverse') res = reverse(msg.content);
                    else if (menu.values[0] === 'morse') res = textToMorse(msg.content);
                    await i.followUp({ embeds: [new EmbedBuilder().setColor(0x7c3aed).setTitle(menu.values[0].toUpperCase()).setDescription(`\`${res}\``)] });
                });
            });
            return;
    }
    await i.editReply({ embeds: [e] });
});

client.login(TOKEN);