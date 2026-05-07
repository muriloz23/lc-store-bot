const { SlashCommandBuilder } = require('discord.js');
const { deletePanel } = require('../utils/database');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deletar-painel')
    .setDescription('Deleta um painel de tickets')
    .addStringOption(option =>
      option.setName('id')
        .setDescription('ID do painel para deletar')
        .setRequired(true)),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId;
      const panelId = interaction.options.getString('id');

      await deletePanel(guildId, panelId);

      await interaction.editReply(`✅ Painel com ID \`${panelId}\` deletado com sucesso!`);
    } catch (error) {
      logger.error('Erro ao deletar painel:', error);
      if (error.message === 'Painel não encontrado') {
        await interaction.editReply('❌ Painel não encontrado.');
      } else if (error.message === 'Não é possível excluir o único painel restante') {
        await interaction.editReply('❌ Não é possível excluir o único painel restante. Você precisa de pelo menos um painel.');
      } else {
        await interaction.editReply('Erro ao deletar painel.');
      }
    }
  }
};
