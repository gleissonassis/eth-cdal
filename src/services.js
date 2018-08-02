                          require('./config/database.js')();
var WorkerFactory       = require('./workers/workerFactory');

/*var bfsWorker = WorkerFactory.getWorker('bfs');
bfsWorker.run();*/


var worker = WorkerFactory.getWorker('bfs');
worker.run();
