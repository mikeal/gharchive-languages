#!/usr/bin/env node
const getLanguages = require('./')
const mkdirp = require('mkdirp')
const path = require('path')
const brotli = require('brotli-max')
const { readFile, stat } = require('fs').promises
const { brotliDecompress } = require('zlib')
const { promisify } = require('util')
const { execSync } = require('child_process')
const decompress = promisify(brotliDecompress)
const onehour = 1000 * 60 * 60

const filepath = ts => {
  const year = ts.getUTCFullYear()
  const month = (ts.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = ts.getUTCDate().toString().toString().padStart(2, '0')
  const hour = ts.getUTCHours()
  const filename = `${year}-${month}-${day}-${hour}.json.br`
  const dir = path.join(...[year, month, day].map(i => i.toString()))
  mkdirp.sync(dir)
  const f = `${dir}/${filename}`
  console.log(`git lfs pull --include "${f}"`)
  execSync(`git lfs pull --include "${f}"`)
  return f
}

const load = async filename => {
  const buffer = await decompress(await readFile(filename))
  return JSON.parse(buffer.toString())
}

const exists = async filename => {
  try {
    await stat(filename)
  } catch (e) {
    return false
  }
  return true
}

const now = Date.now()

const action = async (end=(now - (onehour * 4)), cacheFile) => {
  const seen = require('./lib/cache')(cacheFile)
  execSync('git lfs install')
  let now = Date.now() - (onehour * 3)
  end = (new Date(end)).getTime()
  let i = now
  while (i >= end) {
    i -= onehour

    const filename = filepath(new Date(i))
    if (await exists(filename)) {
      if (!await seen.loaded(filename)) {
        let o = await load(filename)
        await seen.add(filename, o)
      }
      continue
    }

    let repos
    try {
      repos = await getLanguages.getRepos(i)
    } catch (e) {
      if (e.statusCode === 404) {
        console.log(i, 'not available', filename)
        continue
      }
      throw e
    }

    const cached = await seen.get(Array.from(repos))
    const results = [cached]
    Object.keys(cached).forEach(k => repos.delete(k))

    repos = Array.from(repos)

    while (repos.length) {
      results.push(await getLanguages.query(repos.splice(0, 100)))
      console.log(repos.length, 'remaining for', filename)
    }
    const hourData = Object.assign(...results)
    await brotli(Buffer.from(JSON.stringify(hourData)), filepath(new Date(i)))
    await seen.add(filename, hourData)
  }
}

const runHour = async argv => {
  const i = new Date(argv.hour)
  const filename = filepath(new Date(i))

  const repos = Array.from(await getLanguages.getRepos(i))

  const results = []

  while (repos.length) {
    results.push(await getLanguages.query(repos.splice(0, 100)))
    console.log(repos.length, 'remaining for', filename)
  }
  const hourData = Object.assign(...results)
  await brotli(Buffer.from(JSON.stringify(hourData)), filepath(new Date(i)))
}


const runAction = argv => {
  return action(argv.start, argv.cachefile)
}

const options = yargs => {
  yargs.positional('start', {
    desc: 'How far back to go, defaults to 24 hours'
  })
  yargs.option('cachefile', {
    desc: 'Cachfile location, defaults to a tmpdir'
  })
}

const yargs = require('yargs')
const args = yargs
  .command('hour <hour>', 'pull and save an hour of data', () => {}, runHour)
  .command('fill [start]', 'back fill until you reach start', () => {}, runAction)
  .argv

if (!args._.length) {
  yargs.showHelp()
}
