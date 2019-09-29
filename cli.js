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
const seen = new Map()

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

const action = async (end=(now - (onehour * 20))) => {
  execSync('git lfs install')
  let now = Date.now() - (onehour * 6)
  end = (new Date(end)).getTime()
  let i = now
  while (i >= end) {
    i -= onehour

    const filename = filepath(new Date(i))
    if (await exists(filename)) {
      for (const [key, value] of Object.entries(await load(filename))) {
        seen.set(key, value)
      }
      console.log('seen has loaded', seen.size, filename)
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

    const results = [{}]
    const _repos = Array.from(repos)

    for (let repo of _repos) {
      if (seen.has(repo)) {
        results[0][repo] = seen.get(repo)
        repos.delete(repo)
      }
    }

    repos = Array.from(repos)

    while (repos.length) {
      results.push(await getLanguages.query(repos.splice(0, 100)))
      console.log(repos.length, 'remaining for', filename)
    }
    const hourData = Object.assign(...results)
    await brotli(Buffer.from(JSON.stringify(hourData)), filepath(new Date(i)))
    for (const [key, value] of Object.entries(hourData)) {
      seen.set(key, value)
    }
    console.log('cachesize', seen.size)
  }
}

const runAction = argv => {
  return action(argv.start)
}

const yargs = require('yargs')
const args = yargs
  .command('action [start]', 'run the hourly github action', () => {}, runAction)
  .argv

if (!args._.length) {
  yargs.showHelp()
}
