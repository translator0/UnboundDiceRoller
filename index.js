const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;

const VALID_DICE = [4, 6, 8, 10, 12, 20, 100];

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('roll')
      .setDescription('Roll dice! e.g. /roll d20 or /roll d6 10 +5')
      .addStringOption(option =>
        option
          .setName('dice')
          .setDescription('Dice type: d4, d6, d8, d10, d12, d20, d100')
          .setRequired(true)
          .addChoices(
            { name: 'd4', value: 'd4' },
            { name: 'd6', value: 'd6' },
            { name: 'd8', value: 'd8' },
            { name: 'd10', value: 'd10' },
            { name: 'd12', value: 'd12' },
            { name: 'd20', value: 'd20' },
            { name: 'd100', value: 'd100' },
          )
      )
      .addIntegerOption(option =>
        option
          .setName('count')
          .setDescription('How many dice to roll (default: 1, max: 500)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(500)
      )
      .addIntegerOption(option =>
        option
          .setName('modifier')
          .setDescription('Add or subtract from the total, e.g. 5 or -3')
          .setRequired(false)
      ),
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);

  try {
    console.log('Registering slash commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('Slash commands registered!');
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function formatResults(diceType, rolls, modifier) {
  const rollTotal = rolls.reduce((a, b) => a + b, 0);
  const finalTotal = rollTotal + modifier;
  const count = rolls.length;
  const lines = rolls.map((r, i) => `  Roll ${i + 1}: ${r}`);

  const chunks = [];
  let current = `Rolling ${count}x ${diceType}${modifier !== 0 ? (modifier > 0 ? ` +${modifier}` : ` ${modifier}`) : ''}\n\n`;

  for (const line of lines) {
    if ((current + line + '\n').length > 1800) {
      chunks.push(current);
      current = '';
    }
    current += line + '\n';
  }

  current += `\n--------------------\n`;
  current += `Dice Total: ${rollTotal}\n`;

  if (modifier !== 0) {
    current += `Modifier: ${modifier > 0 ? '+' : ''}${modifier}\n`;
    current += `Final Total: ${finalTotal}\n`;
  } else {
    current += `Total: ${rollTotal}\n`;
  }

  if (count > 1) {
    const min = Math.min(...rolls);
    const max = Math.max(...rolls);
    const avg = (rollTotal / count).toFixed(2);
    current += `Average: ${avg} | Min: ${min} | Max: ${max}\n`;
  }

  chunks.push(current);
  return chunks;
}

client.on('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'roll') return;

  const diceStr = interaction.options.getString('dice');
  const count = interaction.options.getInteger('count') ?? 1;
  const modifier = interaction.options.getInteger('modifier') ?? 0;
  const sides = parseInt(diceStr.slice(1));

  if (!VALID_DICE.includes(sides)) {
    return interaction.reply({
      content: `Invalid dice type "${diceStr}".`,
      ephemeral: true,
    });
  }

  const rolls = Array.from({ length: count }, () => rollDie(sides));
  const chunks = formatResults(diceStr, rolls, modifier);

  await interaction.deferReply();
  await interaction.editReply(chunks[0]);
  for (let i = 1; i < chunks.length; i++) {
    await interaction.followUp(chunks[i]);
  }
});

registerCommands().then(() => {
  client.login(TOKEN);
});