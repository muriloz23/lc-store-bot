const { REST, Routes } = require('discord.js');
const logger = require('../utils/logger');

async function registerSlashCommands(client) {
  const body = [...client.commands.values()].map((command) => command.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(client.config.token);

  try {
    if (client.config.guildId) {
      await rest.put(
        Routes.applicationGuildCommands(client.config.clientId, client.config.guildId),
        { body }
      );
      logger.info(`Slash commands registrados na guild ${client.config.guildId}.`);
      return;
    }

    await rest.put(Routes.applicationCommands(client.config.clientId), { body });
    logger.info('Slash commands registrados globalmente.');
  } catch (error) {
    logger.error('Falha ao registrar slash commands.', error);
    throw error;
  }
}

module.exports = { registerSlashCommands };
