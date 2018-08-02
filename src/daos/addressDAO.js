var logger              = require('winston');
var model               = require('../models/address')();
var Promise             = require('promise');
var $                   = require('mongo-dot-notation');

module.exports = function() {
  var projectionCommonFields = {
    __v: false
  };

  return {
    clear: function() {
      return new Promise(function(resolve, reject) {
        model.remove({}, function(err) {
          if (err) {
            logger.error('[AddressDAO] An error has occurred while deleting all items', error);
            reject(err);
          } else {
            logger.info('[AddressDAO] The items have been deleted succesfully');
            resolve();
          }
        });
      });
    },

    getAll: function(filter, pagination, sort) {
      return new Promise(function(resolve, reject) {
        logger.info('[AddressDAO] Getting items from database', filter);

        model.find(filter, projectionCommonFields, pagination)
          .sort(sort)
          .lean()
          .exec()
          .then(function(items) {
            logger.info('[AddressDAO] %d items were returned', items.length);
            resolve(items);
          }).catch(function(erro) {
            logger.error('[AddressDAO] An error has ocurred while getting items from database', erro);
            reject(erro);
          });
      });
    },

    getFreeAddress: function() {
      return new Promise(function(resolve, reject) {
        var filter = {
          isEnabled: true,
          ownerId: null
        };

        logger.info('Getting a free address from database', filter);

        model.findOne(filter, projectionCommonFields)
          .lean()
          .exec()
          .then(resolve)
          .catch(function(erro) {
            logger.log('error', 'An error has ocurred while getting free address from database', erro);
            reject(erro);
          });
      });
    },

    getContractAddresses: function() {
      return new Promise(function(resolve, reject) {
        logger.info('[AddressDAO] Getting contract addresses');

        model.distinct('token.contractAddress')
          .then(function(items) {
            logger.info('[AddressDAO] %d items were returned', items.length);
            resolve(items);
          }).catch(function(erro) {
            logger.error('[AddressDAO] An error has ocurred while getting contract addresses from database', erro);
            reject(erro);
          });
      });
    },

    getById: function(id) {
      var self = this;
      return new Promise(function(resolve, reject) {
        logger.log('info', 'Getting a address by id %s', id);

        self.getAll({_id: id, isEnabled: true})
        .then(function(users) {
          if (users.length === 0) {
            resolve(null);
            logger.log('info', 'The address not found');
          } else {
            resolve(users[0]);
            logger.log('info', 'The address was found');
          }
        }).catch(function(erro) {
            logger.log('error', 'An error has occurred while getting a address by id %s', id, erro);
            reject(erro);
        });
      });
    },

    save: function(entity) {
      var self = this;
      return new Promise(function(resolve, reject) {
        logger.log('info', 'Creating a new address', JSON.stringify(entity));
        model.create(entity)
        .then(function(item) {
          logger.log('info', 'The address has been created succesfully', JSON.stringify(item));
          return self.getById(item._id);
        })
        .then(resolve)
        .catch(function(error) {
          logger.error('An error has ocurred while saving a new address', error);
          reject({
            status: 422,
            message: error.message
          });
        });
      });
    },

    update: function(entity) {
      return new Promise(function(resolve, reject) {
        logger.log('info', 'Update a address', JSON.stringify(entity));

        model.findByIdAndUpdate(entity._id, $.flatten(entity), {'new': true, fields: projectionCommonFields})
        .then(function(item) {
          logger.log('info', 'The address has been updated succesfully');
          logger.debug(JSON.stringify(item.toObject()));
          resolve(item.toObject());
        }).catch(function(error) {
          logger.error('An error has ocurred while updating a address', error);
          reject({
            status: 422,
            message: error
          });
        });
      });
    },

    disable: function(id) {
      return new Promise(function(resolve, reject) {
        logger.log('info', 'Disabling a address');

        model.findByIdAndUpdate(id, {_id:id, isEnabled: false}, {'new': true, fields: projectionCommonFields})
        .then(function(item) {
          logger.log('info', 'The address has been disabled succesfully');
          resolve(item.toObject());
        }).catch(function(error) {
          logger.error('An error has ocurred while disabling a address', error);
          reject({
            status: 422,
            message: error
          });
        });
      });
    },

    addForwardHistory: function(id, forwarded, history) {
      return new Promise(function(resolve, reject) {
        logger.debug('[AddressDAO] Adding to forward history of the address');

        model.findByIdAndUpdate(id, {
          $push: {forwards: history},
          $inc: {'balance.available': -forwarded, 'balance.forwarded': forwarded},
          isForwarding: false}, {'new': true, fields: projectionCommonFields})
        .then(function(item) {
          logger.debug('[AddressDAO] The history has been updated succesfully');
          resolve(item.toObject());
        }).catch(function(error) {
          logger.error('[AddressDAO] An error has ocurred while updating this forwards history', error);
          reject({
            status: 422,
            message: error
          });
        });
      });
    },

    addTokenForwardHistory: function(id, forwarded, history) {
      return new Promise(function(resolve, reject) {
        logger.debug('[AddressDAO.addTokenForwardHistory()] Adding to forward history of the address');

        model.findByIdAndUpdate(id, {
          $push: {forwards: history},
          $inc: {'token.balance.available': -forwarded, 'token.balance.forwarded': forwarded},
          isWaitingEther: false}, {'new': true, fields: projectionCommonFields})
        .then(function(item) {
          logger.debug('[AddressDAO.addTokenForwardHistory()] The history has been updated succesfully');
          resolve(item.toObject());
        }).catch(function(error) {
          logger.error('[AddressDAO.addTokenForwardHistory()] An error has ocurred while updating this forwards history', error);
          reject({
            status: 422,
            message: error
          });
        });
      });
    },

    addFillingHistory: function(id, forwarded, history) {
      return new Promise(function(resolve, reject) {
        logger.debug('[AddressDAO.addFillingHistory()] Adding to forward history of the address');

        model.findByIdAndUpdate(id, {
          $push: {forwards: history},
          $inc: {'balance.forwarded': forwarded}
        }, {'new': true, fields: projectionCommonFields})
        .then(function(item) {
          logger.debug('[AddressDAO.addFillingHistory()] The history has been updated succesfully');
          resolve(item.toObject());
        }).catch(function(error) {
          logger.error('[AddressDAO.addFillingHistory()] An error has ocurred while updating this forwards history', error);
          reject({
            status: 422,
            message: error
          });
        });
      });
    }
  };
};
