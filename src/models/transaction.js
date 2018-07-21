var mongoose = require('mongoose');
var mongooseSchema =  mongoose.Schema;

var model = null;

module.exports = function(){
  var schema = mongooseSchema({
    ownerId: {
      type: String,
      required: false,
    },
    ownerTransactionId: {
      type: String,
      required: false,
    },
    amount: {
      type: Number,
      required: true
    },
    gas: {
      type: Number,
      required: true
    },
    gasPrice: {
      type: Number,
      required: true
    },
    isConfirmed: {
      type: Boolean,
      required: true
    },
    notifications: {
      creation: {
        isNotified: {
          type: Boolean,
          required: true
        },
        notifiedAt: {
          type: Date,
          required: false
        },
      },
      confirmation: {
        isNotified: {
          type: Boolean,
          required: true
        },
        notifiedAt: {
          type: Date,
          required: false
        },
      }
    },
    transactionHash: {
      type: String,
      required: true
    },
    to: {
      type: String,
      required: false
    },
    from: {
      type: String,
      required: true
    },
    input: {
      type: String,
      required: false
    },
    parsedInput: {
      type: Object,
      required: false
    },
    symbol: {
      type: String,
      required: false
    },
    createdAt: {
      type: Date,
      required: false,
    },
    updatedAt: {
      type: Date,
      required: false,
    }
  });

  model = model ? model : mongoose.model('transactions', schema);

  return model;
};
