var util      = require('util');

module.exports = {
    mongoUrl : util.format('mongodb://%s/%s',
                      process.env.DB_SERVER || 'localhost',
                      process.env.DB_NAME   || 'eth-services'),
    servicePort : process.env.PORT || 4000,
    isMongoDebug : true,
    jwt: {
      secret: 'SECRET_DEV',
      expiresIn: '1h'
    },

    defaultSettings: {
      minimumConfirmations: 6,
      minimumAddressPoolSize: 0,
      currentBlockNumber: 1000,
      transactionNotificationAPI: process.env.NOTIFICATION_API_ADDRESS || 'http://localhost:3004/v1/wallets/BRLT/notifications'
    },

    mutex: {
      host: process.env.REDIS_DB_SERVER || 'localhost'
    },

    daemonSettings: {
      previousBlocksToCheck: 100,
      gasLimit: process.env.DAEMON_GAS_LIMIT ||4712388,
      //baseUrl: process.env.DAEMON_BASE_URL || 'https://ropsten.infura.io',
      //baseUrl: process.env.DAEMON_BASE_URL || 'https://ropsten.infura.io/q4jm34Psz0hLbGQAfZjs',
      //baseUrl: process.env.DAEMON_BASE_URL || 'http://localhost:7545',
      baseUrl: process.env.DAEMON_BASE_URL || 'http://localhost:8545',
    }
  };
