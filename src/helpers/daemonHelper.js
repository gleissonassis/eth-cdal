module.exports = function(dependencies) {
  var client = dependencies.client;

  return {
    getAddresses: function() {
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();
        return chain
          .then(function() {
            return client.listReceivedByAddress(0, true);
          })
          .then(function(r) {
            var addresses = [];

            r.forEach(function(item) {
              addresses.push(item.address);
            });
            addresses.sort();
            return addresses;
          })
          .then(resolve)
          .catch(reject);
      });
    },

    createAddress: function() {
      return client.getNewAddress();
    },

    getBalance: function() {
      return client.getBalance();
    },

    estimateGas: function(transaction) {
      return 0;
    },

    getGasPrice: function() {
      return 0;
    },

    getBlockNumber: function() {
      return client.getBlockCount();
    },

    getBlockHash: function(blocknumber) {
      return client.getBlockHash(blocknumber);
    },

    listSinceBlock: function(blockash) {
      return client.listSinceBlock(blockash);
    },

    estimateSmartFee: function(blocks) {
      return new Promise(function(resolve, reject) {
        return client.estimateSmartFee(blocks || 6)
          .then(function(r) {
            if (!isNaN(r)) {
              return r;
            } else {
              return 0;
            }
          })
          .then(resolve)
          .catch(reject);
      });
    },

    getTransactions: function(from, to) {
      return null;
    },

    getTransaction: function(txid) {
      return client.getTransaction(txid);
    },

    sendTransaction: function(address, amount, comment, toComment) {
      return client.sendToAddress(address, amount, comment, toComment);
    },

    _throwDaemonError: function(r) {
      switch (r.error.code) {
        case -32601:
          throw {
            status: 500,
            message: r.error.message,
            details: r
          };
        case -32600:
          throw {
            status: 409,
            code: 'INVALID_REQUEST',
            message: r.error.message,
            details: r
          };
        case -32000:
          switch (r.error.data.application_code) {
            case 4:
              throw {
                status: 404,
                message: 'Requested object not found',
                error: 'OBJECT_NOT_FOUND',
                details: r
              };
            case 7:
              throw {
                status: 409,
                message: 'Bad address',
                error: 'ERROR_TRANSACTION_BAD_ADDRESS',
                details: r
              };
            case 9:
              throw {
                status: 409,
                message: 'Wrong amount',
                error: 'ERROR_TRANSACTION_WRONG_AMOUNT',
                details: r
              };
            case 17:
              throw {
                status: 409,
                message: 'Transaction fee is too small',
                error: 'ERROR_TRANSACTION_SMALL_FEE',
                details: r
              };
            default:
              throw {
                status: 409,
                message: 'An error has occurred while processing this transaction. ' + r.error.message,
                details: r
              };
          }
        default:
          throw {
            status: 500,
            message: 'An expected error has occurred while processing',
            details: r
          };
      }
    }
  };
};
