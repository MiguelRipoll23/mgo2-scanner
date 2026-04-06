'use strict';

const startDnsServer = require('./dns-server');

startDnsServer().catch(err => {
  process.exit(1);
});
