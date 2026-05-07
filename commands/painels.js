const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { listPanels } = require('../utils/database');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painels')
    .setDescription('Lista todos os painéis configurados'),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId;
      const panels = await listPanels(guildId);

      if (panels.length === 0) {
        return await interaction.editReply('Nenhum painel configurado.');
      }

      const panelList = panels.map((panel, index) => {
        return `**${index + 1}. ${panel.name}** (\`${panel.id}\`)
   Título: ${panel.title}
   Botões: ${panel.buttons.length}
   Menus: ${panel.selectMenus.length}`;
      }).join('\n\n');

      await interaction.editReply(`📋 **Painéis configurados:**\n\n${panelList}`);
    } catch (error) {
      logger.error('Erro ao listar painéis:', error);
      await interaction.editReply('Erro ao listar painéis.');
    }
  }
};
