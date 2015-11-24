"use strict";

var spawnSync = require('child_process').spawnSync;
var http = require('http');
var fs = require('fs');
var path = require('path');
var argv = require('yargs').argv;

class Hooker {
    constructor(options) {
        var appNames = Object.keys(options.config);
        var apps = appNames.map(appName => {
            var app = options.config[appName];
            app.name = appName;
            return app;
        });
        this.port = options.port || 17892;

        this.paths = new Map();
        Object.keys(options.config).forEach(appName => {
            var app = options.config[appName];
            var path = appName || app.path.split('/').pop();
            this.paths.set('/' + path, app);
        });

        if (options.daemon) {
            console.log("Daemonizing...");
            require('daemon')();
            this.logfd = fs.openSync(path.join(process.cwd(), (typeof options.log == 'string' ? options.log : 'hooker.log')), 'a');
            this.log("\n\n---------------------------------");
            this.log("Started: " + new Date());
            this.log("Daemonized PID: " + process.pid);
        }

        var httpServer = new http.createServer((req, res) => {
            if (req.url == "/favicon.ico") return res.end();
            this.log("\n---------------------");
            this.log(new Date());
            this.log("Path: " + req.url);
            var app = this.paths.get(req.url);
            if (app) {
                this.pull(app);
                res.write("ok");
                res.end();
            }
        });

        httpServer.listen(this.port, () => {
            this.log("Configured for: " + appNames.join(', '));
            this.log("Listening on port: " + this.port);
        });
    }

    pull(app) {
        var config = {cwd: app.path, stdio: [this.logfd || 0, this.logfd || 1, this.logfd || 2]};
        this.log("EXEC: Pull (" + app.path + ")");
        spawnSync("git", ["pull"], config);
        this.log("EXEC: Bash");
        if (app.bash) spawnSync("/bin/bash", app.bash, config);
    }

    log(data) {
        if (!this.logfd) return console.log(data);
        fs.writeSync(this.logfd, data + "\n");
    }
};


module.exports = Hooker;

if (require.main === module) {
    new Hooker({
        config: require(path.join(process.cwd(), 'hooker.json')),
        port: argv.port,
        daemon: argv.daemon,
        //log: argv.log,
    });
}
