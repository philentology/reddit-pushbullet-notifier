#!/usr/bin/env node
require('dotenv').config()
const args = require('args')
const moment = require('moment')
const pushbullet = require('pushbullet')
const pusher = new pushbullet(process.env.PUSHBULLET_ACCESS_TOKEN)
const bent = require('bent')
const form_urlencoded = require('form-urlencoded')

const REDDIT_USERNAME = process.env.REDDIT_USERNAME
const REDDIT_PASSWORD = process.env.REDDIT_PASSWORD
const REDDIT_CLIENT_ID = process.env.REDDIT_CLIENT_ID
const REDDIT_SECRET = process.env.REDDIT_SECRET
const USER_AGENT = 'nodejs:search.pushbullet.notifier.for reddit:1.0'

const REDDIT_API = 'https://oauth.reddit.com'
const REDDIT_OAUTH = 'www.reddit.com/api/v1/access_token'

var SESSSION = {}

// config of args and defaults
args
  .option('subreddit', 'String - Subreddit you want to match within.')
  .option('post', 'String - Post title you want to match against. Required if no Have or Want args are present. Should be used instead of those if you want to search the entire string or in conjunction with. Really, go wild.')
  .option('have', 'String -[H] marketplace post title you want to match against. Required if no Post or Want args are present.')
  .option('want', 'String - [W] marketplace post title you want to match against. Required if no Post or Have args are present.')
  .option('interval', 'Number - Interval in seconds that script checks for new posts. Minimum is 1.')

const flags = args.parse(process.argv)
const config = {
  subreddit: '',
  post: '',
  have: '',
  want: '',
  interval: 5
}

/**
 * Validates passed in args
 * @returns {boolean}
 * TODO: verify subreddit exists
 */
const validateArgs = async () => {
  let valid = {
    subreddit: false,
    post: false,
    post_array: false,
    interval: false
  }

  if(typeof flags.subreddit === 'string') {
    // use /new.rss to get the latest
    // let subreddit = `https://reddit.com/r/${flags.subreddit}/new`
    valid.subreddit = true
    config.subreddit = flags.subreddit
  }

  // match inputs
  if(typeof flags.post === 'string') {
    valid.post = true
    config.post = flags.post.split(',')
  }

  if(typeof flags.have === 'string') {
    valid.have = true
    config.have = flags.have.split(',')
  }

  if(typeof flags.want === 'string') {
    valid.want = true
    config.want = flags.want.split(',')
  }

  if(typeof flags.interval === 'undefined' || (typeof flags.interval === 'number' && flags.interval >= 1)) {
    valid.interval = true
    if(typeof flags.interval !== 'undefined') {
      config.interval = flags.interval
    }
  }

  // check for all required params
  return valid.subreddit && valid.interval && (valid.post || valid.have || valid.want)
}

/**
 * Takes array of title matches and compares with title to look for matches
 * @param {array} title_matches 
 * @param {string} title
 * @returns {boolean}
 */
const matchTitles = (title_matches, title) => {
  var matches = false
  let i = 0
  do {
    matches = title.indexOf(title_matches[i].toLowerCase().trim()) !== -1
    if(matches) {
      break
    } 
    i++
  } while (i < title_matches.length)
  return matches
}

/**
 * Checks the incoming title against all possible match queries
 * @param {string} title 
 * @returns {boolean}
 */
const findMatch = (title) => {
  title = title.toLowerCase()
  var matches = false

  if(config.post) {
    matches = matchTitles(config.post, title)
  }

  if(config.have || config.want) {
    // forums that use [H] [W] title formats should create two array strings for which we can search
    var split_title = title.split('[w]')

    if(config.have) {
      matches = matchTitles(config.have, split_title[0])
    }

    if(config.want && split_title[1]) {
      matches = matchTitles(config.want, split_title[1])
    }

  }

  return matches
}

/**
 * Searches Reddit Posts to look for matches against config
 * @param {array} posts 
 * @returns {array} matches 
 */
const searchPostsForMatches = (posts, current_utc_ms) => {
  var matches = []
  var i = 0
  // for each post
  do {
    // if time is within interval (time the update check started minus interval must be less than the post time)
    if(posts[i].data) {
      var post_utc_ms = posts[i].data.created_utc * 1000
      var interval_ms =  config.interval * 1000
      var within_interval = post_utc_ms >= (current_utc_ms - interval_ms)
      if(within_interval) {
        if(findMatch(posts[i].data.title)) {
          matches.push({
            title: posts[i].data.title,
            url: `https://www.reddit.com${posts[i].data.permalink}`
          })
        }
      }
    } else {
      console.error('Invalid Post: ', posts[i])
    }
    i++
  } while (i < posts.length)

  return matches
}

/**
 * Sends Pushbullet links to all devices
 * TODO: allow user to provde device ID(s)
 * @param {array} matches 
 */
const sendBullets = async (matches) => {
  let i = 0
  do {
    try {
      await pusher.link({}, matches[i].title, matches[i].url)
      i++
    } catch(error) {
      console.error(new Error(error))
    }
  } while (i < matches.length)
}


/**
 * Uses the Reddit API to list posts
 * @returns {array} posts
 */
const getRedditPosts = async () => {
  try {
    const bent_reddit = bent(REDDIT_API, 'GET', 'json', 200, {
      'User-Agent': USER_AGENT,
      'Authorization': `${SESSION.token_type} ${SESSION.access_token}`,
      'Accept': 'application/json'
    })
    const endpoint = `/r/${config.subreddit}/new`
    const posts = await bent_reddit(endpoint)
    if(posts.error) {
      console.error(posts.error)
    } else {
      return posts.data.children || []
    }
  } catch(error) {
    throw new Error(error)
  }
}

/**
 * Downloads RSS, checks for updates, and sends Pushbullet Notifications
 * Does NOT alert user of attempts with no matches
 */
const checkForUpdates = async () => {
  try {
    var current_utc_ms = moment().utc().valueOf()
    var posts = await getRedditPosts()
    if(posts.length) {
      var matches = searchPostsForMatches(posts, current_utc_ms)
      if(matches.length) {
        sendBullets(matches)
      }
    }
  } catch(error) {
    console.error(error)
  }
}

/**
 *  Set session data
 * @param {objet} session 
 */
const setSession = (session) => {
  SESSION = session
}

/**
 * Initial auth token generation
 * Kills script if it doesn't authenticate
 */
const generateRedditAuthToken = async () => {
  try {

    const post_body_str = form_urlencoded.default({
      grant_type: 'password',
      password: REDDIT_PASSWORD,
      username: REDDIT_USERNAME
    })

    const uri = `https://${REDDIT_CLIENT_ID}:${REDDIT_SECRET}@${REDDIT_OAUTH}`

    const reddit_post = bent('POST', 'json', {
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    })

    const reddit_response = await reddit_post(uri, post_body_str)

    if(reddit_response.error) {
      throw new Error(reddit_response.error)
    } else {
      setSession(reddit_response)
    }
  } catch(error) {
    throw new Error(error)
  }
}

/**
 * Main function
 */
const run = async () => {
  await generateRedditAuthToken()

  // check once and then let the interval take over
  checkForUpdates()

  setInterval(function (){
    checkForUpdates()
  }, config.interval * 1000)
} 

/**
 * Fires script if required args are present
 */
if(!validateArgs()) {
  args.showHelp()
  process.exit(1)
} else {
  run()
}