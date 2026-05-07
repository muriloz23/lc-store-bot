const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const GUILDS_DIR = path.join(DATA_DIR, 'guilds');
const TICKETS_DIR = path.join(DATA_DIR, 'tickets');
const TRANSCRIPTS_DIR = path.join(DATA_DIR, 'transcripts');
const SYSTEM_FILE = path.join(DATA_DIR, 'system.json');

function getDefaultSystemData() {
  return {
    ownerId: null,
    ownerPasswordHash: null,
    ownerCreatedAt: null,
    ownerRecoveredAt: null
  };
}

function getDefaultGuildData(guildId) {
  return {
    guildId,
    panel: {
      title: config.defaults.panelTitle,
      description: config.defaults.panelDescription,
      imageUrl: '',
      bannerUrl: '',
      accentColor: config.defaults.accentColor,
      pix: {
        type: 'email',
        key: ''
      },
      admins: [],
      staffRoles: [],
      managerRoles: [],
      pingRoleId: null,
      buttons: [
        {
          id: 'suporte',
          label: 'Suporte',
          style: 2
        }
      ],
      selectMenus: [
        {
          id: 'atendimento',
          placeholder: 'Escolha o setor',
          options: [
            {
              value: 'financeiro',
              label: 'Financeiro',
              description: 'Dúvidas sobre cobrança e pagamento'
            },
            {
              value: 'suporte_tecnico',
              label: 'Suporte técnico',
              description: 'Problemas técnicos e atendimento geral'
            }
          ]
        }
      ]
    },
    logs: {
      channelId: null,
      transcriptChannelId: null
    },
    ticket: {
      categoryId: config.defaults.ticketCategoryId,
      lastPanelMessage: null,
      counter: 0
    },
    blacklist: []
  };
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function readJson(filePath, fallbackFactory) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return fallbackFactory();
  }
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

async function ensureBaseData() {
  await ensureDir(DATA_DIR);
  await ensureDir(GUILDS_DIR);
  await ensureDir(TICKETS_DIR);
  await ensureDir(TRANSCRIPTS_DIR);

  try {
    await fs.access(SYSTEM_FILE);
  } catch {
    await writeJson(SYSTEM_FILE, getDefaultSystemData());
  }
}

async function getSystemData() {
  return readJson(SYSTEM_FILE, getDefaultSystemData);
}

async function saveSystemData(data) {
  return writeJson(SYSTEM_FILE, data);
}

function getGuildFile(guildId) {
  return path.join(GUILDS_DIR, `${guildId}.json`);
}

async function getGuildData(guildId) {
  const fallback = getDefaultGuildData(guildId);
  const data = await readJson(getGuildFile(guildId), () => fallback);

  const merged = {
    ...fallback,
    ...data,
    panel: {
      ...fallback.panel,
      ...(data.panel || {}),
      pix: {
        ...fallback.panel.pix,
        ...(data.panel?.pix || {})
      }
    },
    logs: {
      ...fallback.logs,
      ...(data.logs || {})
    },
    ticket: {
      ...fallback.ticket,
      ...(data.ticket || {})
    }
  };

  if (!Array.isArray(merged.panel.buttons)) merged.panel.buttons = [];
  if (!Array.isArray(merged.panel.selectMenus)) merged.panel.selectMenus = [];
  if (!Array.isArray(merged.panel.admins)) merged.panel.admins = [];
  if (!Array.isArray(merged.panel.staffRoles)) merged.panel.staffRoles = [];
  if (!Array.isArray(merged.panel.managerRoles)) merged.panel.managerRoles = [];
  if (!Array.isArray(merged.blacklist)) merged.blacklist = [];

  if (!data.panel?.accentColor || data.panel.accentColor === 0x5865F2) {
    merged.panel.accentColor = config.defaults.accentColor;
  }

  await saveGuildData(guildId, merged);
  return merged;
}

async function saveGuildData(guildId, data) {
  await writeJson(getGuildFile(guildId), data);
  return data;
}

function getTicketFile(channelId) {
  return path.join(TICKETS_DIR, `${channelId}.json`);
}

async function createTicketRecord(data) {
  const payload = {
    channelId: data.channelId,
    guildId: data.guildId,
    ownerId: data.ownerId,
    openedBy: data.ownerId,
    source: data.source,
    extraUsers: [],
    claimedBy: null,
    closedBy: null,
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ticketNumber: data.ticketNumber
  };

  await writeJson(getTicketFile(data.channelId), payload);
  return payload;
}

async function getTicketByChannelId(channelId) {
  return readJson(getTicketFile(channelId), () => null);
}

async function updateTicket(channelId, patch) {
  const ticket = await getTicketByChannelId(channelId);
  if (!ticket) return null;

  const next = {
    ...ticket,
    ...patch,
    updatedAt: new Date().toISOString()
  };

  await writeJson(getTicketFile(channelId), next);
  return next;
}

async function addExtraUserToTicket(channelId, userId) {
  const ticket = await getTicketByChannelId(channelId);
  if (!ticket) return null;

  if (!ticket.extraUsers.includes(userId)) {
    ticket.extraUsers.push(userId);
    ticket.updatedAt = new Date().toISOString();
    await writeJson(getTicketFile(channelId), ticket);
  }

  return ticket;
}

async function getAllTickets() {
  const files = (await fs.readdir(TICKETS_DIR)).filter((file) => file.endsWith('.json'));
  const tickets = [];

  for (const file of files) {
    const item = await readJson(path.join(TICKETS_DIR, file), () => null);
    if (item) tickets.push(item);
  }

  return tickets;
}

async function findOpenTicketByUser(guildId, userId) {
  const tickets = await getAllTickets();
  return tickets.find((ticket) => ticket.guildId === guildId && ticket.ownerId === userId && ticket.status === 'open') || null;
}

async function addUserToBlacklist(guildId, userId) {
  const guildData = await getGuildData(guildId);

  if (!guildData.blacklist.includes(userId)) {
    guildData.blacklist.push(userId);
    await saveGuildData(guildId, guildData);
  }

  return guildData;
}

async function incrementTicketCounter(guildId) {
  const guildData = await getGuildData(guildId);
  guildData.ticket.counter += 1;
  await saveGuildData(guildId, guildData);
  return guildData.ticket.counter;
}

async function setLastPanelMessage(guildId, data) {
  const guildData = await getGuildData(guildId);
  guildData.ticket.lastPanelMessage = data;
  await saveGuildData(guildId, guildData);
  return guildData.ticket.lastPanelMessage;
}

module.exports = {
  ROOT,
  DATA_DIR,
  GUILDS_DIR,
  TICKETS_DIR,
  TRANSCRIPTS_DIR,
  ensureBaseData,
  getSystemData,
  saveSystemData,
  getGuildData,
  saveGuildData,
  createTicketRecord,
  getTicketByChannelId,
  updateTicket,
  addExtraUserToTicket,
  findOpenTicketByUser,
  addUserToBlacklist,
  incrementTicketCounter,
  setLastPanelMessage
};
