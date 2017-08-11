"use strict";
const _ = require('lodash');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const preferences = require('preferences');
const inquirer = require('inquirer');
const columnify = require('columnify');
const git = require('simple-git/promise')();
const execSync = require('child_process').execSync;
const utils = require('./utils')
const write = utils.write;
const writeln = utils.writeln;
const runAsync = utils.runAsync;

export function info() {
  return {
    slug: 'pre-merge'
  }
}

// - checkout master
// - pull
// - make sure there is no existing tag matching package.json version
// - make sure changelog entry exists without date, and matches package.json version
// - run linter
// - checkout deploy
// - pull

export async function run(returnToMenu, exitWithError) {
  // Start a deployment?
  let answer = await inquirer.prompt({ type: 'confirm', name: 'startDeployment', message: 'Would you like to start a deployment now?', default: true });

  if (!answer.startDeployment) {
    writeln('OK!');
    return returnToMenu();
  }

  // Checkout master if necesary.
  const status = await git.status();
  if (status.current !== 'master') {
    await runAsync('Checking out the ' + chalk.cyan('master') + ' branch', git.checkout('master'));
  } else {
    write('On master. ');
  }

  // Pull master.  
  await runAsync('Pulling latest changes', git.pull());

  // Load package.json and verify there is no existing tag matching version.
  const packageFile = require(currentPath + path.sep + 'package.json');
  const packageVersion = packageFile.version;
  const tags = await git.tags();
  if (tags.contains(packageVersion)) {
    return exitWithError(`package.json contains version ${packageVersion}, but a tag by that name already exists!`);
  }

  // Make sure changelog entry exists, is not already dated, and matches pakcage version.
  answer = await inquirer.prompt(constructFilenamePrompt());

  // Remember the filename for next time.
  prefs.projects[currentPath].changelogFilename = answer.logFilename;
  
  try {
    let changelogContents = fs.readFileSync(answer.logFilename, { encoding: 'utf8' });
  }
  catch (changelogReadError) {
    return exitWithError(changelogReadError);
  }

  // If a lint npm script exists, ask to run it.
  if (packageFile.scripts && packageFile.scripts.lint) {
    answer = await inquirer.prompt({ type: 'confirm', name: 'runLinter', message: `Run the linter (${chalk.grey('npm run-script lint')})?`, default: true });

    if (answer.runLinter) {
      // TODO: make this better
      try {
        execSync('npm run-script lint');
      } catch (lintError) {
        return exitWithError('Linting error encountered')
      }
    }
  }

  // Checkout and pull deploy branch.
  await runAsync('Checking out deploy branch', git.checkout('deploy'));
  await runAsync('Pulling latest changes', git.pull());
}

/**
 * Construct the prompt asking for a changelog filename, with suggestions based on whether
 * a changelog was previous chosen or can be found in the working directory.
 */
function constructFilenamePrompt() {
  const filenamePrompt = { type: 'input', name: 'logFilename', message: 'What is the changelog file name?' };

  // Case 1: we already stored a changelog filename for this project.
  if (prefs.projects[currentPath].changelogFilename) {
    filenamePrompt.default = prefs.projects[currentPath].changelogFilename;
    filenamePrompt.message += ' (previously used ' + prefs.projects[currentPath].changelogFilename + ' for this project)';
  } else {
    // Case 2: there exists some changelog-looking file in the working directory.
    const filenameGuess = fs.readdirSync('.').find((filename) => { return filename.toLowerCase().startsWith('changelog') || filename.toLowerCase().startsWith('history'); })
    if (filenameGuess) {
      filenamePrompt.default = filenameGuess;
      filenamePrompt.message += ' (I found a file called ' + filenameGuess + ' in the current directory)';
    }
  }

  return filenamePrompt;
}