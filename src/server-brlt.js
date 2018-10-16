var http    = require('http');
var app     = require('./config/express')();
              require('./config/database.js')();
var Starter = require('./starter');


var server = http.createServer(app).listen(app.get('port'), function() {
    console.log('Express is running on port ' + app.get('port'));
});

if (process.env.NODE_ENV !== 'test'){
    var starter = new Starter();
    starter.configureApplication(true);
}

module.exports = server;
