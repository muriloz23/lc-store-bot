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
    panels: [
      {
        id: 'suporte',
        name: 'Suporte',
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
      }
    ],
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

  // Migrar dados antigos de panel para panels
  if (data.panel && !data.panels) {
    data.panels = [
      {
        id: 'suporte',
        name: 'Suporte',
        ...data.panel
      }
    ];
    delete data.panel;
  }

  const merged = {
    ...fallback,
    ...data,
    panels: data.panels || fallback.panels,
    logs: {
      ...fallback.logs,
      ...(data.logs || {})
    },
    ticket: {
      ...fallback.ticket,
      ...(data.ticket || {})
    }
  };

  // Validar e sanitizar cada painel
  if (!Array.isArray(merged.panels)) merged.panels = fallback.panels;
  
  merged.panels = merged.panels.map(panel => ({
    id: panel.id || `panel_${Date.now()}`,
    name: panel.name || 'Painel',
    title: panel.title || config.defaults.panelTitle,
    description: panel.description || config.defaults.panelDescription,
    imageUrl: panel.imageUrl || '',
    bannerUrl: panel.bannerUrl || '',
    accentColor: panel.accentColor || config.defaults.accentColor,
    pix: {
      type: panel.pix?.type || 'email',
      key: panel.pix?.key || ''
    },
    admins: Array.isArray(panel.admins) ? panel.admins : [],
    staffRoles: Array.isArray(panel.staffRoles) ? panel.staffRoles : [],
    managerRoles: Array.isArray(panel.managerRoles) ? panel.managerRoles : [],
    pingRoleId: panel.pingRoleId || null,
    buttons: Array.isArray(panel.buttons) ? panel.buttons : [],
    selectMenus: Array.isArray(panel.selectMenus) ? panel.selectMenus : []
  }));

  if (!Array.isArray(merged.blacklist)) merged.blacklist = [];

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
  setLastPanelMessage,
  // Funções auxiliares para gerenciar painéis
  async createPanel(guildId, panelData) {
    const guildData = await getGuildData(guildId);
    const newPanel = {
      id: panelData.id || `panel_${Date.now()}`,
      name: panelData.name || 'Painel',
      title: panelData.title || config.defaults.panelTitle,
      description: panelData.description || config.defaults.panelDescription,
      imageUrl: panelData.imageUrl || '',
      bannerUrl: panelData.bannerUrl || '',
      accentColor: panelData.accentColor || config.defaults.accentColor,
      pix: {
        type: panelData.pix?.type || 'email',
        key: panelData.pix?.key || ''
      },
      admins: Array.isArray(panelData.admins) ? panelData.admins : [],
      staffRoles: Array.isArray(panelData.staffRoles) ? panelData.staffRoles : [],
      managerRoles: Array.isArray(panelData.managerRoles) ? panelData.managerRoles : [],
      pingRoleId: panelData.pingRoleId || null,
      buttons: Array.isArray(panelData.buttons) ? panelData.buttons : [],
      selectMenus: Array.isArray(panelData.selectMenus) ? panelData.selectMenus : []
    };
    
    guildData.panels.push(newPanel);
    await saveGuildData(guildId, guildData);
    return newPanel;
  },
  
  async updatePanel(guildId, panelId, panelData) {
    const guildData = await getGuildData(guildId);
    const panelIndex = guildData.panels.findIndex(p => p.id === panelId);
    
    if (panelIndex === -1) {
      throw new Error('Painel não encontrado');
    }
    
    guildData.panels[panelIndex] = {
      ...guildData.panels[panelIndex],
      ...panelData,
      id: panelId // Garante que o ID não mude
    };
    
    await saveGuildData(guildId, guildData);
    return guildData.panels[panelIndex];
  },
  
  async deletePanel(guildId, panelId) {
    const guildData = await getGuildData(guildId);
    const panelIndex = guildData.panels.findIndex(p => p.id === panelId);
    
    if (panelIndex === -1) {
      throw new Error('Painel não encontrado');
    }
    
    if (guildData.panels.length === 1) {
      throw new Error('Não é possível excluir o único painel restante');
    }
    
    guildData.panels.splice(panelIndex, 1);
    await saveGuildData(guildId, guildData);
    return true;
  },
  
  async getPanel(guildId, panelId) {
    const guildData = await getGuildData(guildId);
    return guildData.panels.find(p => p.id === panelId) || null;
  },
  
  async listPanels(guildId) {
    const guildData = await getGuildData(guildId);
    return guildData.panels;
  }
};
