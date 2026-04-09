import startDnsServer from './dns-server';

startDnsServer().catch(() => {
  process.exit(1);
});
