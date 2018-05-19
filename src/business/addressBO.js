var logger          = require('../config/logger');

module.exports = function(dependencies) {
  var addressDAO = dependencies.addressDAO;
  var modelParser = dependencies.modelParser;
  var daemonHelper = dependencies.daemonHelper;
  var dateHelper = dependencies.dateHelper;
  var mutexHelper = dependencies.mutexHelper;

  return {
    dependencies: dependencies,

    clear: function() {
      return new Promise(function(resolve, reject) {
        var chain = Promise.resolve();

        chain
          .then(function() {
            logger.info('[AddressBO] Clearing the database');
            return addressDAO.clear();
          })
          .then(function() {
            logger.info('[AddressBO] The database has been cleared');
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

        filter.isEnabled = true;

        logger.info('[AddressBO] Listing all addresses by filter ', JSON.stringify(filter));
        addressDAO.getAll(filter, {}, '+createdAt')
          .then(function(r) {
            logger.info('[AddressBO] Total of addresses', r.length);
            return r.map(function(item) {
              return modelParser.clear(item);
            });
          })
          .then(resolve)
          .catch(reject);
      });
    },

    getFreeAddresses: function() {
      logger.info('[AddressBO] Getting free addresses from database');
      return this.getAll({
        isEnabled: true,
        ownerId: null
      }, {}, '+createdAt');
    },

    createAddressFromDaemon: function(ownerId) {
      var self = this;
      var chain = Promise.resolve();

      return new Promise(function(resolve, reject) {
        chain
          .then(function() {
            logger.info('[AddressBO] Requesting to the daemon a new address');
            return daemonHelper.createAddress();
          })
          .then(function(r) {
            logger.info('[AddressBO] Saving the address and linking to ownerId', ownerId);
            return self.registerAddressFromDaemon(ownerId, r);
          })
          .then(resolve)
          .catch(reject);
      });
    },

    registerAddressFromDaemon: function(ownerId, address) {
      var chain = Promise.resolve();

      return new Promise(function(resolve, reject) {
        chain
          .then(function() {
            return daemonHelper.getBalance(address.address);
          })
          .then(function(r) {
            var addressEntity = {
              ownerId: ownerId,
              address: address.address,
              privateKey: address.privateKey,
              createdAt: dateHelper.getNow(),
              isEnabled: true,
              balance: {
                available: r,
                locked: 0
              }
            };

            logger.info('[AddressBO] Saving the address to the database', JSON.stringify(addressEntity));
            return addressDAO.save(addressEntity);
          })
          .then(function(r) {
            logger.info('[AddressBO] The address was stored at database successfully', JSON.stringify(r));
            return modelParser.clear(r);
          })
          .then(resolve)
          .catch(reject);
      });
    },

    createAddress: function(ownerId) {
      var self = this;
      var chain = Promise.resolve();
      var freeAddress = null;

      return new Promise(function(resolve, reject) {
        return chain
          .then(function() {
            logger.info('[AddressBO] Trying to get a free address from database');
            return self.getFreeAddresses();
          })
          .then(function(r) {
            var address = r.length > 0 ? r[0] : null;
            if (!address) {
              logger.info('[AddressBO] There is no free address at database');
              return self.createAddressFromDaemon(ownerId);
            } else {
              logger.info('[AddressBO] A free address was found at database', JSON.stringify(address));
              return address;
            }
          })
          .then(function(r) {
            freeAddress = modelParser.prepare(r);
            freeAddress.isEnabled = true;
            freeAddress.ownerId = ownerId;
            freeAddress.updatedAt = dateHelper.getNow();

            logger.info('[AddressBO] Updating the free address to be owned by the ownerId ',
              JSON.stringify(freeAddress));
            return addressDAO.update(freeAddress);
          })
          .then(function(r) {
            logger.info('[AddressBO] The address now is associated to the ownerId ', JSON.stringify(r));
            return modelParser.clear(r);
          })
          .then(resolve)
          .catch(reject);
      });
    },

    getByAddress: function(ownerId, address) {
      var self = this;

      return new Promise(function(resolve, reject) {
        var filter = {
          address: address
        };

        if (ownerId) {
          filter.ownerId = ownerId;
        }

        logger.info('[AddressBO] Getting an address by ownerId/address', ownerId, address);

        self.getAll(filter)
          .then(function(addresses) {
            if (addresses.length) {
              logger.info('[AddressBO] Address found by ownerId/address', JSON.stringify(addresses[0]));
              return addresses[0];
            } else {
              logger.warn('[AddressBO] There is no address to provided informations', ownerId, address);
              return null;
            }
          })
          .then(resolve)
          .catch(reject);
      });
    },

    delete: function(ownerId, address) {
      var self = this;

      return new Promise(function(resolve, reject) {
        logger.info('[AddressBO] Disabling an address', ownerId, address);

        self.getByAddress(ownerId, address)
          .then(function(addresses) {
            if (!addresses) {
              logger.warn('[AddressBO] A error will be thrown. There is no address to the provided informations',
                ownerId, address);
              throw {
                status: 404,
                message: 'The address ' + address + ' not found'
              };
            } else {
              return addressDAO.disable(addresses.id);
            }
          })
          .then(resolve)
          .catch(reject);
      });
    },

    checkHasFunds: function(address, amount) {
      var self = this;

      return new Promise(function(resolve, reject) {
        var chain = mutexHelper.lock(address);
        var unlock = null;

        return chain
          .then(function(r) {
            unlock = r;
            return self.getByAddress(null, address);
          })
          .then(function(r) {
            logger.info('[AddressBO.checkHasFunds()] Checking if the wallet has funds', JSON.stringify(r));
            if (r.balance.available >= amount) {
              logger.info('[AddressBO.checkHasFunds()] The wallet has funds', JSON.stringify(r));
              return true;
            } else {
              logger.info('[AddressBO.checkHasFunds()] The wallet do not have funds', JSON.stringify(r));
              return false;
            }
          })
          .then(function(r) {
            unlock();
            return r;
          })
          .then(resolve)
          .catch(reject);
      });
    },

    updateBalance: function(address) {
      var chain = Promise.resolve();

      return chain
        .then(function() {
          return daemonHelper.getBalance(address.address, address.privateKey);
        })
        .then(function(r) {
          var o = modelParser.prepare(address);
          o.balance.available = r;
          return addressDAO.update(o);
        })
        .then(function(r) {
          return modelParser.clear(r);
        });
    },
  };
};
