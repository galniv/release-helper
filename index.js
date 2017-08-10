#! /usr/bin/env node
"use strict";
const _ = require('lodash');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const preferences = require('preferences');
const inquirer = require('inquirer');
const columnify = require('columnify');
const exec = require('child_process').exec;
const execAsync = Promise.promisify(exec, { multiArgs: true });
const utils = require('./utils')

/*
  => enter 'pre-merge stage'
  - checkout master
  - pull
  - make sure there is no existing tag matching package.json version
  - make sure changelog entry exists without date, and matches package.json version
  - run linter
  - checkout deploy
  - pull
  => enter 'merged' stage
  - merge master into deploy
  - push
  => enter 'verify on staging' stage, prompt to continue
  - tag last commit with appropriate version
  - push tags
  => enter 'ask for deployment' stage, output the request text/changelog entry, prompt to continue
  => enter 'verify on production' stage, prompt to continue
  - checkout master
  => enter 'ready next version' stage, prompt for next version tag (suggest next patch version)
  - bump package.json version
  - add date to changelog
  - add chagnelog entry for next release
  - commit both
  - push
  => 'done' stage, keep track of last version released
*/

const states = ['pre-merge', 'merged', 'verify-staging', 'verify-production', 'ready-next-version', 'done'];

const currentPath = fs.realpathSync('.');

var prefs = new preferences('release-helper', {
  projects: {}
});

function skipState(currentState) {
  return prefs.projects[currentPath].state && states.indexOf(prefs.projects[currentPath].state) > states.indexOf(currentState);
}

process.stdout.write(chalk.green('Welcome! '));

// Choose a project or add one if there are none.
let promise = Promise.try(() => {
  if (prefs.projects[currentPath]) {
    const projectNames = Object.keys(prefs.projects);
    const activeProjects = projectNames.filter((name) => {
      return prefs.projects[name].status === 'active';
    });
    console.log(`You have ${chalk.yellow(projectNames.length)} projects configured. ${ activeProjects.length === 0 ? 'None' : activeProjects.length } of them are in the process of being released.`)

    return;
  }

  // FIXME: should ask if you want to set it up, rather than assume you do.
  console.log("You haven't set up a project corresponding to the current path yet."  + chalk.cyan(" Let's do that now.\n"));

  const directoryName = currentPath.split(path.sep).pop();

  return inquirer.prompt({ name: 'projectName', message: 'What would you like to call this project?', default: directoryName }).then((answer) => {
    prefs.projects[currentPath] = {};
  });
});

// Pre-merge
promise = promise.then(() => {
  if (skipState('pre-merge')) return;

  // Start a deployment?
  return inquirer.prompt({ type: 'confirm', name: 'startDeployment', message: 'Would you like to start a deployment now?', default: true }).then((answer) => {
    if (!answer.startDeployment) {
      // TODO: kick off to a main menu
      return;
    }

    // Checkout master if necesary.
    let preMergePromise = execAsync('git status').then(([, stdout]) => {
      if (stdout.startsWith('On branch master')) { return callback(); }

      process.stdout.write('Checking out the ' + chalk.cyan('master') + ' branch... ');
      exec('git checkout master');
      console.log('done');
      callback();
    });

    // Pull master.
    preMergePromise = preMergePromise.then(() => {
      process.stdout.write('Pulling latest changes... ');
      exec('git pull');
      console.log('done')
    });

    const packageVersion;
    // Load package.json and verify there is no existing tag matching version.
    preMergePromise = preMergePromise.then(() =>
      packageVersion = require(currentPath + path.sep + 'package.json').version;
      return execAsync(`git tag | grep ${packageVersion}`).then(([, stdout]) => {
        if (stdout !== packageFile.version) {
          console.log(chalk.red('Problem: ') + `package.json contains version ${packageVersion}, but a tag by that name already exists!`)
          process.exit(0);
        }
      });
    });

    preMergePromise = preMergePromise.then(() => {
      let filenamePrompt = { type: 'input', name: 'logFilename', message: 'What is the changelog file name?' };

      if (prefs.projects[currentPath].changelogFilename) {
        filenamePrompt.default = prefs.projects[currentPath].changelogFilename;
        filenamePrompt.message += ' (previously used ' + prefs.projects[currentPath].changelogFilename + ' for this project)';
      }
      else {
        const filenameGuess = fs.readdirSync('.').find((filename) => { return filename.toLowerCase().startsWith('changelog'); })
        if (filenameGuess) {
          filenamePrompt.default = filenameGuess;
          filenamePrompt.message += ' (I found a file called ' + filenameGuess + ' in the current directory)';
        }
      }
      return inquirer.prompt(filenamePrompt).then((answer) => {
        // Remember the filename for next time.
        if (!prefs.projects[currentPath].changelogFilename) {
          prefs.projects[currentPath].changelogFilename = answer.logFilename;
        }
        
        try {
          let changelogContents = fs.readFileSync(answer.logFilename, { encoding: 'utf8' });
          
        }
        catch (changelogReadError) {
          console.log(chalk.red('Problem: ') + changelogReadError);
          process.exit(0);
        }
      });
    });
  });
});


