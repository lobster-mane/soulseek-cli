const net = require('net')
const fs = require('fs')
const path = require('path')
const debug = require('debug')('slsk:peer:file')
const MessageFactory = require('../message-factory.js')

let stack = require('../stack')

const BAR_WIDTH = 20

function buildBar (step) {
  const filled = Math.round((step / 100) * BAR_WIDTH)
  return '[' + '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled) + ']'
}

function getFilePathName (user, file) {
  file = file.split('\\')
  return `/tmp/slsk/${user}_${file[file.length - 1]}`
}

module.exports = (host, port, token, user, noPierce) => {
  debug(`downloadPeerFile ${user}`)
  let conn = net.createConnection({
    host,
    port,
    readableHighWaterMark: 64 * 1024
  }, () => {
    if (noPierce) {
      debug(`noPierce ${user} connected`)
      conn.write(MessageFactory
        .to.peer
        .peerInit(stack.currentLogin, 'F', token)
        .getBuff())

      setTimeout(() => {
        debug(`noPierce sending 8* 00`)
        if (conn.destroyed) {
          debug(`socket closed`)
          return
        }
        conn.write(Buffer.from('00000000' + '00000000', 'hex'))
      }, 1000)
    } else {
      conn.write(MessageFactory
        .to.peer
        .pierceFw(token)
        .getBuff())
    }
  })

  let received = false
  let requestToken = noPierce ? token : undefined
  let tok
  let down

  // Streaming state
  let writeStream = null
  let filePath = null
  let fileName = null  // cached, computed once
  let incPath = null
  let earlyChunks = []  // accumulate without repeated Buffer.concat
  let earlyBufLen = 0
  let bytesReceived = 0
  let lastReportedStep = -1
  let ending = false

  function reportProgress (bytes, total) {
    if (total <= 0) return
    const step = Math.floor((bytes / total) * 10) * 10
    if (step > lastReportedStep) {
      lastReportedStep = step
      const bar = buildBar(step)
      const suffix = ' [' + step + '%]'
      const cols = process.stdout.columns || 80
      const maxNameLen = cols - bar.length - suffix.length - 2
      const name = fileName.length > maxNameLen ? fileName.slice(0, maxNameLen - 1) + '…' : fileName
      process.stdout.write('\r\x1b[2K' + bar + ' ' + name + suffix)
    }
  }

  function writeChunk (data) {
    const canWrite = writeStream.write(data)
    if (!canWrite) {
      conn.pause()
      writeStream.once('drain', () => conn.resume())
    }
  }

  conn.on('data', data => {
    if (!noPierce && !received) {
      requestToken = data.toString('hex', 0, 4)
      conn.write(Buffer.from('00000000' + '00000000', 'hex'))
      received = true
      return
    }

    debug(`file data`)
    if (down && down.stream) {
      debug('push to stream')
      down.stream.push(data)
    }

    bytesReceived += data.length

    // Resolve tok/down once requestToken is available
    if (!tok && requestToken) {
      tok = stack.downloadTokens[requestToken]
      if (tok) {
        down = stack.download[tok.user + '_' + tok.file]
      }
    }

    if (tok && down && !writeStream) {
      // Open the write stream now that we know the destination path
      filePath = down.path || getFilePathName(tok.user, tok.file)
      fileName = path.basename(filePath)
      incPath = filePath + '.incomplete'
      const dir = path.dirname(incPath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      writeStream = fs.createWriteStream(incPath)
      writeStream.on('error', (err) => debug(`writeStream error: ${err}`))
      // Flush early chunks with a single concat
      if (earlyChunks.length > 0) {
        writeChunk(Buffer.concat(earlyChunks, earlyBufLen))
        earlyChunks = []
        earlyBufLen = 0
      }
      writeChunk(data)
    } else if (writeStream) {
      writeChunk(data)
    } else {
      // tok not yet resolved — accumulate without repeated concat
      earlyChunks.push(data)
      earlyBufLen += data.length
    }

    if (tok) {
      reportProgress(bytesReceived, tok.size)

      if (!ending && bytesReceived >= tok.size) {
        ending = true
        debug(`disconnect, received: ${bytesReceived} size: ${tok.size}`)
        conn.end()
      }
    }
  })

  conn.on('close', () => {
    debug(`file socket close ${user}`)
    if (tok && down) {
      if (down.stream) down.stream.push(null)
      const finalPath = filePath || down.path || getFilePathName(tok.user, tok.file)

      const finish = () => {
        down.path = finalPath
        if (typeof down.cb === 'function') down.cb(null, down)
      }

      if (writeStream) {
        writeStream.end(() => {
          fs.rename(incPath, finalPath, (err) => {
            if (err) {
              debug(`rename failed: ${err}, falling back to copy`)
              fs.copyFile(incPath, finalPath, (copyErr) => {
                if (!copyErr) fs.unlink(incPath, () => {})
                finish()
              })
            } else {
              finish()
            }
          })
        })
      } else {
        const buf = earlyChunks.length > 0 ? Buffer.concat(earlyChunks, earlyBufLen) : Buffer.alloc(0)
        fs.writeFile(finalPath, buf, () => finish())
      }
    } else {
      debug(`ERROR: token ${token} not exist`)
    }
  })

  conn.on('error', () => {
    debug(`file socket error ${user}, destroying`)
    if (writeStream) writeStream.destroy()
    conn.destroy()
    // close event will be called (https://nodejs.org/api/net.html#net_event_error_1)
  })
}
