const { SlashCommandBuilder } = require('discord.js');
const { createPanel } = require('../utils/database');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('criar-painel')
    .setDescription('Cria um novo painel de tickets')
    .addStringOption(option =>
      option.setName('id')
        .setDescription('ID único do painel (ex: compras)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('nome')
        .setDescription('Nome do painel (ex: Compras)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('titulo')
        .setDescription('Título do painel')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('descricao')
        .setDescription('Descrição do painel')
        .setRequired(false)),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const guildId = interaction.guildId;
      const id = interaction.options.getString('id');
      const name = interaction.options.getString('nome');
      const title = interaction.options.getString('titulo') || 'Painel de Tickets';
      const description = interaction.options.getString('descricao') || 'Clique abaixo para abrir um ticket';

      const newPanel = await createPanel(guildId, {
        id,
        name,
        title,
        description
      });

      await interaction.editReply(`✅ Painel "${name}" criado com sucesso! ID: \`${newPanel.id}\``);
    } catch (error) {
      logger.error('Erro ao criar painel:', error);
      await interaction.editReply('Erro ao criar painel.');
    }
  }
};
