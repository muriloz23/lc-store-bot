const { Client, Collection, GatewayIntentBits, Partials, ActivityType } = require('discord.js');
const config = require('./config');
const { ensureBaseData } = require('./utils/database');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const { registerSlashCommands } = require('./handlers/registerCommands');
const logger = require('./utils/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

client.commands = new Collection();
client.config = config;
client.launchTime = Date.now();

async function boot() {
  try {
    await ensureBaseData();
    await loadCommands(client);
    await loadEvents(client);
    await registerSlashCommands(client);

    client.once('ready', () => {
      const activityType = ActivityType[config.bot.activityType] ?? ActivityType.Watching;

      client.user.setPresence({
        status: config.bot.status,
        activities: [
          {
            name: config.bot.activityName,
            type: activityType
          }
        ]
      });

      logger.info(`Bot online como ${client.user.tag}`);
    });

    await client.login(config.token);
  } catch (error) {
    logger.error('Falha ao iniciar o bot.', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection detectada.', error);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception detectada.', error);
});

boot();
