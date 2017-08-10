const inquirer = require('inquirer');
const chalk = require('chalk');
const figures = require('figures');

// Generate a modified inquirer.Separator object, containing a string title.
module.exports.generateTitledSeparator = function (title, maxTitleLength) {
  if (!maxTitleLength) {
    maxTitleLength = title.length;
  }
  // Calculate the total line length, which is the max title length plus padding. Use 15 (or 16, if the max title length is even) as the miminal length.
  const lineLength = Math.max((maxTitleLength % 2 === 0 ? 16 : 15), maxTitleLength + 8);
  // Find the position at which the title will appear in the string.
  const titlePadding = (lineLength - maxTitleLength - 2) / 2;
  // If the title is shorter than the max title, pad the end of the line.
  const endPadding = titlePadding + maxTitleLength - title.length;
  var separatorText = new Array(titlePadding).join(figures.line) + ' ' + title + ' ' + new Array(endPadding).join(figures.line);
  // Dim the separator text.
  return new inquirer.Separator(chalk.dim(separatorText));
}