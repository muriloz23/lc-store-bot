const { SlashCommandBuilder } = require('discord.js');
const { createPanel } = require('../utils/database');
const { buildContainerPayload, asV2Message } = require('../utils/ui');
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

  async execute(client, interaction) {
    try {
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

      const payload = buildContainerPayload({
        title: 'Painel criado',
        body: `Painel "${name}" criado com sucesso! ID: \`${newPanel.id}\``,
        accentColor: client.config.defaults.accentColor
      });

      await interaction.reply(asV2Message(payload, { ephemeral: true }));
    } catch (error) {
      logger.error('Erro ao criar painel:', error);
      const payload = buildContainerPayload({
        title: 'Erro',
        body: 'Erro ao criar painel.',
        accentColor: client.config.defaults.accentColor
      });
      await interaction.reply(asV2Message(payload, { ephemeral: true }));
    }
  }
};
