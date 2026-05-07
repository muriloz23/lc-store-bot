const { PrismaClient } = require('@prisma/client');
const { REST, Routes } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});
const rest = new REST().setToken(config.token);

// Guarda IDs de compras já processadas para não duplicar
const processedPurchases = new Set();

async function checkApprovedPurchases() {
  try {
    // Buscar compras aprovadas que ainda não têm cargo
    const approvedPurchases = await prisma.purchase.findMany({
      where: {
        status: 'approved',
        // Adicionar campo para rastrear se cargo foi dado
      },
      include: {
        user: true
      }
    });

    for (const purchase of approvedPurchases) {
      if (processedPurchases.has(purchase.id)) continue;

      const { user } = purchase;

      if (user.discordId) {
        try {
          // Dar cargo no Discord
          await rest.put(
            Routes.guildMemberRole(config.guildId, user.discordId, config.roleId),
            { reason: `Compra aprovada: ${purchase.product}` }
          );

          logger.info(`[Purchase Handler] Cargo dado para ${user.username} (${user.discordId}) - Compra: ${purchase.product}`);
          processedPurchases.add(purchase.id);

          // Marcar compra como processada (pode adicionar campo ao schema)
          // await prisma.purchase.update({
          //   where: { id: purchase.id },
          //   data: { roleAssigned: true }
          // });
        } catch (error) {
          logger.error(`[Purchase Handler] Erro ao dar cargo para ${user.username}:`, error);
        }
      }
    }

    logger.info(`[Purchase Handler] Verificação concluída. ${approvedPurchases.length} compras aprovadas encontradas.`);
  } catch (error) {
    logger.error('[Purchase Handler] Erro ao verificar compras:', error);
  }
}

// Verificar a cada 30 segundos
setInterval(checkApprovedPurchases, 30000);

// Verificar imediatamente ao iniciar
checkApprovedPurchases();

module.exports = { checkApprovedPurchases };
