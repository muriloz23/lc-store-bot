const fs = require('node:fs/promises');
const path = require('node:path');
const { AttachmentBuilder } = require('discord.js');
const config = require('../config');
const { TRANSCRIPTS_DIR } = require('./database');
const { escapeHtml } = require('./helpers');

async function fetchAllMessages(channel) {
  const collected = [];
  let lastId = null;

  while (true) {
    const batch = await channel.messages.fetch({
      limit: 100,
      ...(lastId ? { before: lastId } : {})
    });

    if (!batch.size) break;
    collected.push(...batch.values());
    lastId = batch.last().id;
  }

  return collected.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
}

function renderMessage(message) {
  const attachments = [...message.attachments.values()]
    .map((attachment) => `<div class="attachment"><a href="${escapeHtml(attachment.url)}" target="_blank">${escapeHtml(attachment.name || 'arquivo')}</a></div>`)
    .join('');

  return `
    <article class="message">
      <img class="avatar" src="${escapeHtml(message.author.displayAvatarURL({ extension: 'png', size: 128 }))}" alt="avatar">
      <div class="body">
        <div class="head">
          <span class="author">${escapeHtml(message.author.tag)}</span>
          <span class="time">${new Date(message.createdTimestamp).toLocaleString('pt-BR')}</span>
        </div>
        <div class="content">${escapeHtml(message.content || '[sem conteúdo textual]').replace(/\n/g, '<br>')}</div>
        ${attachments}
      </div>
    </article>
  `;
}

function buildHtml(channel, ticket, messages) {
  const body = messages.map(renderMessage).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Transcript - ${escapeHtml(channel.name)}</title>
  <style>
    body { background: #0f1115; color: #e8ecf1; font-family: Inter, Arial, sans-serif; margin: 0; padding: 24px; }
    .card { max-width: 1100px; margin: 0 auto; background: #181c23; border: 1px solid #2a3140; border-radius: 18px; overflow: hidden; }
    .header { padding: 24px; border-bottom: 1px solid #2a3140; background: #11151b; }
    .header h1 { margin: 0 0 12px; font-size: 22px; }
    .meta { color: #9aa4b2; line-height: 1.7; }
    .messages { padding: 18px 24px 24px; }
    .message { display: flex; gap: 14px; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,.06); }
    .message:last-child { border-bottom: 0; }
    .avatar { width: 42px; height: 42px; border-radius: 50%; flex: 0 0 auto; }
    .head { display: flex; gap: 12px; align-items: center; margin-bottom: 6px; }
    .author { font-weight: 700; }
    .time { color: #8b94a3; font-size: 12px; }
    .content { line-height: 1.7; white-space: normal; word-break: break-word; }
    .attachment { margin-top: 8px; }
    a { color: #7ab8ff; text-decoration: none; }
  </style>
</head>
<body>
  <section class="card">
    <header class="header">
      <h1>Transcript do ticket ${escapeHtml(channel.name)}</h1>
      <div class="meta">
        Servidor: ${escapeHtml(channel.guild.name)}<br>
        Dono do ticket: ${escapeHtml(ticket.ownerId)}<br>
        Criado em: ${escapeHtml(ticket.createdAt)}<br>
        Total de mensagens: ${messages.length}
      </div>
    </header>
    <main class="messages">
      ${body || '<p>Nenhuma mensagem encontrada.</p>'}
    </main>
  </section>
</body>
</html>`;
}

async function createTranscriptFile(channel, ticket) {
  const messages = await fetchAllMessages(channel);
  const html = buildHtml(channel, ticket, messages);

  await fs.mkdir(TRANSCRIPTS_DIR, { recursive: true });

  const safeName = `${channel.name}-${Date.now()}.html`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const absolutePath = path.join(TRANSCRIPTS_DIR, safeName);

  // Sempre salvar no disco
  await fs.writeFile(absolutePath, html, 'utf8');

  // Gerar URL pública usando o domínio do bot
  const botUrl = process.env.BOT_URL || 'http://localhost:80';
  const publicUrl = `${botUrl}/transcripts/${safeName}`;

  return {
    path: absolutePath,
    fileName: safeName,
    url: publicUrl,
    attachment: new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: safeName }),
    messageCount: messages.length
  };
}

module.exports = {
  createTranscriptFile
};
