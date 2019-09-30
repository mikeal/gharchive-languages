const level = require('level')
const tmp = require('tempy')

const multiget = async (db, keys) => {
  const promises = keys.map(k => db.get(k).then(v => [k, v]).catch(() => false))
  const results = await Promise.all(promises)
  const ret = {}
  for (const x of results) {
    if (x) {
      let [key, value] = x
      if (typeof value === 'boolean' && value === true) value = null
      ret[key] = value
    }
  }
  return ret
}

class Cache {
  constructor (dir) {
    /* istanbul ignore else */
    if (!dir) {
      dir = tmp.directory()
    }
    this.db = level(dir, { valueEncoding: 'json' })
  }

  async add (filename, results, force = false) {
    if (!force) {
      if (await this.loaded(filename)) return true
    }
    const batch = this.db.batch()
    batch.put(`::cache:from:${filename}`, true)
    for (let [key, value] of Object.entries(results)) {
      if (value === null) value = true
      batch.put(key, value)
    }
    return batch.write()
  }

  loaded (filename) {
    return this.db.get(`::cache:from:${filename}`).catch(() => false)
  }

  get (keys) {
    return multiget(this.db, keys)
  }
}

module.exports = (...args) => new Cache(...args)
