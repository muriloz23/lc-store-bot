const { SlashCommandBuilder } = require('discord.js');
const { updatePanel } = require('../utils/database');
const { buildContainerPayload, asV2Message } = require('../utils/ui');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editar-painel')
    .setDescription('Edita um painel existente')
    .addStringOption(option =>
      option.setName('id')
        .setDescription('ID do painel para editar')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('nome')
        .setDescription('Novo nome do painel')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('titulo')
        .setDescription('Novo título do painel')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('descricao')
        .setDescription('Nova descrição do painel')
        .setRequired(false)),

  async execute(client, interaction) {
    try {
      const guildId = interaction.guildId;
      const panelId = interaction.options.getString('id');
      const name = interaction.options.getString('nome');
      const title = interaction.options.getString('titulo');
      const description = interaction.options.getString('descricao');

      const updateData = {};
      if (name) updateData.name = name;
      if (title) updateData.title = title;
      if (description) updateData.description = description;

      if (Object.keys(updateData).length === 0) {
        const payload = buildContainerPayload({
          title: 'Erro',
          body: 'Você precisa fornecer pelo menos um campo para editar.',
          accentColor: client.config.defaults.accentColor
        });
        return await interaction.reply(asV2Message(payload, { ephemeral: true }));
      }

      const updatedPanel = await updatePanel(guildId, panelId, updateData);

      const payload = buildContainerPayload({
        title: 'Painel atualizado',
        body: `Painel "${updatedPanel.name}" atualizado com sucesso!`,
        accentColor: client.config.defaults.accentColor
      });

      await interaction.reply(asV2Message(payload, { ephemeral: true }));
    } catch (error) {
      logger.error('Erro ao editar painel:', error);
      let errorMessage = 'Erro ao editar painel.';
      if (error.message === 'Painel não encontrado') {
        errorMessage = 'Painel não encontrado.';
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
