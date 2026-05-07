const { SlashCommandBuilder } = require('discord.js');
const { getSystemData, saveSystemData } = require('../utils/database');
const { hashPassword } = require('../utils/helpers');
const { buildContainerPayload, asV2Message } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setdono')
    .setDescription('Define o dono do bot e uma senha única. Só pode ser usado uma vez.')
    .addStringOption((option) =>
      option
        .setName('senha')
        .setDescription('Senha única para recuperar o dono depois')
        .setRequired(true)
        .setMinLength(6)
        .setMaxLength(100)
    ),

  async execute(client, interaction) {
    const system = await getSystemData();

    if (system.ownerId && system.ownerPasswordHash) {
      const payload = buildContainerPayload({
        title: 'Dono já definido',
        body: 'O dono do bot já foi definido. Use `/recuperar` se precisar retomar a posse.',
        accentColor: client.config.defaults.accentColor
      });

      return interaction.reply(asV2Message(payload, { ephemeral: true }));
    }

    const password = interaction.options.getString('senha', true);
    system.ownerId = interaction.user.id;
    system.ownerPasswordHash = hashPassword(password, client.config.security.ownerPasswordSalt);
    system.ownerCreatedAt = new Date().toISOString();

    await saveSystemData(system);

    const payload = buildContainerPayload({
      title: 'Dono configurado',
      body: `Dono definido com sucesso como <@${interaction.user.id}>. Guarde a senha com cuidado.`,
      accentColor: client.config.defaults.accentColor
    });

    await interaction.reply(asV2Message(payload, {
      ephemeral: true,
      allowedMentions: { users: [interaction.user.id] }
    }));
  }
};
