const fs = require('node:fs');
const path = require('node:path');
const logger = require('../utils/logger');

async function loadCommands(client) {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const files = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

  for (const file of files) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if (!command?.data || typeof command.execute !== 'function') {
      logger.warn(`Comando ignorado: ${file}`);
      continue;
    }

    client.commands.set(command.data.name, command);
  }

  logger.info(`${client.commands.size} comando(s) carregado(s).`);
}

module.exports = { loadCommands };
