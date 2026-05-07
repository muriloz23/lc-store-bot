const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ContainerBuilder
} = require('discord.js');

const logger = require('./logger');
const {
  createTicketRecord,
  getGuildData,
  incrementTicketCounter,
  updateTicket,
  getSystemData,
  setLastPanelMessage
} = require('./database');
const { chunkArray } = require('./helpers');
const { createTranscriptFile } = require('./transcript');
const { buildContainerPayload, asV2Message } = require('./ui');

function buildGalleryComponent(guildData) {
  const items = [];

  if (guildData.panel.bannerUrl) {
    items.push({
      media: { url: guildData.panel.bannerUrl },
      description: 'Banner do painel'
    });
  }

  if (guildData.panel.imageUrl) {
    items.push({
      media: { url: guildData.panel.imageUrl },
      description: 'Imagem do painel'
    });
  }

  if (!items.length) return null;

  return {
    type: 12,
    items
  };
}

function createButtonRows(buttons) {
  const chunks = chunkArray(buttons, 5);
  return chunks.map((chunk) => {
    const row = new ActionRowBuilder();

    row.addComponents(
      chunk.map((button) => {
        const builder = new ButtonBuilder()
          .setCustomId(`panel_open:button:${button.id}`)
          .setLabel(button.label)
          .setStyle(button.style || ButtonStyle.Primary);

        return builder;
      })
    );

    return row;
  });
}

function createSelectRows(selectMenus) {
  return selectMenus
    .filter((menu) => Array.isArray(menu.options) && menu.options.length)
    .map((menu) => {
      const row = new ActionRowBuilder();
      const builder = new StringSelectMenuBuilder()
        .setCustomId(`panel_open:select:${menu.id}`)
        .setPlaceholder(menu.placeholder || 'Escolha uma opção')
        .setMinValues(1)
        .setMaxValues(1)
        .addOptions(
          menu.options.map((option) => ({
            label: option.label,
            value: option.value,
            description: option.description || undefined
          }))
        );

      row.addComponents(builder);
      return row;
    });
}

function buildPublicPanelMessage(guildData) {
  const container = new ContainerBuilder().setAccentColor(guildData.panel.accentColor);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${guildData.panel.title}\n${guildData.panel.description}`)
  );

  const galleryComponent = buildGalleryComponent(guildData);
  if (galleryComponent) {
    container.addMediaGalleryComponents(galleryComponent);
  }

  const buttonRows = createButtonRows(guildData.panel.buttons);
  const selectRows = createSelectRows(guildData.panel.selectMenus);

  for (const row of [...buttonRows, ...selectRows]) {
    container.addActionRowComponents(row);
  }

  return { components: [container] };
}

function buildTicketMessage(guildData, ticket) {
  const container = new ContainerBuilder().setAccentColor(guildData.panel.accentColor);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        `# Ticket #${String(ticket.ticketNumber).padStart(4, '0')}`,
        `**Usuário:** <@${ticket.ownerId}>`,
        `**Origem:** ${ticket.source?.label || 'não identificada'}`,
        `**Aberto em:** <t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:f>`,
        `**Assumido por:** ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'ninguém ainda'}`
      ].join('\n')
    )
  );

  container.addSeparatorComponents(new SeparatorBuilder());

  const buttonsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Assumir ticket').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_pix').setLabel('Chave PIX').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_notify_user').setLabel('Notificar usuário').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_notify_staff').setLabel('Notificar staff').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Fechar ticket').setStyle(ButtonStyle.Danger)
  );

  const staffRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket_staff_panel')
      .setPlaceholder('Painel Staff')
      .addOptions(
        { label: 'Banir usuário', value: 'ban', description: 'Bane o dono do ticket' },
        { label: 'Adicionar usuário no ticket', value: 'add_user', description: 'Libera o acesso de outro usuário' },
        { label: 'Castigar usuário', value: 'punish', description: 'Aplica timeout no dono do ticket' },
        { label: 'Blacklist', value: 'blacklist', description: 'Impede novos tickets' }
      )
  );

  container.addActionRowComponents(buttonsRow, staffRow);

  return { components: [container] };
}

async function sendLogMessage(guild, content, files = []) {
  const guildData = await getGuildData(guild.id);
  if (!guildData.logs.channelId) return;

  const channel = guild.channels.cache.get(guildData.logs.channelId)
    || await guild.channels.fetch(guildData.logs.channelId).catch(() => null);

  if (!channel?.isTextBased()) return;

  const payload = buildContainerPayload({
    title: 'Log do sistema',
    body: content,
    accentColor: guildData.panel.accentColor
  });

  await channel.send(asV2Message(payload, { files })).catch((error) => {
    logger.error('Falha ao enviar log para o canal configurado.', error);
  });
}

async function sendTranscript(guild, transcript, ticket, closedBy) {
  const guildData = await getGuildData(guild.id);

  if (guildData.logs.transcriptChannelId) {
    const transcriptChannel = guild.channels.cache.get(guildData.logs.transcriptChannelId)
      || await guild.channels.fetch(guildData.logs.transcriptChannelId).catch(() => null);

    if (transcriptChannel?.isTextBased()) {
      const payload = buildContainerPayload({
        title: 'Transcript HTML gerado',
        body: [
          `**Ticket:** <#${ticket.channelId}>`,
          `**Usuário:** <@${ticket.ownerId}>`,
          `**Fechado por:** <@${closedBy.id}>`,
          `**Mensagens capturadas:** ${transcript.messageCount}`
        ].join('\n'),
        accentColor: guildData.panel.accentColor
      });

      await transcriptChannel.send(asV2Message(payload, { files: [transcript.attachment] })).catch((error) => {
        logger.error('Falha ao enviar transcript.', error);
      });
    }
  }

  await sendLogMessage(
    guild,
    `Transcript gerado para o ticket <#${ticket.channelId}>. Fechado por <@${closedBy.id}>.`,
    [transcript.attachment]
  );
}

async function createTicketChannel(client, guild, user, source) {
  const guildData = await getGuildData(guild.id);
  const system = await getSystemData();
  const ticketNumber = await incrementTicketCounter(guild.id);

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks
      ]
    }
  ];

  if (system.ownerId) {
    overwrites.push({
      id: system.ownerId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  for (const adminId of guildData.panel.admins) {
    overwrites.push({
      id: adminId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  for (const roleId of [...new Set([...guildData.panel.staffRoles, ...guildData.panel.managerRoles])]) {
    overwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles
      ]
    });
  }

  const name = `ticket-${String(ticketNumber).padStart(4, '0')}`;

  const channel = await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: guildData.ticket.categoryId || undefined,
    topic: `ticket_owner:${user.id}`,
    permissionOverwrites: overwrites,
    reason: `Ticket aberto por ${user.tag}`
  });

  await createTicketRecord({
    channelId: channel.id,
    guildId: guild.id,
    ownerId: user.id,
    source: {
      ...source,
      openedFromUserId: user.id
    },
    ticketNumber
  });

  return channel;
}

async function publishPanelToChannel(guild, channel, actor) {
  const guildData = await getGuildData(guild.id);
  const message = await channel.send(asV2Message(buildPublicPanelMessage(guildData)));

  await setLastPanelMessage(guild.id, {
    channelId: channel.id,
    messageId: message.id,
    sentBy: actor.id,
    sentAt: new Date().toISOString()
  });

  await sendLogMessage(guild, `<@${actor.id}> publicou o painel de tickets em <#${channel.id}>.`);
  return message;
}

async function notifyUserInTicket(channel, ticket, guildData) {
  const payload = buildContainerPayload({
    title: 'Notificação ao usuário',
    body: `<@${ticket.ownerId}>, sua atenção foi solicitada neste ticket.`,
    accentColor: guildData.panel.accentColor
  });

  await channel.send(asV2Message(payload, {
    allowedMentions: {
      users: [ticket.ownerId]
    }
  }));
}

async function notifyStaffInTicket(channel, guildData) {
  const target = guildData.panel.pingRoleId ? `<@&${guildData.panel.pingRoleId}>` : '@here';
  const payload = buildContainerPayload({
    title: 'Notificação à equipe',
    body: `${target} atenção da equipe solicitada neste ticket.`,
    accentColor: guildData.panel.accentColor
  });

  await channel.send(asV2Message(payload, {
    allowedMentions: {
      parse: guildData.panel.pingRoleId ? [] : ['everyone'],
      roles: guildData.panel.pingRoleId ? [guildData.panel.pingRoleId] : []
    }
  }));
}

async function claimTicket(guild, user, ticket) {
  await sendLogMessage(guild, `<@${user.id}> assumiu o ticket <#${ticket.channelId}>.`);
  return updateTicket(ticket.channelId, { claimedBy: user.id });
}

async function closeTicketAndArchive(client, guild, channel, ticket, closedBy) {
  const transcript = await createTranscriptFile(channel, ticket);
  await sendTranscript(guild, transcript, ticket, closedBy);

  await updateTicket(ticket.channelId, {
    status: 'closed',
    closedBy: closedBy.id,
    closedAt: new Date().toISOString()
  });

  await sendLogMessage(guild, `Ticket <#${ticket.channelId}> será excluído em alguns segundos.`);

  setTimeout(async () => {
    await channel.delete(`Ticket fechado por ${closedBy.tag}`).catch((error) => {
      logger.error('Falha ao excluir o canal do ticket.', error);
    });
  }, client.config.defaults.closeDeleteDelayMs);
}

module.exports = {
  buildPublicPanelMessage,
  buildTicketMessage,
  createTicketChannel,
  closeTicketAndArchive,
  notifyUserInTicket,
  notifyStaffInTicket,
  claimTicket,
  sendLogMessage,
  publishPanelToChannel
};
