const dns = require('dns');

dns.resolveSrv(
  '_mongodb._tcp.cluster0.vixw6gg.mongodb.net',
  (err, records) => {
    if (err) {
      console.error(err);
      return;
    }

    console.log(records);
  }
);