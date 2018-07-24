var Promise         = require('promise');
var logger          = require('../config/logger');

module.exports = function(dependencies) {
  var transactionBO = dependencies.transactionBO;
  var requestHelper = dependencies.requestHelper;
  var configurationBO = dependencies.configurationBO;

  return {
    dependencies: dependencies,
    isRunning: false,

    run: function() {
      var self = this;

      if (!this.isRunning) {
        self.isRunning = true;

        return this.notifyConfirmedTransactions()
          .then(function() {
              self.isRunning = false;

              logger.info('[TNSWorker] A new verification will occurr in 10s');
              setTimeout(function() {
                self.run();
              }, 10 * 1000);
          });
      } else {
        logger.info('[TNSWorker] The process still running... this execution will be skiped');
      }
    },

    notifyConfirmedTransactions: function() {
      var chain = Promise.resolve();
      var transactions = null;
      var transactionNotificationAPI = null;

      return new Promise(function(resolve) {
        logger.info('[TNSWorker] Starting Transaction Notifier Service');

        chain
          .then(function() {
            return configurationBO.getByKey('transactionNotificationAPI');
          })
          .then(function(r) {
            transactionNotificationAPI = r.value;

            logger.info('[TNSWorker] Getting unnotified transactions from database');
            return transactionBO.getTransactionsToNotify();
          })
          .then(function(r) {
            logger.info('[TNSWorker] Returned unnotified transactions from database', r.transactionHash);
            transactions = r;
            var p = [];

            logger.info('[TNSWorker] Sending the notifications about transactions');

            for (var i = 0; i < transactions.length; i++) {
              logger.info('[TNSWorker] Notifiyng about the transaction', transactions[i].transactionHash);
              var notificationPromise = new Promise(function(resolve) {
                endpoint = transactionNotificationAPI.replace('${symbol}', transactions[i].symbol);
                requestHelper.postJSON(
                  endpoint,
                  [],
                  transactions[i],
                  [200])
                  .then(function(){
                    resolve({isError: false});
                  })
                  .catch(function(e) {
                    resolve({isError: true, error: e});
                  });
              });
              p.push(notificationPromise);
            }

            return Promise.all(p);
          })
          .then(function(r) {
            var p = [];

            logger.info('[TNSWorker] Updating the flag is notified for the transactions', transactions.length);

            for (var i = 0; i < transactions.length; i++) {
              if (!r[i].isError) {
                if (!transactions[i].notifications.creation.isNotified) {
                  logger.info('[TNSWorker] Updating the flag notifications.creating.isNotified for the transaction', transactions[i].transactionHash);
                  p.push(new Promise(function(resolve) {
                    transactionBO.updateIsCreationNotifiedFlag(transactions[i].id)
                      .then(resolve)
                      .catch(function(e) {
                        logger.error('[TNSWorker] An error has occorred while updating notifications.creating.isNotified flag', JSON.stringify(e));
                      });
                  }));
                } else {
                  logger.info('[TNSWorker] Updating the flag notifications.confirmation.isNotified for the transaction', transactions[i].transactionHash);

                  p.push(new Promise(function(resolve) {
                    transactionBO.updateIsConfirmationNotifiedFlag(transactions[i].id)
                      .then(resolve)
                      .catch(function(e) {
                        logger.error('[TNSWorker] An error has occorred while updating notifications.confirmation.isNotified flag', JSON.stringify(e));
                      });
                  }));
                }
              } else {
                logger.info('[TNSWorker] The notification has failed to ', transactionNotificationAPI, transactions[i].transactionHash, r[i].error);
              }
            }

            logger.debug('[TNSWorker] Returning promises', p.length);
            return Promise.all(p);
          })
          .then(function() {
            logger.info('[TNSWorker] A new verification will occurr in 10s');
            resolve(true);
          })
          .catch(function(r) {
            logger.error('[TNSWorker] An error has occurred while notifying unnotified transactions', r.transactionHash);
            resolve(true);
          });
      });
    }
  };
};
