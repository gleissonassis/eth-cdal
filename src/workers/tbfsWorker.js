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

      logger.info('[TBFSWorker] Starting the service');

      if (!this.isRunning) {
        self.isRunning = true;

        return this.forwardTokenBalances()
          .then(function() {
              self.isRunning = false;

              logger.info('[TBFSWorker] A new verification will occurr in 10s');
              setTimeout(function() {
                self.run();
              }, 10 * 1000);
          });
      } else {
        logger.info('[TBFSWorker] The process still running... this execution will be skiped');
      }
    },

    estimateERC20TransferFeeData: function() {
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();
        var estimatedGas = settings.daemonSettings.erc20TransferGasLimit;
        var gasPrice = 0;

        return chain
          .then(function() {
            return daemonHelper.getGasPrice();
          })
          .then(function(r) {
            gasPrice = r;
            return gasPrice * estimatedGas;
          })
          .then(function(r) {

            logger.debug('[TBFSWorker.estimateFeeData()] Estimated gasPrice', gasPrice);
            logger.debug('[TBFSWorker.estimateFeeData()] Estimated estimatedGas', estimatedGas);
            logger.debug('[TBFSWorker.estimateFeeData()] Estimated fee', r);

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

    forwardTokenBalanceByAddress: function(address, estimatedData) {
      new Promise(function(resolve) {
        var chain = Promise.resolve();
        var transaction = {
          nonce: 0,
          from: address.address,
          amount: 0,
          gasPrice: estimatedData.gasPrice,
          gasLimit: estimatedData.estimatedGas,
          token: {
            contractAddress: address.token.contractAddress,
            method: {
              name: 'transfer',
              params: {
                to: settings.daemonSettings.mainAddress,
                amount: new Decimal(address.token.balance.available).toFixed(0)
              }
            }
          }
        };

        logger.debug('[TBFSWorker.forwardTokenBalanceByAddress()] Sending transaction', JSON.stringify(transaction));

        return chain
          .then(function() {
            return daemonHelper.sendTransaction(transaction, address.privateKey)
              .then(function(e) {
                logger.info('[TBFSWorker.forwardTokenBalanceByAddress()] Token balance was forwarded successfully!',
                              address.address,
                              settings.daemonSettings.mainAddress, e);
                return e;
              })
              .catch(function(e) {
                logger.error('[TBFSWorker.forwardTokenBalanceByAddress()] An error has occurred while forwarding token balance it will be tried again',
                              address.address,
                              settings.daemonSettings.mainAddress, e);
              });
          })
          .then(function(r) {
            if (r) {
              var history = {
                to: settings.daemonSettings.mainAddress,
                amount: new Decimal(address.token.balance.available).toFixed(0),
                createdAt: dateHelper.getNow(),
                transactionHash: r.transactionHash
              };

              return addressBO.addTokenForwardHistory(address.id, new Decimal(address.token.balance.available).toFixed(0), history);
            }
          })
          .then(resolve)
          .catch(function(e) {
            console.log(e);
            logger.error('[TBFSWorker.forwardTokenBalanceByAddress()] An error has occurred while forwarding token', e);
          });
      });
    },

    forwardTokenBalance: function() {
      var self = this;

      return new Promise(function(resolve) {
        var chain = Promise.resolve();

        chain
          .then(function() {
            return self.estimateERC20TransferFeeData();
          })
          .then(function(r) {
            estimatedData = r;
            return addressBO.getAddressToForwardTokenBalance(estimatedData.estimatedFee, settings.daemonSettings.mainAddress);
          })
          .then(function(r) {
            if (r.length > 0) {
              var p = [];

              r.forEach(function(address) {
                p.push(self.forwardTokenBalanceByAddress(address, estimatedData));
              });

              return Promise.all(p);
            } else {
              return [];
            }
          })
          .then(resolve)
          .catch(function(r) {
            console.log(r);
            resolve(true);
          });
      });
    },

    forwardTokenBalances: function() {
      var self = this;

      return new Promise(function(resolve) {
        var chain = Promise.resolve();
        logger.info('[TBFSWorker] Starting Balance Forwarder Service');

        chain
          .then(function() {
            logger.info('[BFSWorker] Forwarding token balance to main address...');
            return self.forwardTokenBalance();
          })
          .then(function() {
            logger.info('[TBFSWorker] A new verification will occurr in 10s');
            resolve(true);
          })
          .catch(function(r) {
            console.log(r);
            logger.error('[TBFSWorker] An error has occurred while running the service', JSON.stringify(r));
            resolve(true);
          });
      });
    }
  };
};
