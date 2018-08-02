var BOFactory           = require('../business/boFactory');
var BOSWorker           = require('./bosWorker');
var TNSWorker           = require('./tnsWorker');
var AAPMSWorker         = require('./aapmsWorker');
var BOSWorker           = require('./bosWorker');
var BFSWorker           = require('./bfsWorker');
var TBFSWorker           = require('./tbfsWorker');
var EFSWorker           = require('./efsWorker');
var DateHelper          = require('../helpers/dateHelper');
var HelperFactory       = require('../helpers/helperFactory');

module.exports = {
  getWorker: function(woker) {
    switch (woker) {
      case 'bfs':
        return new BFSWorker({
          addressBO: BOFactory.getBO('address'),
          transactionBO: BOFactory.getBO('transaction'),
          daemonHelper: HelperFactory.getHelper('daemon'),
          dateHelper: HelperFactory.getHelper('date')
        });
      case 'tbfs':
        return new TBFSWorker({
          addressBO: BOFactory.getBO('address'),
          transactionBO: BOFactory.getBO('transaction'),
          daemonHelper: HelperFactory.getHelper('daemon'),
          dateHelper: HelperFactory.getHelper('date')
        });
      case 'efs':
        return new EFSWorker({
          addressBO: BOFactory.getBO('address'),
          transactionBO: BOFactory.getBO('transaction'),
          daemonHelper: HelperFactory.getHelper('daemon'),
          dateHelper: HelperFactory.getHelper('date')
        });
      case 'aapms':
        return new AAPMSWorker({
          dateHelper: new DateHelper(),
          addressBO: BOFactory.getBO('address'),
          configurationBO: BOFactory.getBO('configuration'),
          daemonHelper: HelperFactory.getHelper('daemon')
        });
      case 'tns':
        return new TNSWorker({
          dateHelper: new DateHelper(),
          addressBO: BOFactory.getBO('address'),
          transactionBO: BOFactory.getBO('transaction'),
          requestHelper: HelperFactory.getHelper('request'),
          configurationBO: BOFactory.getBO('configuration')
        });
      case 'bos':
        return new BOSWorker({
          dateHelper: new DateHelper(),
          addressBO: BOFactory.getBO('address'),
          transactionBO: BOFactory.getBO('transaction'),
          configurationBO: BOFactory.getBO('configuration'),
          daemonHelper: HelperFactory.getHelper('daemon')
        });
      default:
        return null;
    }
  }
};
