const { SlashCommandBuilder } = require('discord.js');
const { getSystemData, saveSystemData } = require('../utils/database');
const { hashPassword } = require('../utils/helpers');
const { buildContainerPayload, asV2Message } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('recuperar')
    .setDescription('Recupera a posse do bot usando a senha criada em /setdono.')
    .addStringOption((option) =>
      option
        .setName('senha')
        .setDescription('Senha criada no /setdono')
        .setRequired(true)
        .setMinLength(6)
        .setMaxLength(100)
    ),

  async execute(client, interaction) {
    const system = await getSystemData();
    const password = interaction.options.getString('senha', true);
    const hash = hashPassword(password, client.config.security.ownerPasswordSalt);

    if (!system.ownerPasswordHash) {
      const payload = buildContainerPayload({
        title: 'Sem dono configurado',
        body: 'Nenhum dono foi configurado ainda. Use `/setdono` primeiro.',
        accentColor: client.config.defaults.accentColor
      });

      return interaction.reply(asV2Message(payload, { ephemeral: true }));
    }

    if (hash !== system.ownerPasswordHash) {
      const payload = buildContainerPayload({
        title: 'Senha inválida',
        body: 'A senha informada não confere com a senha cadastrada no sistema.',
        accentColor: client.config.defaults.accentColor
      });

      return interaction.reply(asV2Message(payload, { ephemeral: true }));
    }

    system.ownerId = interaction.user.id;
    system.ownerRecoveredAt = new Date().toISOString();
    await saveSystemData(system);

    const payload = buildContainerPayload({
      title: 'Posse recuperada',
      body: `A posse do bot foi recuperada com sucesso por <@${interaction.user.id}>.`,
      accentColor: client.config.defaults.accentColor
    });

    await interaction.reply(asV2Message(payload, {
      ephemeral: true,
      allowedMentions: { users: [interaction.user.id] }
    }));
  }
};
