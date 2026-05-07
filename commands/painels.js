const { SlashCommandBuilder } = require('discord.js');
const { listPanels } = require('../utils/database');
const { buildContainerPayload, asV2Message } = require('../utils/ui');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('painels')
    .setDescription('Lista todos os painéis configurados'),

  async execute(client, interaction) {
    try {
      const guildId = interaction.guildId;
      const panels = await listPanels(guildId);

      if (panels.length === 0) {
        const payload = buildContainerPayload({
          title: 'Painéis',
          body: 'Nenhum painel configurado.',
          accentColor: client.config.defaults.accentColor
        });
        return await interaction.reply(asV2Message(payload, { ephemeral: true }));
      }

      const panelList = panels.map((panel, index) => {
        return `**${index + 1}. ${panel.name}** (\`${panel.id}\`)
   Título: ${panel.title}
   Botões: ${panel.buttons.length}
   Menus: ${panel.selectMenus.length}`;
      }).join('\n\n');

      const payload = buildContainerPayload({
        title: 'Painéis configurados',
        body: panelList,
        accentColor: client.config.defaults.accentColor
      });

      await interaction.reply(asV2Message(payload, { ephemeral: true }));
    } catch (error) {
      logger.error('Erro ao listar painéis:', error);
      const payload = buildContainerPayload({
        title: 'Erro',
        body: 'Erro ao listar painéis.',
        accentColor: client.config.defaults.accentColor
      });
      await interaction.reply(asV2Message(payload, { ephemeral: true }));
    }
  }
};
