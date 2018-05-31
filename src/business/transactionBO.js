var Promise         = require('promise');
var logger          = require('../config/logger');
var Decimal         = require('decimal.js');

module.exports = function(dependencies) {
  var transactionDAO = dependencies.transactionDAO;
  var transactionRequestDAO = dependencies.transactionRequestDAO;
  var blockchainTransactionDAO = dependencies.blockchainTransactionDAO;
  var modelParser = dependencies.modelParser;
  var daemonHelper = dependencies.daemonHelper;
  var addressBO = dependencies.addressBO;
  var configurationBO = dependencies.configurationBO;
  var dateHelper = dependencies.dateHelper;
  var mutexHelper = dependencies.mutexHelper;

  return {
    dependencies: dependencies,

    clear: function() {
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();

        chain
          .then(function() {
            var p = [];
            p.push(transactionDAO.clear());
            p.push(transactionRequestDAO.clear());
            p.push(blockchainTransactionDAO.clear());
            logger.info('[TransactionBO] Clearing the database');
            return Promise.all(p);
          })
          .then(function() {
            logger.info('[TransactionBO] The database has been cleared');
          })
          .then(resolve)
          .catch(reject);
      });
    },

    getAll: function(filter) {
      return new Promise(function(resolve, reject) {
        if (!filter) {
          filter = {};
        }

        logger.info('[TransactionBO] Listing all transactions by filter ', JSON.stringify(filter));
        transactionDAO.getAll(filter)
          .then(function(r) {
            logger.info('[TransactionBO] Total of transactions', r.length);
            return r.map(function(item) {
              return modelParser.clear(item);
            });
          })
          .then(resolve)
          .catch(reject);
      });
    },

    getTransactionsToNotify: function() {
      var self = this;

      return new Promise(function(resolve, reject) {
        var filter = {
          '$or': [
            {
              'notifications.creation.isNotified': false
            },
            {
              isConfirmed: true,
              'notifications.confirmation.isNotified': false
            }
          ]

        };
        var chain = Promise.resolve();

        chain
          .then(function() {
            logger.info('[TransactionBO] Listing all transactions to be notified', JSON.stringify(filter));
            return self.getAll(filter);
          })
          .then(resolve)
          .catch(reject);
      });
    },

    getBlockchainTransactionByTransaction: function(filter) {
      var self = this;
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();

        chain
          .then(function() {
            return self.getAll(filter);
          })
          .then(function(r) {
            if (r.length === 1) {
              return blockchainTransactionDAO.getByTransactionHash(r[0].transactionHash);
            } else {
              return null;
            }
          })
          .then(function(r) {
            if (r) {
              return modelParser.clear(r);
            } else {
              return null;
            }
          })
          .then(resolve)
          .catch(reject);
      });
    },

    getByTransactionHash: function(transactionHash) {
      return new Promise(function(resolve, reject) {
        var filter = {
          transactionHash: transactionHash,
        };

        transactionDAO.getAll(filter)
          .then(function(transactions) {
            if (transactions.length) {
              logger.info('[TransactionBO] Transaction found by transactionHash', JSON.stringify(transactions[0]));
              return transactions[0];
            } else {
              logger.info('[TransactionBO] Transaction not found by transactionHash', transactionHash);
              return null;
            }
          })
          .then(resolve)
          .catch(reject);
      });
    },

    getTransactionRequestByTransactionHash: function(transactionHash) {
      return new Promise(function(resolve, reject) {
        var filter = {
          transactionHash: transactionHash
        };

        transactionRequestDAO.getAll(filter)
          .then(function(transactions) {
            if (transactions.length) {
              logger.info('[TransactionBO] Transaction request found by transactionHash',
                transactionHash,
                JSON.stringify(transactions[0]));
              return transactions[0];
            } else {
              logger.info('[TransactionBO] Transaction request not found by transactionHash',
                transactionHash);
              return null;
            }
          })
          .then(resolve)
          .catch(reject);
      });
    },

    save: function(entity) {
      return new Promise(function(resolve, reject) {
        var chain = mutexHelper.lock('transaction/' + entity.from);
        var unlock = null;
        var transactionRequest = entity;
        var estimatedGas = 0;
        var gasPrice = 0;
        var address = null;
        var ethTransaction = daemonHelper.generateTransaction(entity);
        var amountToCheck = 0;

        return chain
          .then(function(r) {
            unlock = r;
            return addressBO.getByAddress(null, entity.from);
          })
          .then(function(r) {
            address = r;
            logger.info('[TransactionBO.save()] Estimating the fee', JSON.stringify(ethTransaction));
            return daemonHelper.estimateGas(ethTransaction)
              .then(function(r) {
                estimatedGas = r;
                return daemonHelper.getGasPrice();
              })
              .then(function(r) {
                gasPrice = r;
                return gasPrice * estimatedGas;
              });
          })
          .then(function(r) {
            ethTransaction.gas = estimatedGas;
            logger.info('[TransactionBO.save()] Estimated fee', r);
            amountToCheck = new Decimal(r).plus(entity.amount).toNumber();
            return addressBO.checkHasFunds(entity.from, amountToCheck);
          })
          .then(function(r) {
            if (!r) {
              throw {
                status: 409,
                error: 'INVALID_WALLET_BALANCE',
                message: 'The wallet does not have funds to withdraw ' + entity.amount + ' (' + amountToCheck + ')'
              };
            }

            transactionRequest.status = 0;
            transactionRequest.gas = estimatedGas;
            transactionRequest.createdAt = dateHelper.getNow();

            logger.info('[TransactionBO] Saving the transaction request', JSON.stringify(transactionRequest));
            return transactionRequestDAO.save(transactionRequest);
          })
          .then(function(r) {
            transactionRequest._id = r._id;
            logger.info('[TransactionBO] Sending the transaction to the blockchain', JSON.stringify(transactionRequest), JSON.stringify(ethTransaction));
            return daemonHelper.sendTransaction(ethTransaction, address.privateKey);
          })
          .then(function(r) {
            logger.debug('[TransactionBO] Return of blockchain', JSON.stringify(r));

            transactionRequest.status = 1;
            transactionRequest.transactionHash = r.transactionHash;
            transactionRequest.updatedAt = dateHelper.getNow();

            logger.info('[TransactionBO] Updating the transaction request ', JSON.stringify(transactionRequest));

            return transactionRequestDAO.update(transactionRequest);
          })
          .then(function(){
            logger.info('[TransactionBO] Getting transaction information by transactionHash', transactionRequest.transactionHash);
            return daemonHelper.getTransaction(transactionRequest.transactionHash);
          })
          .then(function(r) {
            blockchainTransaction = r;
            logger.debug('[TransactionBO] Return of blockchain', JSON.stringify(r));

            transactionRequest.fee = r.gasPrice * r.gas;
            transactionRequest.updatedAt = dateHelper.getNow();

            logger.info('[TransactionBO] Updating the transaction request ', JSON.stringify(transactionRequest));
            return transactionRequestDAO.update(transactionRequest);
          })
          .then(function() {
            logger.info('[TransactionBO] Updating address balance', transactionRequest.from);
            return addressBO.updateBalance(address);
          })
          .then(function() {
            return addressBO.getByAddress(null, transactionRequest.to);
          })
          .then(function(addressTo) {
            if (addressTo) {
              return addressBO.updateBalance(addressTo);
            }
          })
          .then(function(){
            unlock();
            return modelParser.clear(transactionRequest);
          })
          .then(resolve)
          .catch(reject);
      });
    },

    getBlockchainTransactionByTransactionHash: function(hash) {
      return new Promise(function(resolve, reject) {
        var filter = {
          hash: hash
        };

        blockchainTransactionDAO.getAll(filter)
          .then(function(transactions) {
            if (transactions.length) {
              logger.info('[TransactionBO] Blockchain transaction found by hash', JSON.stringify(transactions[0]));
              return transactions[0];
            } else {
              logger.info('[TransactionBO] Blockchain transaction not found by hash', hash);
              return null;
            }
          })
          .then(resolve)
          .catch(reject);
      });
    },

    updateBlockchainTransaction: function(transaction, blockchainTransaction, currentBlockNumber) {
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();
        var rBlockchainTransaction = null;
        var minimumConfirmations = 0;
        var originIsConfirmed = false;

        chain
          .then(function() {
            return configurationBO.getByKey('minimumConfirmations');
          })
          .then(function(r) {
            minimumConfirmations = parseInt(r.value);

            transaction.blockhash = blockchainTransaction.blockhash;
            transaction.blockNumber = blockchainTransaction.blockNumber;
            transaction.updatedAt = dateHelper.getNow();
            originIsConfirmed = transaction.isConfirmed;
            transaction.isConfirmed = (currentBlockNumber - blockchainTransaction.blockNumber) >= minimumConfirmations;

            logger.info('[TransactionBO] Checking if the transactions is confirmed',
              currentBlockNumber,
              blockchainTransaction.blockNumber,
              (currentBlockNumber - blockchainTransaction.blockNumber) >= minimumConfirmations);

            return blockchainTransactionDAO.update(transaction);
          })
          .then(function(r) {
            rBlockchainTransaction = r;
            return transactionDAO.updateTransactionInfo(blockchainTransaction.hash,
              blockchainTransaction.blockhash,
              blockchainTransaction.blockNumber);
          })
          .then(function() {
            if (!originIsConfirmed && transaction.isConfirmed) {
              var p = [];
              logger.info('[TransactionBO] Updating confirmation flag and addresses balance', blockchainTransaction.hash);
              p.push(transactionDAO.updateIsConfirmedFlag(blockchainTransaction.hash));

              logger.info('[TransactionBO] Updating the balances in addresses involved at this transaction', blockchainTransaction.hash);
              p.push(self.updateBalancesFromBlockchainTransaction(rBlockchainTransaction));

            } else {
              logger.info('[TransactionBO] There is nothing to update (balance and isConfirmed flag)', blockchainTransaction.hash);
            }
          })
          .then(function() {
            return modelParser.clear(rBlockchainTransaction);
          })
          .then(resolve)
          .catch(reject);
      });
    },

    updateBalancesFromBlockchainTransaction: function(blockchainTransaction) {
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();
        var contractAddressesMap = {};

        chain
          .then(function() {
            logger.info('[TransactionBO] Getting contract addresses from database');
            return addressBO.getContractAddresses();
          })
          .then(function(r) {
            var p = [];
            r.forEach(function(contractAddress) {
              contractAddressesMap[contractAddress] = true;
            });

            logger.info('[TransactionBO] Contract addresses mapping ', JSON.stringify(contractAddressesMap));

            if (blockchainTransaction.isConfirmed) {
              logger.info('[TransactionBO] Current transaction is CONFIRMED', JSON.stringify(blockchainTransaction));

              if (contractAddressesMap[blockchainTransaction.to]) {
                logger.info('[TransactionBO] This transaction was sent to a mapped contract address', blockchainTransaction.to);
                logger.info('[TransactionBO] The input data will be parsed', blockchainTransaction.input);

                p.push(daemonHelper.parseTokenInputData(blockchainTransaction.input)
                  .then(function(r) {
                    logger.info('[TransactionBO] Input data parsing result', JSON.stringify(r));

                    if (r) {
                      switch (r.method) {
                        case 'mint':
                        case 'transfer':
                        case 'transferPreSigned':
                          logger.info('[TransactionBO] Trying to find this address at database ', r.params.to);
                          return addressBO.getByAddress(null, r.params.to);
                          break;
                        default:
                          return Promise.resolve(null);
                      }
                    } else {
                      return Promise.resolve(null);
                    }
                  })
                  .then(function(addressTo) {
                    if (addressTo) {
                      logger.info('[TransactionBO] Updating the balance from blockchain contract transaction', addressTo.to, blockchainTransaction.to);
                      return addressBO.updateBalance(addressTo);
                    } else {
                      logger.info('[TransactionBO] There is no address at the database for the specified contract transaction', blockchainTransaction.to);
                    }
                  })
                );
              } else {
                logger.info('[TransactionBO] Trying to find the addresses at database', blockchainTransaction.to);
                p.push(addressBO.getByAddress(null, blockchainTransaction.to)
                  .then(function(addressTo) {
                    if (addressTo) {
                      logger.info('[TransactionBO] Updating the balance from blockchain transaction', blockchainTransaction.to, blockchainTransaction.value);
                      return addressBO.updateBalance(addressTo);
                    } else {
                      logger.info('[TransactionBO] There is no address at the database for the specified transaction', blockchainTransaction.to);
                    }
                  }));
              }

              p.push(addressBO.getByAddress(null, blockchainTransaction.from)
                .then(function(addressFrom) {
                  if (addressFrom) {
                    logger.info('[TransactionBO] Updating the balance from blockchain transaction', blockchainTransaction.from, blockchainTransaction.value);
                    return addressBO.updateBalance(addressFrom);
                  } else {
                    logger.info('[TransactionBO] There is no address at the database for the specified transaction', blockchainTransaction.from);
                  }
                }));
            } else {
              logger.info('[TransactionBO] Current transaction is not confirmed', JSON.stringify(blockchainTransaction));
            }

            return Promise.all(p);
          })
          .then(resolve)
          .catch(reject);
      });
    },

    createBlockchainTransaction: function(blockchainTransaction, currentBlockNumber) {
      var self = this;

      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();
        var transactionRequest = null;
        var addressInfo = null;
        var rBlockchainTransaction = null;
        var minimumConfirmations = 0;

        chain
          .then(function() {
            return configurationBO.getByKey('minimumConfirmations');
          })
          .then(function(r) {
            minimumConfirmations = parseInt(r.value);
            logger.info('[TransactionBO] Trying to find the transaction request linked to this hash',
              blockchainTransaction.hash);
            return self.getTransactionRequestByTransactionHash(blockchainTransaction.hash);
          })
          .then(function(r) {
            transactionRequest = r;

            if (!r) {
              logger.info('[TransactionBO] There is no transaction request linked to this transactionHash',
                blockchainTransaction.hash);
            } else {
              logger.info('[TransactionBO] Transaction request linked to this transactionHash was found',
                blockchainTransaction.hash);
            }

            console.log('AAAAa', blockchainTransaction);
            var o = {
              blockHash: blockchainTransaction.blockHash,
              blockNumber: blockchainTransaction.blockNumber,
              from: blockchainTransaction.from,
              to: blockchainTransaction.to,
              value: new Decimal(blockchainTransaction.value).toNumber(),
              gas: blockchainTransaction.gas,
              gasPrice: blockchainTransaction.gasPrice,
              hash: blockchainTransaction.hash,
              input: blockchainTransaction.input,
              nonce: blockchainTransaction.nonce ? new Decimal(blockchainTransaction.nonce).toNumber() : blockchainTransaction.nonce,
              transactionIndex: blockchainTransaction.transactionIndex,
              isConfirmed: (currentBlockNumber - blockchainTransaction.blockNumber) >= minimumConfirmations,
              createdAt: dateHelper.getNow(),
            };

            logger.info('[TransactionBO] Saving the blockchain transaction', JSON.stringify(o));
            return blockchainTransactionDAO.save(o);
          })
          .then(function(r) {
            rBlockchainTransaction = r;
            return self.updateBalancesFromBlockchainTransaction(r);
          })
          .then(function() {
            var newTransaction = {
              ownerId: addressInfo ? addressInfo.ownerId : null,
              ownerTransactionId: transactionRequest ? transactionRequest.ownerTransactionId : null,
              amount: new Decimal(blockchainTransaction.value).toNumber(),
              gas: blockchainTransaction.gas,
              gasPrice: blockchainTransaction.gasPrice,
              isConfirmed: rBlockchainTransaction.isConfirmed,
              notifications: {
                creation: {
                  isNotified: false
                },
                confirmation: {
                  isNotified: false
                }
              },
              transactionHash: blockchainTransaction.hash,
              to: blockchainTransaction.to,
              from: blockchainTransaction.from,
              input: blockchainTransaction.input,
              createdAt: dateHelper.getNow()
            };
            logger.info('[TransactionBO] Saving the transaction', JSON.stringify(newTransaction));
            return transactionDAO.save(newTransaction);
          })
          .then(function() {
            return modelParser.clear(rBlockchainTransaction);
          })
          .then(resolve)
          .catch(reject);
      });
    },

    parseTransaction: function(transaction, currentBlockNumber) {
      var self = this;

      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();

        chain
          .then(function() {
            logger.info('[TransactionBO] Trying to get the blockchain transaction from database ', transaction.hash);
            return self.getBlockchainTransactionByTransactionHash(transaction.hash);
          })
          .then(function(r) {
            if (r && !r.isConfirmed) {
              logger.info('[TransactionBO] The transaction was found',
                JSON.stringify(r));

              return self.updateBlockchainTransaction(r, transaction, currentBlockNumber);
            } else if (!r) {
              logger.info('[TransactionBO] The transaction was not found at database', transaction.hash);

              return self.createBlockchainTransaction(transaction, currentBlockNumber);
            }
          })
          .then(function(r){
            return modelParser.clear(r);
          })
          .then(resolve)
          .catch(reject);
      });
    },

    updateIsCreationNotifiedFlag: function(transactionId) {
      return transactionDAO.updateIsCreationNotifiedFlag(transactionId);
    },

    updateIsConfirmationNotifiedFlag: function(transactionId) {
      return transactionDAO.updateIsConfirmationNotifiedFlag(transactionId);
    }
  };
};
