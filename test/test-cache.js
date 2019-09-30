const filename = '2019/09/01/2019-09-01-0.json.br'
const { brotliDecompressSync } = require('zlib')
const { readFileSync } = require('fs')
const buffer = brotliDecompressSync(readFileSync(filename))
const obj = JSON.parse(buffer.toString())
const assert = require('assert')

const run = async (force) => {
  const cache = require('../lib/cache')()
  await cache.add(filename, obj)
  await cache.add(filename, obj, force)
  let keys = ['nope'].concat(Object.keys(obj))
  let results = await cache.get(keys)
  assert.ok(typeof results['nope'] === 'undefined')
  for (const [k, v] of Object.entries(results)) {
    assert.deepEqual(obj[k], v)
  }
}

run(true)
run(false)
