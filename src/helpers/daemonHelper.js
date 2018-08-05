var Decimal         = require('decimal.js');
var Tx              = require('ethereumjs-tx');
var logger          = require('../config/logger');

module.exports = function(dependencies) {
  var web3 = dependencies.web3;
  var abiDecoder = dependencies.abiDecoder;
  var erc20Interface = dependencies.erc20Interface;
  var erc865Interface = dependencies.erc865Interface;
  var fullTokenInterface = dependencies.fullTokenInterface;
  var mintableTokenInterface = dependencies.mintableTokenInterface;

  abiDecoder.addABI(erc20Interface.abi);
  abiDecoder.addABI(erc865Interface.abi);
  abiDecoder.addABI(mintableTokenInterface.abi);
  abiDecoder.addABI(fullTokenInterface.abi);

  return {
    setDependencies: function(dependencies) {
      if (dependencies.web3) {
        web3 = dependencies.web3;
      }
      if (dependencies.abiDecoder) {
        abiDecoder = dependencies.abiDecoder;
      }
      if (dependencies.erc20Interface) {
        erc20Interface = dependencies.erc20Interface;
      }
      if (dependencies.mintableTokenInterface) {
        mintableTokenInterface = dependencies.mintableTokenInterface;
      }
    },

    createAddress: function() {
      return new Promise(function(resolve) {
        var newAddress = web3.eth.accounts.create();
        resolve(newAddress);
      });
    },

    getBalance: function(address) {
      return web3.eth.getBalance(address);
    },

    getTokenBalance: function(address, contractAddress) {
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();

        chain
          .then(function() {
            try {
              var token = new web3.eth.Contract(erc20Interface.abi, contractAddress);
              return token.methods.balanceOf(address).call();
            } catch (e) {
              throw e;
            }
          })
          .then(resolve)
          .catch(reject);
      });
    },

    estimateGas: function(transaction) {
      var tmpTransaction = Object.assign({}, transaction);
      tmpTransaction.value = transaction.amount;
      delete tmpTransaction.amount;

      if (transaction.gasLimit !== undefined) {
        tmpTransaction.gas = transaction.gasLimit;
        delete tmpTransaction.gasLimit;
      }

      return web3.eth.estimateGas(tmpTransaction);
    },

    getGasPrice: function() {
      return web3.eth.getGasPrice();
    },

    getBlockNumber: function() {
      return web3.eth.getBlockNumber();
    },

    getTransactionReceipt: function(hash) {
      return web3.eth.getTransactionReceipt(hash);
    },

    getTransactions: function(from, to) {
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();
        var transactions = [];

        return chain
          .then(function() {
            var p = [];

            for (var i = from; i <= to; i++) {
              p.push(web3.eth.getBlock(i, true));
            }

            return Promise.all(p);
          })
          .then(function(r) {
            r.forEach(function(block) {
              if (block && block.transactions) {
                transactions = transactions.concat(block.transactions);
              }
            });
            return transactions;
          })
          .then(resolve)
          .catch(reject);
      });
    },

    getTransaction: function(hash) {
      return web3.eth.getTransaction(hash);
    },

    getTransactionCount: function(address) {
      return web3.eth.getTransactionCount(address);
    },

    sendTransaction: function(transaction, privateKey) {
      if (transaction.token) {
        switch (transaction.token.method.name) {
          case 'mint':
            return this.sendMintTransaction(transaction, privateKey);
          case 'transferPreSigned':
            return this.sendTransferPreSignedTransaction(transaction, privateKey);
          case 'burnPreSigned':
            return this.sendBurnPreSignedTransaction(transaction, privateKey);
          case 'transfer':
            return this.sendTransferTransaction(transaction, privateKey);
          default:

        }
      } else {
        return this.sendETHTransaction(transaction, privateKey);
      }
    },

    sendETHTransaction: function(transaction, privateKey) {
      var self = this;
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();

        return chain
          .then(function() {
            return web3.eth.getTransactionCount(transaction.from);
          })
          .then(function(count) {
            var tx = new Tx(self.generateETHTransaction(transaction, count));
            var privKey = new Buffer(privateKey.startsWith('0x') ?
                                        privateKey.substring(2) :
                                        privateKey, 'hex');
            tx.sign(privKey);
            var serializedTx = tx.serialize();
            return new Promise(function(resolve, reject) {
              var transaction = web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));

              transaction.on('transactionHash', function(hash) {
                resolve({transactionHash: hash});
              });

              transaction.on('error', reject);
            });
          })
          .then(resolve)
          .catch(reject);
      });
    },

    sendTransferPreSignedTransaction: function(transaction, privateKey) {
      var self = this;
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();

        chain
          .then(function() {
            return web3.eth.getTransactionCount(transaction.from);
          })
          .then(function(count) {
            var tx = new Tx(self.generateTransferPreSignedTransaction(transaction, count));
            var privKey = new Buffer(privateKey.startsWith('0x') ?
                                        privateKey.substring(2) :
                                        privateKey, 'hex');
            tx.sign(privKey);
            var serializedTx = tx.serialize();

            return new Promise(function(resolve, reject) {
              var transaction = web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));

              transaction.on('transactionHash', function(hash) {
                resolve({transactionHash: hash});
              });

              transaction.on('error', reject);
            });
          })
          .then(resolve)
          .catch(reject);
      });
    },

    sendBurnPreSignedTransaction: function(transaction, privateKey) {
      var self = this;
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();

        chain
          .then(function() {
            return web3.eth.getTransactionCount(transaction.from);
          })
          .then(function(count) {
            var tx = new Tx(self.generateBurnPreSignedTransaction(transaction, count));
            var privKey = new Buffer(privateKey.startsWith('0x') ?
                                        privateKey.substring(2) :
                                        privateKey, 'hex');
            tx.sign(privKey);
            var serializedTx = tx.serialize();

            return new Promise(function(resolve, reject) {
              var transaction = web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));

              transaction.on('transactionHash', function(hash) {
                resolve({transactionHash: hash});
              });

              transaction.on('error', reject);
            });
          })
          .then(resolve)
          .catch(reject);
      });
    },

    sendMintTransaction: function(transaction, privateKey) {
      var self = this;
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();

        chain
          .then(function() {
            return web3.eth.getTransactionCount(transaction.from);
          })
          .then(function(count) {
            var tx = new Tx(self.generateMintTransaction(transaction, count));
            var privKey = new Buffer(privateKey.startsWith('0x') ?
                                        privateKey.substring(2) :
                                        privateKey, 'hex');
            tx.sign(privKey);
            var serializedTx = tx.serialize();

            return new Promise(function(resolve, reject) {
              var transaction = web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));

              transaction.on('transactionHash', function(hash) {
                resolve({transactionHash: hash});
              });

              transaction.on('error', reject);
            });
          })
          .then(resolve)
          .catch(reject);
      });
    },

    sendTransferTransaction: function(transaction, privateKey) {
      var self = this;

      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();

        chain
          .then(function() {
            return web3.eth.getTransactionCount(transaction.from);
          })
          .then(function(count) {
            var tx = new Tx(self.generateTransferTransaction(transaction, count));
            var privKey = new Buffer(privateKey.startsWith('0x') ?
                                        privateKey.substring(2) :
                                        privateKey, 'hex');
            tx.sign(privKey);
            var serializedTx = tx.serialize();

            return new Promise(function(resolve, reject) {
              var transaction = web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));

              transaction.on('transactionHash', function(hash) {
                resolve({transactionHash: hash});
              });

              transaction.on('error', reject);
            });
          })
          .then(resolve)
          .catch(reject);
      });
    },

    generateTransaction: function(transaction) {
      logger.debug('[DeamonHelper.generateTransaction()] Generating transaction for ', JSON.stringify(transaction));

      if (transaction.token) {
        logger.debug('[DeamonHelper.generateTransaction()] Is is a token transaction. Evaluating the method name ',  transaction.token.method.name, JSON.stringify(transaction));

        switch (transaction.token.method.name) {
          case 'mint':
            return this.generateMintTransaction(transaction);
          case 'transfer':
            return this.generateTransferTransaction(transaction);
          case 'transferPreSigned':
            return this.generateTransferPreSignedTransaction(transaction);
          case 'burnPreSigned':
            return this.generateBurnPreSignedTransaction(transaction);
          default:

        }
      } else {
        return this.generateETHTransaction(transaction);
      }
    },

    generateETHTransaction: function(transaction, count) {
      var r = {
          from: transaction.from,
          nonce: web3.utils.toHex(count),
          to: transaction.to,
          value: web3.utils.toBN(transaction.amount),
          gasLimit: web3.utils.toHex(transaction.gasLimit),
          gasPrice: web3.utils.toHex(transaction.gasPrice)
      };

      logger.debug('[DeamonHelper.generateTransaction()] Generated ETH transaction', JSON.stringify(r));
      return r;
    },

    generateMintTransaction: function(transaction, count) {
      var token = new web3.eth.Contract(mintableTokenInterface.abi, transaction.token.contractAddress);
      return {
            from: transaction.from,
            nonce: web3.utils.toHex(count),
            gasLimit: web3.utils.toHex(transaction.gasLimit),
            gasPrice: web3.utils.toHex(transaction.gasPrice),
            to: transaction.token.contractAddress,
            value: '0x0',
            data: token.methods.mint(transaction.token.method.params.to, web3.utils.toBN(transaction.token.method.params.amount)).encodeABI(),
        };
    },

    generateTransferTransaction: function(transaction, count) {
      var token = new web3.eth.Contract(erc20Interface.abi, transaction.token.contractAddress);
      var r = {
            from: transaction.from,
            nonce: web3.utils.toHex(count),
            gasLimit: web3.utils.toHex(transaction.gasLimit),
            gasPrice: web3.utils.toHex(transaction.gasPrice),
            to: transaction.token.contractAddress,
            value: '0x0',
            data: token.methods.transfer(transaction.token.method.params.to, web3.utils.toBN(transaction.token.method.params.amount)).encodeABI(),
        };

      logger.debug('[DeamonHelper.generateTransaction()] Generated transfer transaction', JSON.stringify(r));
      return r;
    },

    generateTransferPreSignedTransaction: function(transaction, count) {
      var token = new web3.eth.Contract(erc865Interface.abi, transaction.token.contractAddress);
      return {
            from: transaction.from,
            nonce: web3.utils.toHex(count),
            gasLimit: web3.utils.toHex(transaction.gasLimit),
            gasPrice: web3.utils.toHex(transaction.gasPrice),
            to: transaction.token.contractAddress,
            value: '0x0',
            data: token.methods.transferPreSigned(transaction.token.method.params.signature,
                                                  transaction.token.method.params.to,
                                                  web3.utils.toBN(transaction.token.method.params.amount),
                                                  web3.utils.toBN(transaction.token.method.params.fee),
                                                  web3.utils.toBN(transaction.token.method.params.nonce)).encodeABI(),
        };
    },

    generateBurnPreSignedTransaction: function(transaction, count) {
      var token = new web3.eth.Contract(erc865Interface.abi, transaction.token.contractAddress);
      return {
            from: transaction.from,
            nonce: web3.utils.toHex(count),
            gasLimit: web3.utils.toHex(transaction.gasLimit),
            gasPrice: web3.utils.toHex(transaction.gasPrice),
            to: transaction.token.contractAddress,
            value: '0x0',
            data: token.methods.burnPreSigned(transaction.token.method.params.signature,
                                                  web3.utils.toBN(transaction.token.method.params.amount),
                                                  web3.utils.toBN(transaction.token.method.params.fee),
                                                  web3.utils.toBN(transaction.token.method.params.nonce)).encodeABI(),
        };
    },

    parseTokenTransferPreSignedMethod: function(decoded) {
      var r = {
        method: 'transferPreSigned',
        params: {
          signature: '',
          to: '',
          amount: 0,
          fee: 0,
          nonce: 0
        }
      };

      decoded.params.forEach(function(item) {
        switch (item.name) {
          case '_signature':
            r.params.signature = item.value;
            break;
          case '_fee':
            r.params.fee = new Decimal(item.value).toNumber();
            break;
          case '_nonce':
            r.params.nonce = new Decimal(item.value).toNumber();
            break;
          case '_to':
            r.params.to = item.value;
            break;
          case '_value':
            r.params.amount = new Decimal(item.value).toNumber();
            break;
        }
      });

      return r;
    },

    parseTokenBurnPreSignedMethod: function(decoded) {
      var r = {
        method: 'burnPreSigned',
        params: {
          signature: '',
          amount: 0,
          fee: 0,
          nonce: 0
        }
      };

      decoded.params.forEach(function(item) {
        switch (item.name) {
          case '_signature':
            r.params.signature = item.value;
            break;
          case '_fee':
            r.params.fee = new Decimal(item.value).toNumber();
            break;
          case '_nonce':
            r.params.nonce = new Decimal(item.value).toNumber();
            break;
          case '_value':
            r.params.amount = new Decimal(item.value).toNumber();
            break;
        }
      });

      return r;
    },

    createTransferSignature: function(contractAddress, from, to, amount, fee, nonce) {
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();

        logger.debug('[DeamonHelper.createTransferSignature()] Instantiating the contract by address ', contractAddress);
        var token = new web3.eth.Contract(fullTokenInterface.abi, contractAddress);

        var hash = null;
        var signature = null;

        return chain
          .then(function() {
            logger.debug('[DeamonHelper.createTransferSignature()] Signing the transfer ',
                          contractAddress,
                          to,
                          amount,
                          fee,
                          nonce);

            return token.methods.transferPreSignedHashing(
              contractAddress,
              to,
              amount,
              fee,
              nonce).call();
          })
          .then(function(r) {
            hash = r;
            logger.debug('[DeamonHelper.createTransferSignature()] Hash', hash);

            return web3.eth.accounts.sign(hash, from.privateKey);
          })
          .then(function(r) {
            signature = r.signature;
            logger.debug('[DeamonHelper.createTransferSignature()] Signature', signature);

            return {
              contractAddress: contractAddress,
              to: to,
              amount: amount,
              fee: fee,
              nonce: nonce,
              signature: signature
            };
          })
          .then(resolve)
          .catch(reject);
      });
    },

    createBurnSignature: function(contractAddress, from, amount, fee, nonce) {
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();

        logger.debug('[DeamonHelper.createBurnSignature()] Instantiating the contract by address ', contractAddress);
        var token = new web3.eth.Contract(fullTokenInterface.abi, contractAddress);

        var hash = null;
        var signature = null;

        return chain
          .then(function() {
            logger.debug('[DeamonHelper.createBurnSignature()] Signing the transfer ',
                          contractAddress,
                          amount,
                          fee,
                          nonce);

            return token.methods.burnPreSignedHashing(
              contractAddress,
              amount,
              fee,
              nonce).call();
          })
          .then(function(r) {
            hash = r;
            logger.debug('[DeamonHelper.createBurnSignature()] Hash', hash);

            return web3.eth.accounts.sign(hash, from.privateKey);
          })
          .then(function(r) {
            signature = r.signature;
            logger.debug('[DeamonHelper.createBurnSignature()] Signature', signature);

            return {
              contractAddress: contractAddress,
              amount: amount,
              fee: fee,
              nonce: nonce,
              signature: signature
            };
          })
          .then(resolve)
          .catch(reject);
      });
    },

    parseTokenTransferMethod: function(decoded) {
      var r = {
        method: 'transfer',
        params: {
          to: '',
          amount: 0
        }
      };

      decoded.params.forEach(function(item) {
        switch (item.name) {
          case '_to':
            r.params.to = item.value;
            break;
          case '_value':
            r.params.amount = new Decimal(item.value).toNumber();
            break;
        }
      });

      return r;
    },

    parseTokenMintMethod: function(decoded) {
      var r = {
        method: 'mint',
        params: {
          to: '',
          amount: 0
        }
      };

      decoded.params.forEach(function(item) {
        switch (item.name) {
          case '_to':
            r.params.to = item.value;
            break;
          case '_amount':
            r.params.amount = new Decimal(item.value).toNumber();
            break;

        }
      });

      return r;
    },

    parseTokenInputData: function(input) {
      var self = this;

      return new Promise(function(resolve, reject) {
        try {
          var decoded = abiDecoder.decodeMethod(input);
          if (decoded) {
            switch (decoded.name) {
              case 'mint':
                resolve(self.parseTokenMintMethod(decoded));
                break;
              case 'transfer':
                resolve(self.parseTokenTransferMethod(decoded));
                break;
              case 'transferPreSigned':
                resolve(self.parseTokenTransferPreSignedMethod(decoded));
                break;
              case 'burnPreSigned':
                resolve(self.parseTokenBurnPreSignedMethod(decoded));
                break;
              default:
                resolve(null);
            }
          } else {
            resolve(null);
          }
        } catch (e) {
          reject(null);
        }
      });
    }
  };
};
