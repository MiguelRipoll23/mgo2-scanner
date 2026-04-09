import startDnsServer from './dns-server.js';

startDnsServer().catch(() => {
  process.exit(1);
});
