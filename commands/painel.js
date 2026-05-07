const { SlashCommandBuilder } = require('discord.js');
const { getGuildData } = require('../utils/database');
const { canManagePanel } = require('../utils/permissions');
const { buildHomePanel } = require('../utils/managementPanel');
const { buildContainerPayload, asV2Message } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abre o painel central de gerenciamento do bot.'),

  async execute(client, interaction) {
    const guildData = await getGuildData(interaction.guild.id);

    if (!(await canManagePanel(interaction, guildData))) {
      const payload = buildContainerPayload({
        title: 'Acesso negado',
        body: 'Você não tem permissão para abrir o painel de gerenciamento.',
        accentColor: guildData.panel.accentColor
      });

      return interaction.reply(asV2Message(payload, { ephemeral: true }));
    }

    return interaction.reply(asV2Message(buildHomePanel(guildData, client), { ephemeral: true }));
  }
};
