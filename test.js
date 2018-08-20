var Web3                          = require('web3');
var settings                      = require('./src/config/settings');
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider(settings.daemonSettings.baseUrl));

function forceBN(x) {
  var e = null;
  if (Math.abs(x) < 1.0) {
    e = parseInt(x.toString().split('e-')[1]);
    if (e) {
        x *= Math.pow(10,e-1);
        x = '0.' + (new Array(e)).join('0') + x.toString().substring(2);
    }
  } else {
    e = parseInt(x.toString().split('+')[1]);
    if (e > 20) {
        e -= 20;
        x /= Math.pow(10,e);
        x += (new Array(e+1)).join('0');
    }
  }
  return x;
};

console.log(forceBN(10e-2));
console.log(web3.utils.toBN(forceBN(10e-100)).toString());
