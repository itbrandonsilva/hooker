"use strict";

var spawnSync = require('child_process').spawnSync;
var http = require('http');
var fs = require('fs');
var path = require('path');

var Hooker = function (options) {
    var self = this;

    this.repoPath = options.repository || process.cwd();
    this.port = options.port || 17892;
    this.hookPath = options.hookPath || function () {
        var split = self.repoPath.split('/');
        return "/" + split[split.length-1]; 
    }();
    this.bash = options.bash;

    if (options.daemon) {
        console.log("Daemonizing...");
        require('daemon')();
        this.logfd = fs.openSync(path.join(process.cwd(), (typeof options.log == 'string' ? options.log : 'hooker.log')), 'a');
        this.log("\n\n---------------------------------");
        this.log("Started: " + new Date());
        this.log("Daemonized PID: " + process.pid);
    }
    
    var httpServer = new http.createServer(function (req, res) {
        if (req.url == "/favicon.ico") return res.end();
        self.log("\n---------------------");
        self.log(new Date());
        self.log("Path: " + req.url);
        if (req.url != self.hookPath) return res.end();
        self.pull();
        res.write("ok");
        res.end();
    });
    httpServer.listen(this.port, null, null, function () {
        self.log("Configured for: " + self.repoPath);
        self.log("Listening on port: " + self.port);
        self.log("Hook path set to: " + self.hookPath);
    });
};

Hooker.prototype.pull = function () {
    var config = {cwd: this.repoPath, stdio: [this.logfd || 0, this.logfd || 1, this.logfd || 2]};
    this.log("EXEC: Pull");
    spawnSync("git", ["pull"], config);
    this.log("EXEC: Bash");
    if (this.bash) spawnSync("/bin/bash", [path.join(process.cwd(), this.bash)], config);
};

Hooker.prototype.log = function (data) {
    if (!this.logfd) return console.log(data);
    fs.writeSync(this.logfd, data + "\n");
};

module.exports = Hooker;

if (require.main === module) {
    var argv = require('yargs').argv;
    var repoPath = (argv.repo ? process.cwd() + "/" + argv.repo : null);

    new Hooker({
        repository: repoPath,
        port: argv.port,
        hookPath: argv.path,
        log: argv.log,
        daemon: argv.daemon,
        bash: argv.bash
    });
}
