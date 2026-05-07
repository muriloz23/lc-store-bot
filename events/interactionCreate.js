const {
  Events,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

const logger = require('../utils/logger');
const {
  canManagePanel,
  canUseStaffActions,
  canUseManagerActions,
  isOwner
} = require('../utils/permissions');
const {
  getGuildData,
  saveGuildData,
  findOpenTicketByUser,
  addUserToBlacklist,
  getTicketByChannelId,
  addExtraUserToTicket
} = require('../utils/database');
const {
  buildTicketMessage,
  createTicketChannel,
  closeTicketAndArchive,
  notifyUserInTicket,
  notifyStaffInTicket,
  claimTicket,
  sendLogMessage,
  publishPanelToChannel,
  buildPublicPanelMessage
} = require('../utils/ticketManager');
const {
  normalizeCustomIdValue,
  styleNameToValue
} = require('../utils/helpers');
const {
  buildHomePanel,
  buildContentPanel,
  buildChannelsPanel,
  buildComponentsPanel,
  buildTeamPanel,
  buildTeamTargetPanel
} = require('../utils/managementPanel');
const { buildContainerPayload, asV2Message } = require('../utils/ui');

function noticePayload(accentColor, title, body) {
  return buildContainerPayload({ title, body, accentColor });
}

async function replyNotice(interaction, title, body, accentColor, { ephemeral = true, followUp = false, editReply = false, extra = {} } = {}) {
  const payload = noticePayload(accentColor, title, body);

  if (editReply) {
    return interaction.editReply({ ...payload, ...extra });
  }

  if (followUp) {
    return interaction.followUp(asV2Message(payload, { ephemeral, ...extra }));
  }

  return interaction.reply(asV2Message(payload, { ephemeral, ...extra }));
}

function buildManagementView(view, guildData, client) {
  if (view === 'content') return buildContentPanel(guildData);
  if (view === 'channels') return buildChannelsPanel(guildData);
  if (view === 'components') return buildComponentsPanel(guildData);
  if (view === 'team') return buildTeamPanel(guildData);
  if (view.startsWith('team:')) return buildTeamTargetPanel(guildData, view.split(':')[1]);
  return buildHomePanel(guildData, client);
}

async function updateManagementView(interaction, client, guildData, view) {
  return interaction.update(buildManagementView(view, guildData, client));
}

function buildManagementModal(action, guildData) {
  if (action === 'text') {
    const modal = new ModalBuilder().setCustomId('manage_modal:text').setTitle('Editar conteúdo do painel');
    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Título do painel')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100)
      .setValue(guildData.panel.title || '');

    const descriptionInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Descrição do painel')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(4000)
      .setValue(guildData.panel.description || '');

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descriptionInput)
    );

    return modal;
  }

  if (action === 'media') {
    const modal = new ModalBuilder().setCustomId('manage_modal:media').setTitle('Editar mídia do painel');
    const imageInput = new TextInputBuilder()
      .setCustomId('image_url')
      .setLabel('URL da imagem (vazio remove)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(1000)
      .setValue(guildData.panel.imageUrl || '');

    const bannerInput = new TextInputBuilder()
      .setCustomId('banner_url')
      .setLabel('URL do banner (vazio remove)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(1000)
      .setValue(guildData.panel.bannerUrl || '');

    modal.addComponents(
      new ActionRowBuilder().addComponents(imageInput),
      new ActionRowBuilder().addComponents(bannerInput)
    );

    return modal;
  }

  if (action === 'pix') {
    const modal = new ModalBuilder().setCustomId('manage_modal:pix').setTitle('Editar PIX');
    const typeInput = new TextInputBuilder()
      .setCustomId('type')
      .setLabel('Tipo: email, celular, cpf ou aleatoria')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(20)
      .setValue(guildData.panel.pix.type || 'email');

    const keyInput = new TextInputBuilder()
      .setCustomId('key')
      .setLabel('Chave PIX')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(200)
      .setValue(guildData.panel.pix.key || '');

    modal.addComponents(
      new ActionRowBuilder().addComponents(typeInput),
      new ActionRowBuilder().addComponents(keyInput)
    );

    return modal;
  }

  if (action === 'add_button') {
    const modal = new ModalBuilder().setCustomId('manage_modal:add_button').setTitle('Adicionar botão');
    const idInput = new TextInputBuilder().setCustomId('id').setLabel('ID do botão').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30);
    const labelInput = new TextInputBuilder().setCustomId('label').setLabel('Nome do botão').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80);
    const styleInput = new TextInputBuilder().setCustomId('style').setLabel('Estilo: primary, secondary, success, danger').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20).setValue('secondary');

    modal.addComponents(
      new ActionRowBuilder().addComponents(idInput),
      new ActionRowBuilder().addComponents(labelInput),
      new ActionRowBuilder().addComponents(styleInput)
    );

    return modal;
  }

  if (action === 'remove_button') {
    const modal = new ModalBuilder().setCustomId('manage_modal:remove_button').setTitle('Remover botão');
    const idInput = new TextInputBuilder().setCustomId('id').setLabel('ID do botão').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30);
    modal.addComponents(new ActionRowBuilder().addComponents(idInput));
    return modal;
  }

  if (action === 'add_menu') {
    const modal = new ModalBuilder().setCustomId('manage_modal:add_menu').setTitle('Adicionar menu');
    const idInput = new TextInputBuilder().setCustomId('id').setLabel('ID do menu').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30);
    const placeholderInput = new TextInputBuilder().setCustomId('placeholder').setLabel('Placeholder do menu').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
    modal.addComponents(
      new ActionRowBuilder().addComponents(idInput),
      new ActionRowBuilder().addComponents(placeholderInput)
    );
    return modal;
  }

  if (action === 'remove_menu') {
    const modal = new ModalBuilder().setCustomId('manage_modal:remove_menu').setTitle('Remover menu');
    const idInput = new TextInputBuilder().setCustomId('id').setLabel('ID do menu').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30);
    modal.addComponents(new ActionRowBuilder().addComponents(idInput));
    return modal;
  }

  if (action === 'add_option') {
    const modal = new ModalBuilder().setCustomId('manage_modal:add_option').setTitle('Adicionar opção ao menu');
    const menuInput = new TextInputBuilder().setCustomId('menu').setLabel('ID do menu').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30);
    const valueInput = new TextInputBuilder().setCustomId('value').setLabel('Valor interno').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
    const labelInput = new TextInputBuilder().setCustomId('label').setLabel('Nome visível').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
    const descriptionInput = new TextInputBuilder().setCustomId('description').setLabel('Descrição curta (opcional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100);

    modal.addComponents(
      new ActionRowBuilder().addComponents(menuInput),
      new ActionRowBuilder().addComponents(valueInput),
      new ActionRowBuilder().addComponents(labelInput),
      new ActionRowBuilder().addComponents(descriptionInput)
    );

    return modal;
  }

  if (action === 'remove_option') {
    const modal = new ModalBuilder().setCustomId('manage_modal:remove_option').setTitle('Remover opção');
    const menuInput = new TextInputBuilder().setCustomId('menu').setLabel('ID do menu').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30);
    const valueInput = new TextInputBuilder().setCustomId('value').setLabel('Valor da opção').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
    modal.addComponents(
      new ActionRowBuilder().addComponents(menuInput),
      new ActionRowBuilder().addComponents(valueInput)
    );
    return modal;
  }

  return null;
}

async function ensureManagementPermission(interaction, guildData) {
  if (await canManagePanel(interaction, guildData)) return true;

  await replyNotice(
    interaction,
    'Acesso negado',
    'Você não tem permissão para usar o painel de gerenciamento.',
    guildData.panel.accentColor,
    { ephemeral: true }
  ).catch(() => null);

  return false;
}

async function handleCommand(client, interaction) {
  const command = client.commands.get(interaction.commandName);

  if (!command) {
    return replyNotice(interaction, 'Comando indisponível', 'Esse comando não está carregado no momento.', client.config.defaults.accentColor);
  }

  try {
    await command.execute(client, interaction);
  } catch (error) {
    logger.error(`Erro no comando /${interaction.commandName}`, error);

    if (interaction.deferred || interaction.replied) {
      await replyNotice(interaction, 'Erro interno', 'Ocorreu um erro ao executar esse comando.', client.config.defaults.accentColor, { editReply: interaction.deferred, followUp: interaction.replied && !interaction.deferred }).catch(() => null);
      return;
    }

    await replyNotice(interaction, 'Erro interno', 'Ocorreu um erro ao executar esse comando.', client.config.defaults.accentColor).catch(() => null);
  }
}

async function handlePublicPanelInteraction(client, interaction) {
  const guildData = await getGuildData(interaction.guild.id);

  if (guildData.blacklist.includes(interaction.user.id)) {
    return replyNotice(interaction, 'Acesso bloqueado', 'Você está em blacklist e não pode abrir tickets neste servidor.', guildData.panel.accentColor);
  }

  const existingTicket = await findOpenTicketByUser(interaction.guild.id, interaction.user.id);
  if (existingTicket && client.config.defaults.preventMultipleOpenTickets) {
    return replyNotice(interaction, 'Ticket já aberto', `Você já possui um ticket aberto: <#${existingTicket.channelId}>`, guildData.panel.accentColor);
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const source = interaction.isButton()
    ? {
        type: 'button',
        id: interaction.customId.split(':')[2] || 'button',
        label: interaction.component.label || 'Botão'
      }
    : {
        type: 'select',
        id: interaction.values[0],
        label: interaction.component.options.find((option) => option.value === interaction.values[0])?.label || interaction.values[0]
      };

  const channel = await createTicketChannel(client, interaction.guild, interaction.user, source);
  const ticketRecord = await getTicketByChannelId(channel.id);
  const ticketPayload = buildTicketMessage(guildData, ticketRecord);

  await channel.send(asV2Message(ticketPayload));
  await sendLogMessage(interaction.guild, `Ticket criado por <@${interaction.user.id}> em <#${channel.id}>. Origem: ${source.label}.`);

  await replyNotice(interaction, 'Ticket criado', `Seu ticket foi criado em <#${channel.id}>.`, guildData.panel.accentColor, {
    editReply: true,
    extra: { allowedMentions: { users: [interaction.user.id] } }
  });
}

async function handleManagementButton(client, interaction) {
  const guildData = await getGuildData(interaction.guild.id);
  if (!(await ensureManagementPermission(interaction, guildData))) return;

  const [, action] = interaction.customId.split(':');

  if (interaction.customId.startsWith('manage_nav:')) {
    return updateManagementView(interaction, client, guildData, action);
  }

  if (interaction.customId.startsWith('manage_modal:')) {
    const modalAction = interaction.customId.split(':')[1];
    const modal = buildManagementModal(modalAction, guildData);
    if (modal) return interaction.showModal(modal);
  }

  if (interaction.customId === 'manage_action:preview') {
    await interaction.deferUpdate();
    return interaction.followUp(asV2Message(buildPublicPanelMessage(guildData), { ephemeral: true }));
  }

  if (interaction.customId === 'manage_action:publish') {
    await interaction.deferUpdate();

    if (!interaction.channel?.isTextBased()) {
      return interaction.followUp(asV2Message(noticePayload(guildData.panel.accentColor, 'Canal inválido', 'Esse painel só pode ser publicado em um canal de texto.'), { ephemeral: true }));
    }

    await publishPanelToChannel(interaction.guild, interaction.channel, interaction.user);
    return interaction.followUp(asV2Message(noticePayload(guildData.panel.accentColor, 'Painel publicado', `O painel foi enviado em <#${interaction.channel.id}>.`), { ephemeral: true }));
  }
}

async function handleManagementStringSelect(client, interaction) {
  const guildData = await getGuildData(interaction.guild.id);
  if (!(await ensureManagementPermission(interaction, guildData))) return;

  if (interaction.customId === 'manage_action_select' || interaction.customId === 'manage_team_action' || interaction.customId === 'manage_component_action') {
    const selected = interaction.values[0];
    const teamActions = new Set(['admin_add', 'admin_remove', 'staff_add', 'staff_remove', 'manager_add', 'manager_remove', 'ping_set']);

    if (teamActions.has(selected)) {
      return interaction.update(buildManagementView(`team:${selected}`, guildData, client));
    }

    if (selected === 'clear_buttons') {
      guildData.panel.buttons = [];
      await saveGuildData(interaction.guild.id, guildData);
      return interaction.update(buildHomePanel(guildData, client));
    }

    if (selected === 'clear_menus') {
      guildData.panel.selectMenus = [];
      await saveGuildData(interaction.guild.id, guildData);
      return interaction.update(buildHomePanel(guildData, client));
    }

    const modal = buildManagementModal(selected, guildData);
    if (modal) return interaction.showModal(modal);
  }

  if (interaction.customId === 'ticket_staff_panel') {
    return handleTicketStaffMenu(interaction);
  }
}

async function handleManagementUserSelect(client, interaction) {
  const guildData = await getGuildData(interaction.guild.id);
  if (!(await ensureManagementPermission(interaction, guildData))) return;

  const [prefix, action] = interaction.customId.split(':');
  if (prefix !== 'manage_user') return;

  const userId = interaction.values[0];

  if (action === 'admin_add' && !guildData.panel.admins.includes(userId)) {
    guildData.panel.admins.push(userId);
  }

  if (action === 'admin_remove') {
    guildData.panel.admins = guildData.panel.admins.filter((id) => id !== userId);
  }

  await saveGuildData(interaction.guild.id, guildData);
  return interaction.update(buildHomePanel(guildData, client));
}

async function handleManagementRoleSelect(client, interaction) {
  const guildData = await getGuildData(interaction.guild.id);
  if (!(await ensureManagementPermission(interaction, guildData))) return;

  const [prefix, action] = interaction.customId.split(':');
  if (prefix !== 'manage_role') return;

  const roleId = interaction.values[0];

  if (action === 'staff_add' && !guildData.panel.staffRoles.includes(roleId)) {
    guildData.panel.staffRoles.push(roleId);
  }

  if (action === 'staff_remove') {
    guildData.panel.staffRoles = guildData.panel.staffRoles.filter((id) => id !== roleId);
  }

  if (action === 'manager_add' && !guildData.panel.managerRoles.includes(roleId)) {
    guildData.panel.managerRoles.push(roleId);
  }

  if (action === 'manager_remove') {
    guildData.panel.managerRoles = guildData.panel.managerRoles.filter((id) => id !== roleId);
  }

  if (action === 'ping_set') {
    guildData.panel.pingRoleId = roleId;
  }

  await saveGuildData(interaction.guild.id, guildData);
  return interaction.update(buildHomePanel(guildData, client));
}

async function handleManagementChannelSelect(client, interaction) {
  const guildData = await getGuildData(interaction.guild.id);
  if (!(await ensureManagementPermission(interaction, guildData))) return;

  const [, action] = interaction.customId.split(':');
  const channelId = interaction.values[0];

  if ((action === 'logs' || action === 'transcript') && !(await isOwner(interaction.user.id))) {
    return interaction.reply(asV2Message(noticePayload(guildData.panel.accentColor, 'Área do dono', 'Somente o dono do bot pode alterar logs e transcript.'), { ephemeral: true }));
  }

  if (action === 'logs') guildData.logs.channelId = channelId;
  if (action === 'transcript') guildData.logs.transcriptChannelId = channelId;
  if (action === 'category') guildData.ticket.categoryId = channelId;

  await saveGuildData(interaction.guild.id, guildData);
  return interaction.update(buildHomePanel(guildData, client));
}

async function handleTicketButton(client, interaction) {
  const ticket = await getTicketByChannelId(interaction.channel.id);
  if (!ticket) return;

  const guildData = await getGuildData(interaction.guild.id);

  switch (interaction.customId) {
    case 'ticket_claim': {
      if (!(await canUseStaffActions(interaction, guildData))) {
        return replyNotice(interaction, 'Sem permissão', 'Você não tem permissão para assumir tickets.', guildData.panel.accentColor);
      }

      const alreadyClaimed = ticket.claimedBy;
      const newTicket = await claimTicket(interaction.guild, interaction.user, ticket);
      const payload = buildTicketMessage(guildData, newTicket);

      await interaction.update(payload);
      await interaction.followUp(asV2Message(noticePayload(guildData.panel.accentColor, 'Ticket assumido', alreadyClaimed ? `Ticket transferido para <@${interaction.user.id}>.` : `Ticket assumido por <@${interaction.user.id}>.`), {
        ephemeral: true,
        allowedMentions: { users: [interaction.user.id] }
      }));
      return;
    }

    case 'ticket_pix': {
      const pix = guildData.panel.pix;
      const body = pix.key ? `**Chave PIX:** \`${pix.key}\`\n**Tipo:** ${pix.type}` : 'Nenhuma chave PIX foi configurada ainda.';
      return replyNotice(interaction, 'Chave PIX', body, guildData.panel.accentColor);
    }

    case 'ticket_notify_user': {
      if (!(await canUseStaffActions(interaction, guildData))) {
        return replyNotice(interaction, 'Sem permissão', 'Você não tem permissão para usar essa ação.', guildData.panel.accentColor);
      }

      await notifyUserInTicket(interaction.channel, ticket, guildData);
      return replyNotice(interaction, 'Usuário notificado', 'O usuário foi notificado com sucesso no ticket.', guildData.panel.accentColor);
    }

    case 'ticket_notify_staff': {
      if (!(await canUseStaffActions(interaction, guildData))) {
        return replyNotice(interaction, 'Sem permissão', 'Você não tem permissão para usar essa ação.', guildData.panel.accentColor);
      }

      await notifyStaffInTicket(interaction.channel, guildData);
      return replyNotice(interaction, 'Staff notificada', 'A equipe foi notificada com sucesso no ticket.', guildData.panel.accentColor);
    }

    case 'ticket_close': {
      if (!(await canUseStaffActions(interaction, guildData))) {
        return replyNotice(interaction, 'Sem permissão', 'Você não tem permissão para fechar tickets.', guildData.panel.accentColor);
      }

      await replyNotice(interaction, 'Fechando ticket', 'Fechando ticket e gerando transcript HTML...', guildData.panel.accentColor);
      await closeTicketAndArchive(client, interaction.guild, interaction.channel, ticket, interaction.user);
      return;
    }

    default:
      return;
  }
}

async function handleTicketStaffMenu(interaction) {
  const ticket = await getTicketByChannelId(interaction.channel.id);
  if (!ticket) return;

  const guildData = await getGuildData(interaction.guild.id);

  if (!(await canUseStaffActions(interaction, guildData))) {
    return replyNotice(interaction, 'Sem permissão', 'Você não tem permissão para usar o painel staff.', guildData.panel.accentColor);
  }

  const selected = interaction.values[0];

  if (selected === 'blacklist') {
    if (!(await canUseManagerActions(interaction, guildData))) {
      return replyNotice(interaction, 'Sem permissão', 'Apenas gerente/admin/dono pode usar blacklist.', guildData.panel.accentColor);
    }

    await addUserToBlacklist(interaction.guild.id, ticket.ownerId);
    await sendLogMessage(interaction.guild, `<@${interaction.user.id}> colocou <@${ticket.ownerId}> na blacklist.`);
    return replyNotice(interaction, 'Blacklist atualizada', `Usuário <@${ticket.ownerId}> adicionado à blacklist.`, guildData.panel.accentColor, {
      extra: { allowedMentions: { users: [ticket.ownerId] } }
    });
  }

  if (selected === 'ban') {
    if (!(await canUseManagerActions(interaction, guildData))) {
      return replyNotice(interaction, 'Sem permissão', 'Apenas gerente/admin/dono pode banir usuários.', guildData.panel.accentColor);
    }

    const modal = new ModalBuilder().setCustomId(`staff_modal:ban:${ticket.channelId}`).setTitle('Banir usuário do ticket');
    const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel('Motivo do ban').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
    modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
    return interaction.showModal(modal);
  }

  if (selected === 'add_user') {
    const modal = new ModalBuilder().setCustomId(`staff_modal:add_user:${ticket.channelId}`).setTitle('Adicionar usuário ao ticket');
    const userInput = new TextInputBuilder().setCustomId('user_id').setLabel('ID do usuário').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30);
    modal.addComponents(new ActionRowBuilder().addComponents(userInput));
    return interaction.showModal(modal);
  }

  if (selected === 'punish') {
    if (!(await canUseManagerActions(interaction, guildData))) {
      return replyNotice(interaction, 'Sem permissão', 'Apenas gerente/admin/dono pode castigar usuários.', guildData.panel.accentColor);
    }

    const modal = new ModalBuilder().setCustomId(`staff_modal:punish:${ticket.channelId}`).setTitle('Castigar usuário');
    const minutesInput = new TextInputBuilder().setCustomId('minutes').setLabel('Tempo em minutos').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Ex.: 30').setMaxLength(4);
    const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel('Motivo').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
    modal.addComponents(new ActionRowBuilder().addComponents(minutesInput), new ActionRowBuilder().addComponents(reasonInput));
    return interaction.showModal(modal);
  }

  return replyNotice(interaction, 'Opção inválida', 'A opção selecionada não é válida.', guildData.panel.accentColor);
}

async function handleManagementModal(client, interaction) {
  const guildData = await getGuildData(interaction.guild.id);

  if (!(await canManagePanel(interaction, guildData))) {
    return replyNotice(interaction, 'Acesso negado', 'Você não tem permissão para usar o painel de gerenciamento.', guildData.panel.accentColor);
  }

  const [, action] = interaction.customId.split(':');

  if (action === 'text') {
    guildData.panel.title = interaction.fields.getTextInputValue('title').trim();
    guildData.panel.description = interaction.fields.getTextInputValue('description').trim();
  }

  if (action === 'media') {
    guildData.panel.imageUrl = interaction.fields.getTextInputValue('image_url').trim();
    guildData.panel.bannerUrl = interaction.fields.getTextInputValue('banner_url').trim();
  }

  if (action === 'pix') {
    const type = interaction.fields.getTextInputValue('type').trim().toLowerCase();
    const key = interaction.fields.getTextInputValue('key').trim();
    const validTypes = ['email', 'celular', 'cpf', 'aleatoria'];

    if (!validTypes.includes(type)) {
      return replyNotice(interaction, 'Tipo de PIX inválido', 'Use apenas: email, celular, cpf ou aleatoria.', guildData.panel.accentColor);
    }

    guildData.panel.pix = { type, key };
  }

  if (action === 'add_button') {
    if (guildData.panel.buttons.length >= 25) {
      return replyNotice(interaction, 'Limite atingido', 'Você atingiu o limite de 25 botões configurados.', guildData.panel.accentColor);
    }

    const id = normalizeCustomIdValue(interaction.fields.getTextInputValue('id'));
    if (guildData.panel.buttons.some((button) => button.id === id)) {
      return replyNotice(interaction, 'ID duplicado', 'Já existe um botão com esse ID.', guildData.panel.accentColor);
    }

    guildData.panel.buttons.push({
      id,
      label: interaction.fields.getTextInputValue('label').trim(),
      style: styleNameToValue(interaction.fields.getTextInputValue('style').trim().toLowerCase()),
    });
  }

  if (action === 'remove_button') {
    const id = normalizeCustomIdValue(interaction.fields.getTextInputValue('id'));
    guildData.panel.buttons = guildData.panel.buttons.filter((button) => button.id !== id);
  }

  if (action === 'add_menu') {
    if (guildData.panel.selectMenus.length >= 5) {
      return replyNotice(interaction, 'Limite atingido', 'Você atingiu o limite de 5 select menus configurados.', guildData.panel.accentColor);
    }

    const id = normalizeCustomIdValue(interaction.fields.getTextInputValue('id'));
    if (guildData.panel.selectMenus.some((menu) => menu.id === id)) {
      return replyNotice(interaction, 'ID duplicado', 'Já existe um menu com esse ID.', guildData.panel.accentColor);
    }

    guildData.panel.selectMenus.push({
      id,
      placeholder: interaction.fields.getTextInputValue('placeholder').trim(),
      options: []
    });
  }

  if (action === 'remove_menu') {
    const id = normalizeCustomIdValue(interaction.fields.getTextInputValue('id'));
    guildData.panel.selectMenus = guildData.panel.selectMenus.filter((menu) => menu.id !== id);
  }

  if (action === 'add_option') {
    const menuId = normalizeCustomIdValue(interaction.fields.getTextInputValue('menu'));
    const menu = guildData.panel.selectMenus.find((entry) => entry.id === menuId);

    if (!menu) {
      return replyNotice(interaction, 'Menu não encontrado', 'Não existe um menu com esse ID.', guildData.panel.accentColor);
    }

    if (menu.options.length >= 25) {
      return replyNotice(interaction, 'Limite atingido', 'Esse menu já possui 25 opções.', guildData.panel.accentColor);
    }

    const value = normalizeCustomIdValue(interaction.fields.getTextInputValue('value'));
    if (menu.options.some((option) => option.value === value)) {
      return replyNotice(interaction, 'Valor duplicado', 'Já existe uma opção com esse valor nesse menu.', guildData.panel.accentColor);
    }

    menu.options.push({
      value,
      label: interaction.fields.getTextInputValue('label').trim(),
      description: interaction.fields.getTextInputValue('description').trim(),
    });
  }

  if (action === 'remove_option') {
    const menuId = normalizeCustomIdValue(interaction.fields.getTextInputValue('menu'));
    const value = normalizeCustomIdValue(interaction.fields.getTextInputValue('value'));
    const menu = guildData.panel.selectMenus.find((entry) => entry.id === menuId);

    if (!menu) {
      return replyNotice(interaction, 'Menu não encontrado', 'Não existe um menu com esse ID.', guildData.panel.accentColor);
    }

    menu.options = menu.options.filter((option) => option.value !== value);
  }

  await saveGuildData(interaction.guild.id, guildData);
  return interaction.reply(asV2Message(buildHomePanel(guildData, client), { ephemeral: true }));
}

async function handleStaffModal(interaction) {
  const [prefix, action, channelId] = interaction.customId.split(':');
  if (prefix !== 'staff_modal') return;

  const ticket = await getTicketByChannelId(channelId);
  if (!ticket) {
    return replyNotice(interaction, 'Ticket não encontrado', 'Ticket não encontrado para essa ação.', 0x2B2D31);
  }

  const guildData = await getGuildData(interaction.guild.id);

  if (!(await canUseStaffActions(interaction, guildData))) {
    return replyNotice(interaction, 'Sem permissão', 'Você não tem permissão para essa ação.', guildData.panel.accentColor);
  }

  if (action === 'add_user') {
    const userId = normalizeCustomIdValue(interaction.fields.getTextInputValue('user_id'));
    const member = await interaction.guild.members.fetch(userId).catch(() => null);

    if (!member) {
      return replyNotice(interaction, 'Usuário não encontrado', 'Não encontrei esse usuário no servidor.', guildData.panel.accentColor);
    }

    await interaction.channel.permissionOverwrites.edit(member.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true
    });

    await addExtraUserToTicket(ticket.channelId, member.id);
    await sendLogMessage(interaction.guild, ` <@${interaction.user.id}> adicionou <@${member.id}> ao ticket <#${interaction.channel.id}>.`.trim());
    return replyNotice(interaction, 'Usuário adicionado', `${member} foi adicionado ao ticket.`, guildData.panel.accentColor, {
      extra: { allowedMentions: { users: [member.id] } }
    });
  }

  if (action === 'ban') {
    if (!(await canUseManagerActions(interaction, guildData))) {
      return replyNotice(interaction, 'Sem permissão', 'Apenas gerente/admin/dono pode banir usuários.', guildData.panel.accentColor);
    }

    const member = await interaction.guild.members.fetch(ticket.ownerId).catch(() => null);
    if (!member) {
      return replyNotice(interaction, 'Usuário não encontrado', 'Usuário do ticket não encontrado no servidor.', guildData.panel.accentColor);
    }

    const reason = interaction.fields.getTextInputValue('reason');
    await member.ban({ reason: `Ban via ticket por ${interaction.user.tag}: ${reason}` });
    await sendLogMessage(interaction.guild, `<@${interaction.user.id}> baniu **${member.user.tag}**. Motivo: ${reason}`);
    return replyNotice(interaction, 'Usuário banido', `${member.user.tag} foi banido com sucesso.`, guildData.panel.accentColor);
  }

  if (action === 'punish') {
    if (!(await canUseManagerActions(interaction, guildData))) {
      return replyNotice(interaction, 'Sem permissão', 'Apenas gerente/admin/dono pode castigar usuários.', guildData.panel.accentColor);
    }

    const member = await interaction.guild.members.fetch(ticket.ownerId).catch(() => null);
    if (!member) {
      return replyNotice(interaction, 'Usuário não encontrado', 'Usuário do ticket não encontrado no servidor.', guildData.panel.accentColor);
    }

    const minutes = Number(interaction.fields.getTextInputValue('minutes'));
    const reason = interaction.fields.getTextInputValue('reason');

    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 40320) {
      return replyNotice(interaction, 'Tempo inválido', 'Informe um tempo válido entre 1 e 40320 minutos.', guildData.panel.accentColor);
    }

    await member.timeout(minutes * 60 * 1000, `Castigo via ticket por ${interaction.user.tag}: ${reason}`);
    await sendLogMessage(interaction.guild, `<@${interaction.user.id}> aplicou timeout de ${minutes} minuto(s) em **${member.user.tag}**. Motivo: ${reason}`);
    return replyNotice(interaction, 'Timeout aplicado', `${member.user.tag} recebeu timeout de ${minutes} minuto(s).`, guildData.panel.accentColor);
  }
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(client, interaction) {
    try {
      if (interaction.isChatInputCommand()) return handleCommand(client, interaction);

      if (interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('staff_modal:')) return handleStaffModal(interaction);
        if (interaction.customId.startsWith('manage_modal:')) return handleManagementModal(client, interaction);
      }

      if (interaction.isButton()) {
        if (interaction.customId.startsWith('panel_open:')) return handlePublicPanelInteraction(client, interaction);
        if (interaction.customId.startsWith('ticket_')) return handleTicketButton(client, interaction);
        if (interaction.customId.startsWith('manage_')) return handleManagementButton(client, interaction);
      }

      if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('panel_open:')) return handlePublicPanelInteraction(client, interaction);
        if (interaction.customId === 'ticket_staff_panel') return handleTicketStaffMenu(interaction);
        if (interaction.customId.startsWith('manage_')) return handleManagementStringSelect(client, interaction);
      }

      if (interaction.isUserSelectMenu() && interaction.customId.startsWith('manage_user:')) {
        return handleManagementUserSelect(client, interaction);
      }

      if (interaction.isRoleSelectMenu() && interaction.customId.startsWith('manage_role:')) {
        return handleManagementRoleSelect(client, interaction);
      }

      if (interaction.isChannelSelectMenu() && interaction.customId.startsWith('manage_channel:')) {
        return handleManagementChannelSelect(client, interaction);
      }
    } catch (error) {
      logger.error('Erro em interactionCreate.', error);

      const payload = asV2Message(noticePayload(client.config.defaults.accentColor, 'Falha na ação', 'Não foi possível concluir essa ação.'), { ephemeral: true });
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => null);
        return;
      }

      await interaction.reply(payload).catch(() => null);
    }
  }
};
