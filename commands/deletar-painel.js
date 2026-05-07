const { SlashCommandBuilder } = require('discord.js');
const { deletePanel } = require('../utils/database');
const { buildContainerPayload, asV2Message } = require('../utils/ui');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deletar-painel')
    .setDescription('Deleta um painel de tickets')
    .addStringOption(option =>
      option.setName('id')
        .setDescription('ID do painel para deletar')
        .setRequired(true)),

  async execute(client, interaction) {
    try {
      const guildId = interaction.guildId;
      const panelId = interaction.options.getString('id');

      await deletePanel(guildId, panelId);

      const payload = buildContainerPayload({
        title: 'Painel deletado',
        body: `Painel com ID \`${panelId}\` deletado com sucesso!`,
        accentColor: client.config.defaults.accentColor
      });

      await interaction.reply(asV2Message(payload, { ephemeral: true }));
    } catch (error) {
      logger.error('Erro ao deletar painel:', error);
      let errorMessage = 'Erro ao deletar painel.';
      if (error.message === 'Painel não encontrado') {
        errorMessage = 'Painel não encontrado.';
      } else if (error.message === 'Não é possível excluir o único painel restante') {
        errorMessage = 'Não é possível excluir o único painel restante. Você precisa de pelo menos um painel.';
      }
      const payload = buildContainerPayload({
        title: 'Erro',
        body: errorMessage,
        accentColor: client.config.defaults.accentColor
      });
      await interaction.reply(asV2Message(payload, { ephemeral: true }));
    }
  }
};
