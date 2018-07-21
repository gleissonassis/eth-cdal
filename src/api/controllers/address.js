var BOFactory             = require('../../business/boFactory');
var HTTPResponseHelper    = require('../../helpers/httpResponseHelper');
var AAPMSWorker           = require('../../workers/aapmsWorker');

module.exports = function() {
  var business = BOFactory.getBO('address');
  var configurationBO = BOFactory.getBO('configuration');

  var aapmsWorker = new AAPMSWorker({
    addressBO: business,
    configurationBO: configurationBO
  });

  return {
    getAll: function(req, res) {
      var rh = new HTTPResponseHelper(req, res);
      business.getAll({})
        .then(rh.ok)
        .catch(rh.error);
    },

    getAllByOwnerId: function(req, res) {
      var rh = new HTTPResponseHelper(req, res);
      business.getAll({ownerId: req.params.ownerId})
        .then(rh.ok)
        .catch(rh.error);
    },

    update: function(req, res) {
      var rh = new HTTPResponseHelper(req, res);
      req.body.key = req.params.key;

      if (req.params.ownerId) {
        req.body.ownerId = req.params.ownerId;
      }

      business.update(req.body)
        .then(rh.ok)
        .catch(rh.error);
    },

    createAddress: function(req, res) {
      var rh = new HTTPResponseHelper(req, res);
      business.createAddress(req.params.ownerId, req.body.contractAddress, req.body.tokenSymbol)
        .then(function(r) {
          rh.created(r);

          //this process will occurs in a diferent thread, just to maintain the
          //the pool with a good amount of availabe addresses
          aapmsWorker.run();
        })
        .catch(rh.error);
    },

    getByAddress: function(req, res) {
      var rh = new HTTPResponseHelper(req, res);

      business.getByAddress(req.params.ownerId, req.params.address)
        .then(rh.ok)
        .catch(rh.error);
    },

    getAddressBalance: function(req, res) {
      var rh = new HTTPResponseHelper(req, res);

      business.getByAddress(req.params.ownerId, req.params.address)
        .then(function(address) {
          return business.updateBalance(address);
        })
        .then(function() {
          return business.getAddressBalance(req.params.address);
        })
        .then(rh.ok)
        .catch(rh.error);
    }
  };
};
