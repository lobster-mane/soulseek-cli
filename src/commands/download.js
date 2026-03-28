import chalk from 'chalk';
import Search from '../modules/Search.js';
import SearchService from '../services/SearchService.js';
import DownloadService from '../services/DownloadService.js';
import CredentialsService from '../services/CredentialsService.js';
const log = console.log;

// Available file modes
const modes = ['audio', 'video', 'mp3', 'flac', 'mp4', 'mkv'];

class DownloadCommand {
  constructor(queries, options) {
    if (queries.length === 0) {
      log(chalk.red('Please add a search query'));
      process.exit(1);
    }

    if (!modes.includes(options.mode)) {
      log(chalk.red(`--mode is invalid. Valid values: ${modes.join(', ')})`));
      process.exit(1);
    }

    if (!['audio', 'mp3', 'flac'].includes(options.mode) && options.quality) {
      log(chalk.red(`--quality is incompatible with the "${options.mode}" mode. Please remove this option.`));
      process.exit(1);
    }

    if (options.size && !/^([<>]=?|=)\d+(?:\.\d+)?(b|kb|mb|gb)$/i.test(options.size)) {
      log(chalk.red('--size is invalid. Expected format: <operator><value><unit>, e.g. "<5gb", ">=100mb"'));
      process.exit(1);
    }

    this.options = options;
    this.searchService = new SearchService(queries);
    this.downloadService = new DownloadService(this.searchService);
    this.search = null;

    this.credentialsService = new CredentialsService();
    this.credentialsService.connect(this.onConnected.bind(this));
  }

  /**
   * @param {SlskClient} client
   */
  onConnected(client) {
    this.search = new Search(this.searchService, this.downloadService, this.options, client);
    this.search.search();
  }
}

export default DownloadCommand;
