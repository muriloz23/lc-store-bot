const express = require('express');
const { REST, Routes } = require('discord.js');

const config = require('../config');
const logger = require('../utils/logger');

// Configuração do Discord REST para dar cargo
const rest = new REST().setToken(config.token);

const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  try {
    const { action, discordId, username, product, roleId, guildId } = req.body;

    const targetRoleId = roleId || config.roleId;
    const targetGuildId = guildId || config.guildId;

    if (action !== 'assign_role' || !discordId || !targetRoleId || !targetGuildId) {
      return res.status(400).json({ error: 'Parâmetros inválidos' });
    }

    logger.info(`[Webhook] Recebido pedido para dar cargo: ${username} (${discordId}) - Cargo: ${targetRoleId}`);

    // Adicionar cargo ao usuário no servidor
    await rest.put(
      Routes.guildMemberRole(targetGuildId, discordId, targetRoleId),
      { reason: `Compra aprovada: ${product}` }
    );

    logger.info(`[Webhook] Cargo ${targetRoleId} adicionado para ${username} (${discordId}) no servidor ${targetGuildId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('[Webhook] Erro ao adicionar cargo:', error);
    res.status(500).json({ error: 'Erro ao adicionar cargo' });
  }
});

module.exports = { app };
