const { SlashCommandBuilder } = require('discord.js');
const { buildContainerPayload, asV2Message } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Mostra a latência atual do bot.'),

  async execute(client, interaction) {
    const apiPing = Math.round(client.ws.ping || 0);
    const uptime = Math.floor((Date.now() - client.launchTime) / 1000);

    const payload = buildContainerPayload({
      title: 'Status do bot',
      body: [`**Gateway:** ${apiPing}ms`, `**Uptime:** ${uptime}s`].join('\n'),
      accentColor: client.config.defaults.accentColor
    });

    await interaction.reply(asV2Message(payload, { ephemeral: true }));
  }
};
