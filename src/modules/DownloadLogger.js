import chalk from 'chalk';
const log = console.log;

const BAR_WIDTH = 20;

function buildProgressBar(current, total) {
  const filled = total > 0 ? Math.round((current / total) * BAR_WIDTH) : 0;
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(BAR_WIDTH - filled));
}

function formatLine(fileIndex, total, filePath) {
  return `[${buildProgressBar(fileIndex, total)}] (${fileIndex}/${total}) Received: ${filePath}`;
}

export default function (searchService, downloadService) {
  this.searchService = searchService;
  this.downloadService = downloadService;
  this.logBuffer = [];
  this.fileIndex = 0;

  /**
   * Display a progress bar and the path of the downloaded file.
   * @param  {string} path Path of the downloaded file
   */
  this.downloadComplete = (path) => {
    this.fileIndex++;

    if (this.searchService.allSearchesCompleted()) {
      const total = this.downloadService.getFileCount();
      process.stdout.write('\n');
      log(formatLine(this.fileIndex, total, path));
    } else {
      this.logBuffer.push({ fileIndex: this.fileIndex, path });
    }
  };

  /**
   * Flush buffered download lines once the total file count is known.
   */
  this.flush = () => {
    if (this.logBuffer.length > 0) {
      const total = this.downloadService.getFileCount();
      process.stdout.write('\n');
      this.logBuffer.forEach(({ fileIndex, path }) => log(formatLine(fileIndex, total, path)));
      this.logBuffer = [];
    }
  };

  /**
   * Write a line summing the number of files starting to download and the destination directory.
   * @param  {number} fileCount Number of files
   * @param  {string} baseDir   Destination directory
   */
  this.startDownload = (fileCount, baseDir) => {
    log(chalk.green(`Starting download of ${fileCount} file${fileCount > 1 ? 's' : ''} to ${baseDir}...`));
  };
}
