const crypto = require('node:crypto');
const { ButtonStyle } = require('discord.js');

function hashPassword(password, salt) {
  return crypto
    .createHash('sha256')
    .update(`${password}:${salt}`)
    .digest('hex');
}

function normalizeCustomIdValue(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
}

function parseEmojiInput(input) {
  if (!input) return null;

  const trimmed = input.trim();
  const customMatch = trimmed.match(/^<(a?):([a-zA-Z0-9_]+):(\d+)>$/);

  if (customMatch) {
    return {
      animated: customMatch[1] === 'a',
      name: customMatch[2],
      id: customMatch[3]
    };
  }

  return { name: trimmed };
}

function styleNameToValue(style) {
  const map = {
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger
  };

  return map[style] ?? ButtonStyle.Primary;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderConfigSummary(guildData) {
  return [
    `**Descrição:** ${guildData.panel.description || 'não definida'}`,
    `**Imagem:** ${guildData.panel.imageUrl || 'não definida'}`,
    `**Banner:** ${guildData.panel.bannerUrl || 'não definido'}`,
    `**PIX:** ${guildData.panel.pix.key ? `${guildData.panel.pix.type} - ${guildData.panel.pix.key}` : 'não configurado'}`,
    `**Admins:** ${guildData.panel.admins.length}`,
    `**Cargos staff:** ${guildData.panel.staffRoles.length}`,
    `**Cargos gerente:** ${guildData.panel.managerRoles.length}`,
    `**Ping role:** ${guildData.panel.pingRoleId ? `<@&${guildData.panel.pingRoleId}>` : 'não definido'}`,
    `**Canal de logs:** ${guildData.logs.channelId ? `<#${guildData.logs.channelId}>` : 'não definido'}`,
    `**Canal de transcript:** ${guildData.logs.transcriptChannelId ? `<#${guildData.logs.transcriptChannelId}>` : 'não definido'}`,
    `**Categoria de ticket:** ${guildData.ticket.categoryId ? `<#${guildData.ticket.categoryId}>` : 'não definida'}`,
    `**Botões:** ${guildData.panel.buttons.length}`,
    `**Menus:** ${guildData.panel.selectMenus.length}`,
    `**Blacklist:** ${guildData.blacklist.length}`
  ].join('\n');
}

module.exports = {
  hashPassword,
  normalizeCustomIdValue,
  parseEmojiInput,
  styleNameToValue,
  chunkArray,
  escapeHtml,
  renderConfigSummary
};
