#!/usr/bin/env node
const getLanguages = require('./')
const mkdirp = require('mkdirp')
const path = require('path')
const brotli = require('brotli-max')
const { readFile, stat } = require('fs').promises
const { brotliDecompress } = require('zlib')
const { promisify } = require('util')
const decompress = promisify(brotliDecompress)
const onehour = 1000 * 60 * 60
const seen = {}

const filepath = ts => {
  const year = ts.getUTCFullYear()
  const month = (ts.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = ts.getUTCDate().toString().toString().padStart(2, '0')
  const hour = ts.getUTCHours()
  const filename = `${year}-${month}-${day}-${hour}.json.br`
  const dir = path.join(...[process.cwd(), year, month, day].map(i => i.toString()))
  mkdirp.sync(dir)
  return `${dir}/${filename}`
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

const action = async () => {
  let now = Date.now()
  let i = now
  while (i > (now - (onehour * 20))) {
    i -= onehour

    const filename = filepath(new Date(i))
    if (await exists(filename)) {
      Object.assign(seen, await load(filename))
      console.log('seen has loaded', Object.keys(seen).length)
      continue
    }

    let repos
    try {
      repos = await getLanguages.getRepos(i)
    } catch (e) {
      if (e.statusCode === 404) {
        console.log(i, 'not available')
        continue
      }
      throw e
    }

    const results = [{}]
    const _repos = Array.from(repos)

    for (let repo of _repos) {
      if (seen[repo]) {
        results[0][repo] = seen[repo]
        repos.delete(repo)
      }
    }

    repos = Array.from(repos)

    while (repos.length) {
      results.push(await getLanguages.query(repos.splice(0, 100)))
      console.log(repos.length, 'remaining for', i)
    }
    const hourData = Object.assign(...results)
    await brotli(Buffer.from(JSON.stringify(hourData)), filepath(new Date(i)))
    Object.assign(seen, hourData)
  }
}

action()
