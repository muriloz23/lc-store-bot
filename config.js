module.exports = {
  token: process.env.DISCORD_BOT_TOKEN,
  clientId: '1424131230881808445',
  guildId: '855845485922484244', // Servidor LC STORE GRÁFICOS
  roleId: '1237287191542235198', // Cargo a ser dado após compra

  bot: {
    status: 'online',
    activityType: 'Watching',
    activityName: 'by zn.'
  },
  defaults: {
    accentColor: 0x2B2D31,
    panelTitle: 'Central de Atendimento',
    panelDescription: 'Escolha uma opção abaixo para abrir seu atendimento.',
    ticketCategoryId: null,
    closeDeleteDelayMs: 5000,
    preventMultipleOpenTickets: true
  },

  transcript: {
    saveToDisk: true,
    folder: './data/transcripts'
  },
  security: {
    ownerPasswordSalt: 'znbots'
  },
  notes: {
    appBio: 'A bio do aplicativo do bot não pode ser alterada por runtime via discord.js. Defina manualmente no Developer Portal: by kezzynovo.'
  }
};
