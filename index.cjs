const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

const PREFIX = '!';

client.once('ready', () => {
    console.log(`\x1b[32m[READY]\x1b[0m Zalogowano jako ${client.user.tag}`);
    client.user.setActivity('Nowy Bot v1.0', { type: 2 }); // Listening
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'ping') {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🏓 Pong!')
            .setDescription(`Opóźnienie bota wynosi: **${Math.round(client.ws.ping)}ms**`)
            .setTimestamp()
            .setFooter({ text: 'nowy_bot' });

        await message.reply({ embeds: [embed] });
    }

    if (command === 'pomoc') {
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('📚 Lista komend')
            .addFields(
                { name: '!ping', value: 'Sprawdza opóźnienie bota', inline: true },
                { name: '!pomoc', value: 'Wyświetla tę listę', inline: true }
            )
            .setFooter({ text: 'Witaj w nowym bocie!' });

        await message.reply({ embeds: [embed] });
    }
});

client.login(process.env.TOKEN).catch(err => {
    console.error('\x1b[31m[ERROR]\x1b[0m Nie udało się zalogować. Sprawdź TOKEN w pliku .env');
});
