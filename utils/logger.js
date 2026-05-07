function stamp() {
  return new Date().toISOString();
}

function write(level, message, error = null) {
  const base = `[${stamp()}] [${level}] ${message}`;
  if (!error) {
    console.log(base);
    return;
  }

  console.error(base);
  console.error(error);
}

module.exports = {
  info(message) {
    write('INFO', message);
  },
  warn(message) {
    write('WARN', message);
  },
  error(message, error) {
    write('ERROR', message, error);
  }
};
