var Promise         = require('promise');
var logger          = require('../config/logger');
var settings        = require('../config/settings');
var Decimal         = require('decimal.js');

module.exports = function(dependencies) {
  var addressBO = dependencies.addressBO;
  var daemonHelper = dependencies.daemonHelper;
  var dateHelper = dependencies.dateHelper;

  return {
    dependencies: dependencies,
    isRunning: false,

    run: function() {
      var self = this;

      logger.info('[BFSWorker] Starting the service');

      if (!this.isRunning) {
        self.isRunning = true;

        return this.forwardBalances()
          .then(function() {
              self.isRunning = false;

              logger.info('[BFSWorker] A new verification will occurr in 10s');
              setTimeout(function() {
                self.run();
              }, 10 * 1000);
          });
      } else {
        logger.info('[BFSWorker] The process still running... this execution will be skiped');
      }
    },

    estimateFeeData: function(ethTransaction) {
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();
        var estimatedGas = 0;
        var gasPrice = 0;

        return chain
          .then(function() {
            logger.info('[BFSWorker.estimateGas()] Estimating the fee', JSON.stringify(ethTransaction));

            return daemonHelper.estimateGas(ethTransaction)
              .then(function(r) {
                estimatedGas = r > settings.daemonSettings.gasLimit ? settings.daemonSettings.gasLimit : r;
                return daemonHelper.getGasPrice();
              })
              .then(function(r) {
                gasPrice = r;
                return gasPrice * estimatedGas;
              });
          })
          .then(function(r) {

            logger.debug('[BFSWorker.estimateGas()] Estimated gasPrice', gasPrice);
            logger.debug('[BFSWorker.estimateGas()] Estimated estimatedGas', estimatedGas);
            logger.debug('[BFSWorker.estimateGas()] Estimated fee', r);

            return {
              estimatedGas: estimatedGas,
              gasPrice: gasPrice,
              estimatedFee: r
            };
          })
          .then(resolve)
          .catch(reject);
        });
    },

    forwardBalance: function(estimatedData, baseEthTransaction) {
      var self = this;

      return new Promise(function(resolve) {
        var chain = Promise.resolve();
        var transaction = Object.assign({}, baseEthTransaction);

        chain
          .then(function() {
            return addressBO.getAddressToForwardBalance(estimatedData.estimatedFee, settings.daemonSettings.mainAddress);
          })
          .then(function(r) {
            if (r.length > 0) {
              var address = r[0];
              return addressBO.setIsForwardingStatus(address.id, true)
                .then(function() {
                  transaction.from = address.address;
                  transaction.amount = parseInt(new Decimal(address.balance.available).minus(estimatedData.estimatedFee).toFixed(0));

                  logger.debug('[TBFSWorker] Sending transaction', JSON.stringify(transaction));

                  return daemonHelper.sendTransaction(transaction, address.privateKey)
                    .then(function(e) {
                      logger.info('[BFSWorker] Balance forwarded successfully!', address.address, address.balance.available, e);
                      return e;
                    })
                    .catch(function(e) {
                      logger.error('[BFSWorker] An error has occurred while forwarding balance it will be tried again', address.address, address.balance.available, e);
                    });
                })
                .then(function(r) {
                  if (r) {
                    var history = {
                      to: transaction.to,
                      amount: transaction.amount,
                      createdAt: dateHelper.getNow(),
                      transactionHash: r.transactionHash
                    };

                    return addressBO.addForwardHistory(address.id, transaction.amount + estimatedData.estimatedFee, history);
                  } else {
                    return addressBO.setIsForwardingStatus(address.id, true);
                  }
                })
                .then(function() {
                  return self.forwardBalance(estimatedData, baseEthTransaction);
                });
            } else {
              return true;
            }
          })
          .then(resolve)
          .catch(function(r) {
            console.log(r);
            resolve(true);
          });
      });
    },

    forwardBalances: function() {
      var self = this;

      return new Promise(function(resolve) {
        var chain = Promise.resolve();
        logger.info('[BFSWorker] Starting Balance Forwarder Service');
        var ethTransaction = null;

        chain
          .then(function() {
            ethTransaction = {
              from: settings.daemonSettings.mainAddress,
              to: settings.daemonSettings.mainAddress,
              amount: 0,
              gasLimit: 0,
              gasPrice: 0
            };

            return self.estimateFeeData(ethTransaction);
          })
          .then(function(r) {

            ethTransaction.gasLimit = r.estimatedGas;
            ethTransaction.gasPrice = r.gasPrice;

            logger.info('[BFSWorker] Forwarding balance...');
            return self.forwardBalance(r, ethTransaction);
          })
          .then(function() {
            logger.info('[BFSWorker] A new verification will occurr in 10s');
            resolve(true);
          })
          .catch(function(r) {
            console.log(r);
            logger.error('[BFSWorker] An error has occurred while running the service', JSON.stringify(r));
            resolve(true);
          });
      });
    }
  };
};
