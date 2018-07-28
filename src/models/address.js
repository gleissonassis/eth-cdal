var mongoose = require('mongoose');
var mongooseSchema =  mongoose.Schema;

var model = null;

module.exports = function(){
  var schema = mongooseSchema({
    ownerId: {
      type: String,
      required: false,
    },
    address: {
      type: String,
      required: true,
    },
    balance: {
      available: {
        type: Number,
        required: true,
      },
      locked: {
        type: Number,
        required: true
      },
      forwarded: {
        type: Number,
        required: false
      }
    },
    privateKey: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      required: false,
    },
    token: {
      symbol: {
        type: String,
        required: false
      },
      contractAddress: {
        type: String,
        required: false
      },
      balance: {
        available: {
          type: Number,
          required: false,
        },
        locked: {
          type: Number,
          required: false
        }
      }
    },
    updatedAt: {
      type: Date,
      required: false,
    },
    isEnabled: {
      type: Boolean,
      required: true
    },
    isForwarding: {
      type: Boolean,
      required: false
    },
    forwards: [
      {
        to: {
          type: String,
          required: true,
        },
        transactionHash: {
          type: String,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
        createdAt: {
          type: Date,
          required: true,
        },
      }
    ]
  });

  model = model ? model : mongoose.model('addresses', schema);

  return model;
};
