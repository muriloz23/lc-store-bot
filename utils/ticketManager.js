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

function buildPublicPanelMessage(panelData) {
  const container = new ContainerBuilder().setAccentColor(panelData.accentColor);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${panelData.title}\n${panelData.description}`)
  );

  const galleryComponent = buildGalleryComponent({ panel: panelData });
  if (galleryComponent) {
    container.addMediaGalleryComponents(galleryComponent);
  }

  const buttonRows = createButtonRows(panelData.buttons);
  const selectRows = createSelectRows(panelData.selectMenus);

  for (const row of [...buttonRows, ...selectRows]) {
    container.addActionRowComponents(row);
  }

  return { components: [container] };
}

function buildTicketMessage(guildData, ticket) {
  const panel = guildData.panels[0] || guildData.panels?.[0] || { accentColor: 0x5865F2 };
  const container = new ContainerBuilder().setAccentColor(panel.accentColor);

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

  const panel = guildData.panels[0] || { accentColor: 0x5865F2 };
  const payload = buildContainerPayload({
    title: 'Log do sistema',
    body: content,
    accentColor: panel.accentColor
  });

  await channel.send(asV2Message(payload, { files })).catch((error) => {
    logger.error('Falha ao enviar log para o canal configurado.', error);
  });
}

async function sendTranscript(guild, transcript, ticket, closedBy) {
  const guildData = await getGuildData(guild.id);
  const panel = guildData.panels[0] || { accentColor: 0x5865F2 };

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
        accentColor: panel.accentColor
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

  // Encontrar o painel correto baseado na fonte
  const panel = guildData.panels.find(p => p.id === source.panelId) || guildData.panels[0];

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

  for (const adminId of panel?.admins || []) {
    overwrites.push({
      id: adminId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  for (const roleId of [...new Set([...(panel?.staffRoles || []), ...(panel?.managerRoles || [])])]) {
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
      openedFromUserId: user.id,
      panelId: panel?.id
    },
    ticketNumber
  });

  return channel;
}

async function publishPanelToChannel(guild, channel, actor, panelId = null) {
  const guildData = await getGuildData(guild.id);
  const panel = panelId 
    ? guildData.panels.find(p => p.id === panelId) 
    : guildData.panels[0];
  
  if (!panel) {
    throw new Error('Painel não encontrado');
  }

  const message = await channel.send(asV2Message(buildPublicPanelMessage(panel)));

  await setLastPanelMessage(guild.id, {
    channelId: channel.id,
    messageId: message.id,
    sentBy: actor.id,
    sentAt: new Date().toISOString(),
    panelId: panel.id
  });

  await sendLogMessage(guild, `<@${actor.id}> publicou o painel "${panel.name}" em <#${channel.id}>.`);
  return message;
}

async function notifyUserInTicket(channel, ticket, guildData) {
  const panel = guildData.panels[0] || { accentColor: 0x5865F2 };
  const payload = buildContainerPayload({
    title: 'Notificação ao usuário',
    body: `<@${ticket.ownerId}>, sua atenção foi solicitada neste ticket.`,
    accentColor: panel.accentColor
  });

  await channel.send(asV2Message(payload, {
    allowedMentions: {
      users: [ticket.ownerId]
    }
  }));
}

async function notifyStaffInTicket(channel, guildData) {
  const panel = guildData.panels[0] || { accentColor: 0x5865F2, pingRoleId: null };
  const target = panel.pingRoleId ? `<@&${panel.pingRoleId}>` : '@here';
  const payload = buildContainerPayload({
    title: 'Notificação à equipe',
    body: `${target} atenção da equipe solicitada neste ticket.`,
    accentColor: panel.accentColor
  });

  await channel.send(asV2Message(payload, {
    allowedMentions: {
      parse: panel.pingRoleId ? [] : ['everyone'],
      roles: panel.pingRoleId ? [panel.pingRoleId] : []
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
