const { PermissionFlagsBits } = require('discord.js');
const { getSystemData } = require('./database');

async function isOwner(userId) {
  const system = await getSystemData();
  return Boolean(system.ownerId && system.ownerId === userId);
}

function hasRole(member, roleIds = []) {
  return member.roles.cache.some((role) => roleIds.includes(role.id));
}

async function isConfiguredAdmin(member, guildData) {
  if (await isOwner(member.id)) return true;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return guildData.panel.admins.includes(member.id);
}

async function isManager(member, guildData) {
  if (await isConfiguredAdmin(member, guildData)) return true;
  return hasRole(member, guildData.panel.managerRoles);
}

async function isStaff(member, guildData) {
  if (await isManager(member, guildData)) return true;
  return hasRole(member, guildData.panel.staffRoles);
}

async function canManagePanel(interaction, guildData) {
  return isManager(interaction.member, guildData);
}

async function canUseManagerActions(interaction, guildData) {
  return isManager(interaction.member, guildData);
}

async function canUseStaffActions(interaction, guildData) {
  return isStaff(interaction.member, guildData);
}

module.exports = {
  isOwner,
  isConfiguredAdmin,
  isManager,
  isStaff,
  canManagePanel,
  canUseManagerActions,
  canUseStaffActions
};
