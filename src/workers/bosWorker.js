var Promise         = require('promise');
var settings        = require('../config/settings');
var logger          = require('../config/logger');

module.exports = function(dependencies) {
  var transactionBO = dependencies.transactionBO;
  var addressBO = dependencies.addressBO;
  var configurationBO = dependencies.configurationBO;
  var daemonHelper = dependencies.daemonHelper;

  return {
    dependencies: dependencies,
    isRunning: false,
    addresses: {},

    run: function() {
      var self = this;

      if (!this.isRunning) {
        self.isRunning = true;

        return this.synchronizeToBlockchain()
          .then(function() {
              self.isRunning = false;

              logger.info('[BOSWorker] A new verification will occurr in 10s');
              setTimeout(function() {
                self.run();
              }, 10 * 1000);
          });
      } else {
        logger.info('[BOSWorker] The process still running... this execution will be skiped');
      }
    },

    parseTransactionsFromDaemon: function(transactions, currentBlockNumber) {
      var p = [];
      logger.info('[BOSWorker] Total of blockchain transactions', transactions.length);

      for (var i = 0; i < transactions.length; i++) {
        var transaction = transactions[i];
        if (this.addresses[transaction.to] || this.addresses[transaction.from]) {
          logger.info('[BOSWorker] Parsing the transaction', transactions[i].hash, JSON.stringify(transactions[i]));

          var pTransaction = new Promise(function(resolve) {
            transactionBO.parseTransaction(transactions[i], currentBlockNumber)
              .then(resolve)
              .catch(resolve);
          });

          p.push(pTransaction);
        } else {
          logger.info('[BOSWorker] Ignoring the transaction', transactions[i].hash, JSON.stringify(transactions[i]));
        }
      }

      logger.debug('[BOSWorker] Returning promises', p.length);
      return Promise.all(p);
    },

    synchronizeToBlockchain: function() {
      var self = this;
      var chain = Promise.resolve();
      var currentBlockNumber = 0;
      var blockCount = 0;

      return new Promise(function(resolve) {
        logger.info('[BOSWorker] Starting Blockchain Observer Service');

        return chain
          .then(function() {
            logger.info('[BOSWorker] Getting current block number');
            return configurationBO.getByKey('currentBlockNumber');
          })
          .then(function(r) {
            currentBlockNumber = parseInt(r.value);
            logger.info('[BOSWorker] Getting the address from database');
            return addressBO.getAll();
          })
          .then(function(r) {
            r.forEach(function(address) {
              self.addresses[address.address] = true;
            });

            logger.info('[BOSWorker] Getting the block number from daemon');
            return daemonHelper.getBlockNumber();
          })
          .then(function(r) {
            blockCount = r;
            logger.info('[BOSWorker] The current block number is', currentBlockNumber);
            logger.info('[BOSWorker] The current block count is', blockCount);

            start = currentBlockNumber - settings.daemonSettings.previousBlocksToCheck;

            if (start < 0) {
              start = 0;
            }

            logger.info('[BOSWorker] Getting transactions from blocks', start, currentBlockNumber);
            return daemonHelper.getTransactions(start, currentBlockNumber);
          })
          .then(function(r) {
            logger.info('[BOSWorker] Parsing blockchain transactions', r.length);
            return self.parseTransactionsFromDaemon(r, currentBlockNumber);
          })
          .then(function() {

            logger.info(currentBlockNumber, blockCount, currentBlockNumber > blockCount);
            currentBlockNumber += settings.daemonSettings.previousBlocksToCheck;

            if (currentBlockNumber > blockCount) {
              currentBlockNumber = blockCount;
            }
            logger.info('[BOSWorker] Updating currentBlockNumber to ', currentBlockNumber);

            return configurationBO.update({key:'currentBlockNumber', value: currentBlockNumber});
          })
          .then(function() {
            logger.info('[BOSWorker] Blockchain Observer Service has finished this execution');
            return true;
          })
          .then(resolve)
          .catch(function(r) {
            logger.error('[BOSWorker] An error has occurred whiling synchronizing to daemon', JSON.stringify(r));
            //even if a error has occurred the process must continue
            resolve(true);
          });
      });
    }
  };
};
