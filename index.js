#!/usr/bin/env node
'use strict';

/*
 _        _         _            
| \      (_)       | |           
| |       _  ____  | |  _   ___  
| |      | ||  _ \ | |_/ ) / _ \ 
| |_____ | || | | ||  _ ( | (_) |
\_______)|_||_| |_||_| \_) \___/ 

*/
////////////////////////////////////
/////// REQUIRE MODULE /////////////
////////////////////////////////////
var os             = require('os');
var fs             = require('fs');
var child_process  = require('child_process');
var moment         = require('moment-timezone');
var _              = require('underscore');
var ustr           = require('underscore.string');
var path           = require('path');
var pjson          = require('./package.json');
var vorpal         = require('vorpal')();
var fsAutocomplete = require('vorpal-autocomplete-fs');
//var consolere   = require('console-remote-client').connect('console.re','80','6be7-c5bc-71e4');

var DEBUG = true;
_.mixin(ustr.exports());
moment.locale('it');
moment.tz.setDefault("Europe/Rome");

var options = {
	gitformat : 'git log --format="||start||hash=%h---date=%ci---tags=%d---subject=%s---body=%b@end@" --name-status',
	gitpath   : '',
	gitbranch : ''
}

// cd /Users/Linko/Documents/GIT/PROGETTI\ EASY/MondialPol/gui
// git log --format="||start||hash=%h---date=%ci---tags=%d---subject=%s---body=%b@end@" --name-status
// tag regex = /v?V?[0-9]*\.[0-9]*\.[0-9]*[0-9][\S]*?[,|)]/

vorpal
	.command('genw', 'changelog generator wizard')
	.action(function(args, cb) {
		var self = this;

		options.gitpath   = '';
		options.gitbranch = '';

		self.prompt({
			type: 'input',
			name: 'gitpath',
			message: 'git absolute path = ',
		}, function (result) {
			options.gitpath = result.gitpath;
		
			self.prompt({
				type: 'input',
				name: 'gitbranch',
				message: 'git branch = ',
			}, function (result) {
				options.gitbranch = result.gitbranch;
				self.log(((options.gitbranch === undefined || !options.gitbranch) ? 'master':options.gitbranch) +' -> '+path.normalize(options.gitpath));
		
				self.prompt({
					type: 'confirm',
					name: 'conferma',
					message: 'confirm = ',
				}, function (result) {
					if(result.conferma){
						getLog(options.gitpath, options.gitbranch, self, cb);
					}else{
						cb();
					}
				});
			});
		});
	});


vorpal
	.command('gen <path...>', 'changelog generator one-line')
	.option('--branch <branch>', 'git branch')
	.autocomplete(fsAutocomplete())
	.action(function(args, cb) {
		var self = this;

		options.gitpath   = __dirname+'/'+args.path.join('').replace('°°', ' ');
		options.gitbranch = args.options.branch;

		self.log(((options.gitbranch === undefined) ? 'master':options.gitbranch) +' -> '+path.normalize(options.gitpath));
		self.prompt({
			type: 'confirm',
			name: 'conferma',
			message: 'confirm = ',
		}, function (result) {
			if(result.conferma){
				getLog(options.gitpath, options.gitbranch, self, cb);
			}else{
				cb();
			}
		});

	});

vorpal
	.delimiter('acl$')
	.show();



function getLog(repo, branch, vor, cb){
	var repo = path.normalize(repo);
	if(branch === undefined || branch === 'master'){branch=''}

	var exec = child_process.exec;
	var child = exec('cd "'+repo+'" && '+options.gitformat+' '+branch, function(error, stdout, stderr) {
		/*if(DEBUG){console.log(arguments);}
	    if(DEBUG){console.log('stdout: ', stdout);}
	    if(DEBUG){console.log('stderr: ', stderr);}
	    if (error !== null) {
	        if(DEBUG) console.log('exec error:', error);
	    }*/

	    var res = '';
	    if(stderr){
	    	vor.log(stderr);
	    	cb();	  
	    }else{
	    	res = parseLog(stdout);
		    fs.writeFile(repo+'CHANGELOG.md', res, function(err) {
			    if (err) {
					vor.log(err);	
			    }else{
					vor.log('CHANGELOG created on '+repo+'CHANGELOG.md');	
			    }
				cb();	    
			});
	    }


	});
}


function parseLog(raw) {
	var rawcommits = raw.split('||start||');
	var commits = [];

	for(var i=1; i<rawcommits.length; i++){
		var ic = i-1;
		rawcommits[i] = _.trim(rawcommits[i]).split('@end@');

		commits[ic] = {};
		commits[ic].data = {};
		commits[ic].files = [];

		var tmpdata = _.trim(rawcommits[i][0]).split('---');
		for(var key in tmpdata){
			var tmpval = tmpdata[key].split('=');
			if(tmpval[0] === 'tags'){	
				var tmpregex = tmpval[1].match(/v?V?[0-9]*\.[0-9]*\.[0-9]*[0-9][\S]*?[,|)]/);
				if(tmpregex && tmpregex.length){
			    	tmpval[1] = tmpregex[0].slice(0, -1);
				}else{
					tmpval[1] = '';
				} 		
			}
			commits[ic].data[tmpval[0]] = tmpval[1];
		}

		var tmpfiles = _.trim(rawcommits[i][1]).split('\n');
		for(var ind in tmpfiles){
			var tmpval = tmpfiles[ind].split('\t');
			commits[ic].files.push({type:tmpval[0], path:tmpval[1]});
		}

	}

	var md = '';

	commits.reverse();

	for(var k=0; k<commits.length; k++){
		var tmpmd = '';
		
		if(k === commits.length-1 && !commits[k].data.tags){
			commits[k].data.tags = 'WIP';
		}

		if(commits[k].data.tags){
			tmpmd = "\n`"+commits[k].data.tags+"` "+moment(commits[k].data.date).format('DD/MM/YYYY HH:mm')+"\n----\n";
		}
		tmpmd+= ' * '+commits[k].data.subject+'.\n';

		md = tmpmd+md;
	}

	md = 'CHANGELOG\n====\n'+md;

	return md;
}