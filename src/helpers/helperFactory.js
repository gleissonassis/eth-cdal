var RequestHelper                 = require('./requestHelper');
var DateHelper                    = require('./dateHelper');
var SendMailHelper                = require('./sendMailHelper');
var DynamicTextHelper             = require('./dynamicTextHelper');
var StringReplacerHelper          = require('./stringReplacerHelper');
var UserHelper                    = require('./userHelper');
var JWTHelper                     = require('./jwtHelper');
var MutexHelper                   = require('./mutexHelper');
var DaemonHelper                  = require('./daemonHelper');
var settings                      = require('../config/settings');
var request                       = require('request');
var nodemailer                    = require('nodemailer');
var mutex                         = require( 'node-mutex' );
var Web3                          = require('web3');
var abiDecoder                    = require('abi-decoder');
var ERC20Interface                = require('../contracts/interfaces/ERC20.json');
var ERC865Interface               = require('../contracts/interfaces/ERC865.json');
var FullTokenInterface            = require('../contracts/interfaces/FullToken.json');
var MintableTokenInterface        = require('../contracts/interfaces/MintableToken.json');

// preventing ERR max number of clients reached from REDIS
var m = mutex(settings.mutex);

module.exports = {
  getHelper: function(helper) {
    switch (helper) {
      case 'daemon':
        var web3 = new Web3();
        web3.setProvider(new web3.providers.HttpProvider(settings.daemonSettings.baseUrl));

        return new DaemonHelper({
          web3: web3,
          abiDecoder: abiDecoder,
          erc20Interface: ERC20Interface,
          mintableTokenInterface: MintableTokenInterface,
          erc865Interface: ERC865Interface,
          fullTokenInterface: FullTokenInterface
        });
      case 'mutex':
        return new MutexHelper({
          mutex: m
        });
      case 'request':
        return new RequestHelper({
          request: request
        });
      case 'date':
        return new DateHelper();
      case 'sendMail':
        return new SendMailHelper({
          nodemailer: nodemailer
        });
      case 'stringReplacer':
        return new StringReplacerHelper();
      case 'user':
        return new UserHelper();
      case 'jwt':
        return new JWTHelper();
      case 'dynamicText':
        return new DynamicTextHelper({
          stringReplacerHelper: this.getHelper('stringReplacer')
        });
      default:
        return null;
    }
  }
};
