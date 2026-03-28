import inquirer from 'inquirer';
import _ from 'lodash';
import chalk from 'chalk';
import FilterResult from './FilterResult.js';
import Download from './Download.js';
const log = console.log;

export default function (searchService, downloadService, options, client) {
  this.download = new Download(downloadService, searchService, options, client);
  this.filterResult = new FilterResult(options.quality, options.mode, options.size);
  this.searchService = searchService;
  this.downloadService = downloadService;
  this.client = client;
  this.timeout = options.timeout ?? 2000;
  this.showPrompt = options.showPrompt ?? true;
  this.verbose = options.verbose ?? false;

  /**
   * Launch search query, then call a callback
   */
  this.search = () => {
    const query = this.searchService.getNextQuery();
    log(chalk.green("Searching for '%s'"), query);
    const searchParam = {
      req: query,
      timeout: this.timeout,
    };
    const afterSearch = (err, res) => this.onSearchFinished(err, res);
    this.client.search(searchParam, afterSearch);
  };

  /**
   * Callback called when the search query get back
   */
  this.onSearchFinished = (err, res) => {
    if (err) {
      return log(chalk.red(err));
    }

    const filesByUser = this.filterResult.filter(res);
    this.checkEmptyResult(filesByUser);

    if (this.verbose && !this.showPrompt) {
      this.printAllResults(filesByUser);
    }

    if (this.showPrompt) {
      this.showResults(filesByUser);
    } else {
      if (!this.verbose) {
        this.showTopResult(filesByUser);
      }
      process.exit(0);
    }
  };

  /**
   * If the result set is empty and there is no pending searches quit the process.
   * If there is pending searches, launch the next search.
   * If the result set is not empty just log success message.
   */
  this.checkEmptyResult = (filesByUser) => {
    if (_.isEmpty(filesByUser)) {
      log(chalk.red('Nothing found'));
      this.searchService.consumeQuery();

      if (this.searchService.allSearchesCompleted()) {
        process.exit(1);
      }

      this.search();
    } else {
      log(chalk.green('Search finished'));
    }
  };

  /**
   * Print all results to the screen
   *
   * @param {object} filesByUser
   */
  this.printAllResults = (filesByUser) => {
    const results = _.keys(filesByUser);
    log(chalk.green('Search returned ' + results.length + ' results'));
    results.forEach((result, index) => {
      log(chalk.blue('%d. %s'), index + 1, result);
    });
  };

  /**
   * Display the top result
   *
   * @param {array} filesByUser
   */
  this.showTopResult = (filesByUser) => {
    const numResults = Object.keys(filesByUser).length;

    if (numResults > 0) {
      const topResult = String(_.keys(filesByUser)[0]);
      log(chalk.green('Search returned ' + numResults + ' results'));
      log(chalk.blue('Top result: %s'), topResult);
    }
  };

  /**
   * Display a list of choices that the user can choose from.
   *
   * @param {array} filesByUser
   */
  this.showResults = (filesByUser) => {
    const choices = _.keys(filesByUser);

    const visible = this.verbose ? choices : choices.slice(0, 10);
    log(chalk.green('Displaying ' + visible.length + (choices.length > visible.length ? ' of ' + choices.length : '') + ' search results'));
    visible.forEach((choice, index) => log(chalk.blue('%d) %s'), index + 1, choice));

    const prompt = {
      type: 'input',
      name: 'selection',
      message: 'Choose a folder to download (q to quit)',
      validate: (input) => {
        if (input.toLowerCase() === 'q') return true;
        const num = parseInt(input, 10);
        if (!isNaN(num) && num >= 1 && num <= choices.length) return true;
        return `Please enter a number between 1 and ${choices.length}, or q to quit`;
      },
    };

    inquirer.prompt([prompt]).then((answers) => {
      if (answers.selection.toLowerCase() === 'q') process.exit(0);
      this.processChosenAnswers({ user: choices[parseInt(answers.selection, 10) - 1] }, filesByUser);
    });
  };

  /**
   * From the user answer, trigger the download of the folder
   * If there is pending search, launch the next search query
   *
   * @param {array} answers
   * @param filesByUser
   */
  this.processChosenAnswers = (answers, filesByUser) => {
    this.searchService.consumeQuery();
    this.download.startDownloads(filesByUser[answers.user]);

    if (this.searchService.allSearchesCompleted()) {
      this.downloadService.downloadLogger.flush();
      this.downloadService.everyDownloadCompleted();
    } else {
      this.search();
    }
  };
}
