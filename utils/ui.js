const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder
} = require('discord.js');
const { chunkArray } = require('./helpers');

function makeButton(definition) {
  if (definition instanceof ButtonBuilder) return definition;

  const button = new ButtonBuilder()
    .setCustomId(definition.customId)
    .setLabel(definition.label)
    .setStyle(definition.style ?? ButtonStyle.Secondary);

  if (definition.disabled) button.setDisabled(true);

  return button;
}

function addTextBlock(container, title, body) {
  const content = [title ? `# ${title}` : null, body].filter(Boolean).join('\n');
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content || '# Painel'));
}

function buildContainerPayload({
  title,
  body,
  accentColor = 0x5865F2,
  rows = [],
  includeSeparator = false,
  footer = null
}) {
  const container = new ContainerBuilder().setAccentColor(accentColor);
  addTextBlock(container, title, body);

  if (includeSeparator || footer) {
    container.addSeparatorComponents(new SeparatorBuilder());
  }

  for (const row of rows) {
    container.addActionRowComponents(row);
  }

  if (footer) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));
  }

  return { components: [container] };
}

function buildRowsFromButtons(buttons = []) {
  return chunkArray(buttons, 5).map((group) => {
    const row = new ActionRowBuilder();
    row.addComponents(group.map(makeButton));
    return row;
  });
}

function asV2Message(payload, { ephemeral = false, ...extra } = {}) {
  return {
    ...payload,
    ...extra,
    flags: MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0)
  };
}

module.exports = {
  buildContainerPayload,
  buildRowsFromButtons,
  asV2Message,
  makeButton
};
