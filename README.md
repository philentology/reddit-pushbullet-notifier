# reddit-pushbullet-notifier
Used to notify you of new posts on Reddit that match a subreddit and post title. 

When matches are found, they are posted to all devices in your pushbullet account.

The goal of this project was to act like saved searches for marketplaces, but can be used to notify you of other new posts that match your search.

## Requirements
* NodeJS (https://nodejs.org/en/)
* Pushbullet Account
  * Pushbullet Access Token (https://www.pushbullet.com/#settings)
* Reddit API Access (https://www.reddit.com/prefs/apps)
  * Create an Application
    * Name: whatever you want to call it
    * Type: script
    * Redirect URL: http://127.0.0.1
  * Copy your Client ID (under the App name once its saved) and Secret for use in the `.env` file.

## Installation
1. Install Node Modules:
```
yarn install
```

```
npm install
```
2. Create an `.env` file and add your Pushbullet Access token:
```
PUSHBULLET_ACCESS_TOKEN=your_pushbullet_api_key
REDDIT_USERNAME=your_reddit_username
REDDIT_PASSWORD=your_reddit_password
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_SECRET=your_reddit_secret
```

## Options
| Options | Field       | Description                                                                                     | Required |
| ------- | ----------- | ----------------------------------------------------------------------------------------------- | -------- |
| `-s`    | Subreddit   | Subreddit you want to match within.                                                             | X        |
| `-p`    | Posts       | Post title you want to match against. Required if no Have or Want args are present. Should be used instead of those if you want to search the entire string or in conjunction with. Really, go wild. Use a comma separated list to search for multiple items. |          |
| `-h`    | Have        | [H] marketplace post title you want to match against. Required if no Post or Want args are present. Use a comma separated list to search for multiple items. |          |
| `-w`    | Want        | [W] marketplace post title you want to match against. Required if no Post or Have args are present. Use a comma separated list to search for multiple items. |          | Zealios |
| `-c`    | Country     | Country or countries you want to limit posts to. If provided, the country code must be present in the title, ie. "US-CA". Use a comma separated list to search for multiple countries. |          |
| `-i`    | Interval    | Interval in seconds that script checks for new posts. Minimum is 1.                                        |          |

## Examples

From within the root of the project:

```
node index.js -s mechmarket -h "RAMA M60-A"
```

```
node index.js -s hardwareswap -w "RTX 2080ti" -i 30
```

```
node index.js -s aquariums -p "Living plants"
```

```
node index.js -s mechmarket -h "RAMA M60-a, Tofu HHKB, Tokyo60" -c "US, CA" -i 1
```

## Exit
Good 'ol `ctrl + c`.

## Issues
* Sometimes the Reddit API will respond with an HTML error page instead of JSON causing Request to fail. It does not properly exit and will repeat the error until you quit.
* Need to handle Reddit API errors better