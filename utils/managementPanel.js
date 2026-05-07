const {
  ActionRowBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ContainerBuilder,
  RoleSelectMenuBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  UserSelectMenuBuilder
} = require('discord.js');
const { buildRowsFromButtons } = require('./ui');

function mentionUserList(ids = []) {
  return ids.length ? ids.map((id) => `<@${id}>`).join(', ') : 'nenhum';
}

function mentionRoleList(ids = []) {
  return ids.length ? ids.map((id) => `<@&${id}>`).join(', ') : 'nenhum';
}

function summarizeButtons(guildData) {
  if (!guildData.panel.buttons.length) return 'nenhum';
  return guildData.panel.buttons.map((button) => `\`${button.id}\` (${button.label})`).join(', ');
}

function summarizeMenus(guildData) {
  if (!guildData.panel.selectMenus.length) return 'nenhum';
  return guildData.panel.selectMenus.map((menu) => `\`${menu.id}\` (${menu.options?.length || 0} opção/ões)`).join(', ');
}

function formatTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

function createDashboardSummary(guildData, client) {
  return [
    `Logs: ${guildData.logs.channelId ? `<#${guildData.logs.channelId}>` : 'não definido'}`,
    `Transcript: ${guildData.logs.transcriptChannelId ? `<#${guildData.logs.transcriptChannelId}>` : 'não definido'}`,
    `Categoria de tickets: ${guildData.ticket.categoryId ? `<#${guildData.ticket.categoryId}>` : 'não definida'}`,
    `Admins: ${guildData.panel.admins.length}`,
    `Cargos staff: ${guildData.panel.staffRoles.length}`,
    `Cargos gerente: ${guildData.panel.managerRoles.length}`,
    `Cargo de ping: ${guildData.panel.pingRoleId ? `<@&${guildData.panel.pingRoleId}>` : 'não definido'}`,
    `Botões configurados: ${guildData.panel.buttons.length}`,
    `Menus configurados: ${guildData.panel.selectMenus.length}`,
    `Último painel publicado: ${guildData.ticket.lastPanelMessage?.channelId ? `<#${guildData.ticket.lastPanelMessage.channelId}>` : 'ainda não enviado'}`,
    `Latência: ${Math.round(client.ws.ping || 0)}ms`,
    `Atualizado em: ${formatTimestamp()}`
  ].join('\n');
}

function createMainActionRow() {
  return buildRowsFromButtons([
    { customId: 'manage_modal:text', label: 'Editar texto', style: ButtonStyle.Secondary },
    { customId: 'manage_modal:media', label: 'Editar mídia', style: ButtonStyle.Secondary },
    { customId: 'manage_modal:pix', label: 'Editar PIX', style: ButtonStyle.Secondary },
    { customId: 'manage_action:preview', label: 'Prévia', style: ButtonStyle.Secondary },
    { customId: 'manage_action:publish', label: 'Publicar', style: ButtonStyle.Secondary }
  ])[0];
}

function createManagementSelectRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('manage_action_select')
      .setPlaceholder('Gerenciar equipe e componentes')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        { label: 'Adicionar admin', value: 'admin_add', description: 'Adiciona um usuário à lista de admins' },
        { label: 'Remover admin', value: 'admin_remove', description: 'Remove um usuário da lista de admins' },
        { label: 'Adicionar staff', value: 'staff_add', description: 'Adiciona um cargo à equipe staff' },
        { label: 'Remover staff', value: 'staff_remove', description: 'Remove um cargo da equipe staff' },
        { label: 'Adicionar gerente', value: 'manager_add', description: 'Adiciona um cargo à equipe gerente' },
        { label: 'Remover gerente', value: 'manager_remove', description: 'Remove um cargo da equipe gerente' },
        { label: 'Definir cargo de ping', value: 'ping_set', description: 'Define o cargo usado em notificar staff' },
        { label: 'Adicionar botão', value: 'add_button', description: 'Cria um botão no painel público' },
        { label: 'Remover botão', value: 'remove_button', description: 'Remove um botão do painel público' },
        { label: 'Adicionar menu', value: 'add_menu', description: 'Cria um select menu no painel público' },
        { label: 'Remover menu', value: 'remove_menu', description: 'Remove um select menu do painel público' },
        { label: 'Adicionar opção', value: 'add_option', description: 'Adiciona uma opção a um menu existente' },
        { label: 'Remover opção', value: 'remove_option', description: 'Remove uma opção de um menu existente' },
        { label: 'Limpar botões', value: 'clear_buttons', description: 'Remove todos os botões configurados' },
        { label: 'Limpar menus', value: 'clear_menus', description: 'Remove todos os menus configurados' }
      )
  );
}

function buildHomePanel(guildData, client) {
  const container = new ContainerBuilder().setAccentColor(guildData.panel.accentColor);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('# Painel de configuração')
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(createDashboardSummary(guildData, client))
  );

  container.addSeparatorComponents(new SeparatorBuilder());

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent([
      '**Conteúdo atual**',
      `Título: ${guildData.panel.title}`,
      `Descrição: ${guildData.panel.description || 'não definida'}`,
      `Imagem: ${guildData.panel.imageUrl || 'não definida'}`,
      `Banner: ${guildData.panel.bannerUrl || 'não definido'}`,
      `PIX: ${guildData.panel.pix.key ? `${guildData.panel.pix.type} - ${guildData.panel.pix.key}` : 'não configurado'}`
    ].join('\n'))
  );

  container.addSeparatorComponents(new SeparatorBuilder());

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('manage_channel:logs')
        .setPlaceholder('Definir canal de logs')
        .setChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1)
    ),
    new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('manage_channel:transcript')
        .setPlaceholder('Definir canal de transcript')
        .setChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1)
    ),
    new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('manage_channel:category')
        .setPlaceholder('Definir categoria dos tickets')
        .setChannelTypes(ChannelType.GuildCategory)
        .setMinValues(1)
        .setMaxValues(1)
    ),
    createMainActionRow(),
    createManagementSelectRow()
  );

  return { components: [container] };
}

function buildTeamTargetPanel(guildData, action) {
  const map = {
    admin_add: {
      title: 'Adicionar admin',
      body: 'Selecione o usuário que deve entrar na lista de admins.',
      row: new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder().setCustomId('manage_user:admin_add').setPlaceholder('Selecionar usuário').setMinValues(1).setMaxValues(1)
      )
    },
    admin_remove: {
      title: 'Remover admin',
      body: 'Selecione o usuário que deve sair da lista de admins.',
      row: new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder().setCustomId('manage_user:admin_remove').setPlaceholder('Selecionar usuário').setMinValues(1).setMaxValues(1)
      )
    },
    staff_add: {
      title: 'Adicionar staff',
      body: 'Selecione o cargo que deve entrar na equipe staff.',
      row: new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder().setCustomId('manage_role:staff_add').setPlaceholder('Selecionar cargo').setMinValues(1).setMaxValues(1)
      )
    },
    staff_remove: {
      title: 'Remover staff',
      body: 'Selecione o cargo que deve sair da equipe staff.',
      row: new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder().setCustomId('manage_role:staff_remove').setPlaceholder('Selecionar cargo').setMinValues(1).setMaxValues(1)
      )
    },
    manager_add: {
      title: 'Adicionar gerente',
      body: 'Selecione o cargo que deve entrar na equipe gerente.',
      row: new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder().setCustomId('manage_role:manager_add').setPlaceholder('Selecionar cargo').setMinValues(1).setMaxValues(1)
      )
    },
    manager_remove: {
      title: 'Remover gerente',
      body: 'Selecione o cargo que deve sair da equipe gerente.',
      row: new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder().setCustomId('manage_role:manager_remove').setPlaceholder('Selecionar cargo').setMinValues(1).setMaxValues(1)
      )
    },
    ping_set: {
      title: 'Definir cargo de ping',
      body: 'Selecione o cargo que será usado em notificar staff.',
      row: new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder().setCustomId('manage_role:ping_set').setPlaceholder('Selecionar cargo').setMinValues(1).setMaxValues(1)
      )
    }
  };

  const selected = map[action] || map.admin_add;
  const container = new ContainerBuilder().setAccentColor(guildData.panel.accentColor);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`# ${selected.title}`)
  );

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent([
      selected.body,
      '',
      `Admins: ${mentionUserList(guildData.panel.admins)}`,
      `Staff: ${mentionRoleList(guildData.panel.staffRoles)}`,
      `Gerentes: ${mentionRoleList(guildData.panel.managerRoles)}`,
      `Cargo de ping: ${guildData.panel.pingRoleId ? `<@&${guildData.panel.pingRoleId}>` : 'não definido'}`
    ].join('\n'))
  );

  container.addSeparatorComponents(new SeparatorBuilder());
  container.addActionRowComponents(selected.row, ...buildRowsFromButtons([
    { customId: 'manage_nav:home', label: 'Voltar', style: ButtonStyle.Secondary }
  ]));

  return { components: [container] };
}

function buildAliasPanel(guildData, client) {
  return buildHomePanel(guildData, client || { ws: { ping: 0 } });
}

module.exports = {
  buildHomePanel,
  buildContentPanel: buildAliasPanel,
  buildChannelsPanel: buildAliasPanel,
  buildComponentsPanel: buildAliasPanel,
  buildTeamPanel: buildAliasPanel,
  buildTeamTargetPanel,
  summarizeButtons,
  summarizeMenus
};
