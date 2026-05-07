const express = require('express');
const { REST, Routes } = require('discord.js');
const { readFile } = require('fs/promises');
const { join } = require('path');

const config = require('../config');
const logger = require('../utils/logger');

// Configuração do Discord REST para dar cargo
const rest = new REST().setToken(config.token);

const app = express();
app.use(express.json());

// Endpoint para servir transcripts HTML
app.get('/transcripts/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const transcriptPath = join(process.cwd(), 'data', 'transcripts', filename);
    
    const html = await readFile(transcriptPath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error('[Transcript] Erro ao servir transcript:', error);
    res.status(404).send('Transcript não encontrado');
  }
});

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
