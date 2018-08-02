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
      minimumConfirmations: process.env.MIN_CONFIRMATIONS || 3,
      minimumAddressPoolSize: process.env.MIN_ADDRESS_POOL_SIZE || 100,
      currentBlockNumber: 1000,
      transactionNotificationAPI: process.env.NOTIFICATION_API_ADDRESS || 'http://localhost:3004/v1/wallets/${symbol}/notifications'
    },

    mutex: {
      host: process.env.REDIS_DB_SERVER || 'localhost'
    },

    daemonSettings: {
      previousBlocksToCheck: 100,
      gasLimit: process.env.DAEMON_GAS_LIMIT || 4712388,
      //baseUrl: process.env.DAEMON_BASE_URL || 'https://ropsten.infura.io',
      //baseUrl: process.env.DAEMON_BASE_URL || 'https://ropsten.infura.io/q4jm34Psz0hLbGQAfZjs',
      //baseUrl: process.env.DAEMON_BASE_URL || 'http://localhost:7545',
      baseUrl: process.env.DAEMON_BASE_URL || 'http://localhost:8545',
      defaultSymbol: process.env.DAEMON_DEFAULT_SYMBPL || 'ETH',
      mainAddress: process.env.DAEMON_MAIN_ADDRESS || '0x6025961e3F43AeB967f28A0aD88E46860b85def4',
      erc20TransferGasLimit: process.env.DAEMON_ER20_TRANSFER_GAST_LIMIT || 57381
    }
  };
