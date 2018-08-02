var Promise         = require('promise');
var logger          = require('../config/logger');
var settings        = require('../config/settings');

module.exports = function(dependencies) {
  var addressBO = dependencies.addressBO;
  var daemonHelper = dependencies.daemonHelper;
  var dateHelper = dependencies.dateHelper;

  return {
    dependencies: dependencies,
    isRunning: false,

    run: function() {
      var self = this;

      logger.info('[EFSWorker] Starting the service');

      if (!this.isRunning) {
        self.isRunning = true;

        return this.sendEtherBalances()
          .then(function() {
              self.isRunning = false;

              logger.info('[EFSWorker] A new verification will occurr in 10s');
              setTimeout(function() {
                self.run();
              }, 10 * 1000);
          });
      } else {
        logger.info('[EFSWorker] The process still running... this execution will be skiped');
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

            logger.debug('[EFSWorker.estimateFeeData()] Estimated gasPrice', gasPrice);
            logger.debug('[EFSWorker.estimateFeeData()] Estimated estimatedGas', estimatedGas);
            logger.debug('[EFSWorker.estimateFeeData()] Estimated fee', r);

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

    fillEther: function() {
      var self = this;

      return new Promise(function(resolve) {
        var chain = Promise.resolve();
        var transaction = {
          nonce: 0,
          amount: 0,
          gasPrice: 0
        };
        var mainAddress = null;

        chain
          .then(function() {
            return self.estimateERC20TransferFeeData();
          })
          .then(function(r) {
            estimatedData = r;
            return addressBO.getByAddress(null, settings.daemonSettings.mainAddress);
          })
          .then(function(r) {
            mainAddress = r;
            return addressBO.getAddressToFill(estimatedData.estimatedFee, settings.daemonSettings.mainAddress);
          })
          .then(function(r) {
            if (r.length > 0) {
              var address = r[0];
              return addressBO.setIsWaitingEtherStatus(address.id, true)
                .then(function() {
                  transaction.from = mainAddress.address;
                  transaction.amount = estimatedData.estimatedFee;
                  transaction.to = address.address;
                  transaction.gasPrice = estimatedData.gasPrice;
                  transaction.gasLimit = estimatedData.estimatedGas;

                  logger.debug('[EFSWorker] Sending transaction', JSON.stringify(transaction));

                  return daemonHelper.sendTransaction(transaction, mainAddress.privateKey)
                    .then(function(e) {
                      logger.info('[EFSWorker] Ether fill was made successfully!', mainAddress.address, address.address, e);
                      return e;
                    })
                    .catch(function(e) {
                      logger.error('[EFSWorker] An error has occurred while filling ether it will be tried again', mainAddress.address, address.address, e);
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

                    return addressBO.addFillingHistory(mainAddress.id, estimatedData.estimatedFee, history);
                  } else {
                    return addressBO.setIsWaitingEtherStatus(address.id, false);
                  }
                })
                .then(function() {
                  return self.fillEther();
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

    sendEtherBalances: function() {
      var self = this;

      return new Promise(function(resolve) {
        var chain = Promise.resolve();
        logger.info('[EFSWorker] Starting Balance Forwarder Service');

        chain
          .then(function(r) {
            logger.info('[BFSWorker] Forwarding balance to fill with ether...');
            return self.fillEther(r);
          })
          .then(function() {
            logger.info('[EFSWorker] A new verification will occurr in 10s');
            resolve(true);
          })
          .catch(function(r) {
            console.log(r);
            logger.error('[EFSWorker] An error has occurred while running the service', JSON.stringify(r));
            resolve(true);
          });
      });
    }
  };
};
