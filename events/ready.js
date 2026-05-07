const { Events } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client, readyClient) {
    logger.info(`Sessão iniciada com ${readyClient.user.tag} (${readyClient.user.id})`);
  }
};
