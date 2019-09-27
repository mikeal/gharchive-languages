const fs = require('fs')
const pull = require('pull-gharchive-minimized')
const { graphql } = require('@octokit/graphql')
const { inspect } = require('util')

const sleep = i => new Promise(resolve => setTimeout(resolve, i))

const sum = (x, y) => x + y

const query = async repos => {
  const qs = repos.map(r => `repo:${r}`).join(' ')
  const response = await graphql(
    `{ 
      search(query: "${qs} fork:true", type: REPOSITORY, first: 100) {
        repositoryCount
        nodes {
          ... on Repository {
            nameWithOwner
            languages (first: 100) {
              edges {
                node {
                  name
                }
                size
              }
            }
          }
        }
      }
      rateLimit {
        limit
        cost
        remaining
        resetAt
      }
    }
    `,
    {
      headers: {
        authorization: `token ${process.env.GHTOKEN || process.env.GITHUB_TOKEN}`
      }
    }
  )

  const { remaining, cost, resetAt } = response.rateLimit
  if ((remaining - cost) < 0) {
    console.log('sleeping')
    await sleep(((new Date(resetAt)).getTime() - Date.now()) + 1000)
  }
  // console.log(response.rateLimit)
  const results = {}

  const nodes = response.search.nodes
  for (const node of nodes) {
    const total = node.languages.edges.map(e => e.size).reduce(sum, 0)
    const value = {}
    for (const edge of node.languages.edges) {
      value[edge.node.name] = parseFloat((edge.size / total).toFixed(2))
      if (!value[edge.node.name]) delete value[edge.node.name]
    }
    results[node.nameWithOwner] = value
  }
  // console.log(inspect(nodes, { depth: Infinity }))
  return results
}

const getRepos = async hour => {
  hour = new Date(hour)
  let repos = new Set()
  for await (const event of pull(hour)) {
    repos.add(event.repo)
  }
  return repos
}

const getLanguages = async hour => {
  const repos = Array.from(await getRepos(hour))
  const results = []
  while (repos.length) {
    results.push(await query(repos.splice(0, 100)))
    console.log(repos.length, 'remaining for', hour)
  }
  return Object.assign({}, ...results)
}

module.exports = getLanguages
module.exports.getRepos = getRepos
module.exports.query = query

