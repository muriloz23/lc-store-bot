const { SlashCommandBuilder } = require('discord.js');
const { updatePanel } = require('../utils/database');
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

  async execute(interaction) {
    try {
      await interaction.deferReply();

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
        return await interaction.editReply('❌ Você precisa fornecer pelo menos um campo para editar.');
      }

      const updatedPanel = await updatePanel(guildId, panelId, updateData);

      await interaction.editReply(`✅ Painel "${updatedPanel.name}" atualizado com sucesso!`);
    } catch (error) {
      logger.error('Erro ao editar painel:', error);
      if (error.message === 'Painel não encontrado') {
        await interaction.editReply('❌ Painel não encontrado.');
      } else {
        await interaction.editReply('Erro ao editar painel.');
      }
    }
  }
};
