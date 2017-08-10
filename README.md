# release-helper

A helper CLI for merging and deploying a release, as a step-by-step process.

### To install

Clone repo, enter directory, type `npm install`, then `npm link` (to make the utility available globally).

### To run

Enter the directory of a checked-out git repository, and type `release-helper`.

### Notes

* Preferences are stored encrypted, using the [preferences](https://github.com/caffeinalab/preferences/) module.
* If you made a mistake (or want to reset all of your settings for any reason), delete the config file at `~/.config/preferences/jira-git-helper.pref`.

### Contribution

Pull requests welcome. If your encounter issues or have feature suggestions, feel free to open a ticket.