#! /usr/bin/env node
`use strict`;
const _ = require('lodash');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const preferences = require('preferences');
const inquirer = require('inquirer');
const columnify = require('columnify');
const git = require('simple-git/promise')();
const utils = require('./utils');
const write = utils.write;
const writeln = utils.writeln;

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

function exitWithError(errorText) {
  writeln(chalk.red('Problem: ') + errorText);
  process.exit(0);
}

write(chalk.green('Welcome! '));

// Choose a project, or add one if there are none.
let promise = Promise.try(() => {
  if (prefs.projects[currentPath]) {
    const projectNames = Object.keys(prefs.projects);
    const activeProjects = projectNames.filter((name) => {
      return prefs.projects[name].status === 'active';
    });
    writeln(`You have ${chalk.yellow(projectNames.length)} projects configured. ${ activeProjects.length === 0 ? 'None' : activeProjects.length } of them are in the process of being released.`)

    return;
  }

  // FIXME: should ask if you want to set it up, rather than assume you do.
  writeln(`You haven't set up a project corresponding to the current path yet.` + chalk.cyan(`Let's do that now.`));

  const directoryName = currentPath.split(path.sep).pop();

  let answer = await inquirer.prompt({ name: 'projectName', message: 'What would you like to call this project?', default: directoryName });
  prefs.projects[currentPath] = {};

    // Start a deployment?
  let answer = await inquirer.prompt({ type: 'confirm', name: 'startDeployment', message: 'Would you like to start a deployment now?', default: true });

  if (!answer.startDeployment) {
    writeln('OK!');
    return returnToMenu();
  }

});

