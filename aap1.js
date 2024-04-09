const express = require('express')
const app = express()
app.use(express.json())
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const path = require('path')
const dbPath = path.join(__dirname, 'twitterClone.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running at http:/localhost:3000/')
    })
  } catch (e) {
    console.log(e.message)
  }
}

initializeDBAndServer()

const getFollowingPeopleIdsOfUser = async username => {
  const getTheFollowingPeopleQuery = `Select following_user_id from follower
  inner join on user.user_id=follower.follower_user_id
  where user.username='${username}';`
  const followingPeople = await db.all(getTheFollowingPeopleQuery)
  const arrayOfIds = followingPeople.map(each => each.following_user_id)
  return arrayOfIds
}

//middleware Function
const jwtVerifyFun = (request, response, next) => {
  let jwtVar
  const authHeader = request.headers['authorization']
  if (authHeader) {
    jwtVar = authHeader.split(' ')[1]
  }
  if (jwtVar === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtVar, 'mySecretKey', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

//Tweet Access Verification
const tweetAccessVerification = async (request, response, next) => {
  const {userId} = request
  const {tweetId} = request.params
  const getTweetQuery = `SELECT  * FROM tweet INNER JOIN follower 
  ON tweet.user_id=follower.following_user_id
  WHERE tweet.tweet_id='${tweetId}' AND follower_user_id='${userId}';`
  const tweet = await db.get(getTweetQuery)
  if (tweet === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    next()
  }
}

const arrayUserIdGet = async userNum => {
  const anstry = `SELECT * from follower;
  WHERE follower_user_id=${userNum};`
  console.log(anstry)
  const getQuery = await db.all(anstry)
  console.log(getQuery)
  const ArrayOfUsers = getQuery.map(each => each.follower_id)
  console.log(ArrayOfUsers)
  return ArrayOfUsers
}
app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const getUserQuery = `SELECT * FROM user WHERE username='${username}'`
  const hashedPassword = await bcrypt.hash(password, 10)
  const getUser = await db.get(getUserQuery)
  if (getUser !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const createUserQuery = `INSERT INTO user(username, password, name,gender)
      VALUES('${username}','${hashedPassword}','${name}','${gender}')`
      await db.run(createUserQuery)
      response.send('User created successfully')
    }
  }
})

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const getUserQuery = `SELECT * FROM user WHERE username='${username}'`
  const getUser = await db.get(getUserQuery)
  if (getUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, getUser.password)
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'mySecretKey')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const tweetResponse = dbObject => ({
  username: dbObject.username,
  tweet: dbObject.tweet,
  dateTime: dbObject.date_time,
})

app.get('/user/tweets/feed/', jwtVerifyFun, async (request, response) => {
  const {username} = request
  const followingPeopleIds = await getFollowingPeopleIdsOfUser(username)
  console.log(userNum)
  const getTweetQuery = `SELECT username,tweet,date_time AS 
  dateTime FROM user INNER JOIN tweet ON 
  user.user_id=tweet.user_id 
  WHERE user.user_id=tweet.user_id
  ORDER BY date_time DESC
  limit 4`
  const QueryResponse = await db.all(getTweetQuery)

  console.log(QueryResponse)
  response.send(QueryResponse)
})

app.get('/user/following/', jwtVerifyFun, async (request, response) => {
  const {username, userId} = request
  const getQuery = `SELECT * from follower
 inner join user on user.user_id=follower.following_user_id
  where user.user_id='${userId}';
  `
  const QueryResponse = await db.all(getQuery)
  response.send(QueryResponse)
})

app.get('/user/followers/', jwtVerifyFun, async (request, response) => {
  const {userId, username} = request
  const getQuery = `SELECT DISTINCT name from follower
 inner join user on user.user_id=follower.follower_user_id
  where following_user_id='${userId}'
  `
  const QueryResponse = await db.all(getQuery)
  response.send(QueryResponse)
})

//6
app.get(
  '/tweets/:tweetId/',
  jwtVerifyFun,
  tweetAccessVerification,
  async (request, response) => {
    const {username, userId} = request
    const {tweetId} = request.params
    const getQuery = `SELECT tweet,(select COUNT() FROM like where tweet_id='${tweetId}') AS likes,
  (select count() FROM reply WHERE tweet_id='${tweetId}') AS replies,
  date_time as dateTime
  FROM tweet
  WHERE tweet_id='${tweetId}';`
    const tweet = await db.get(getQuery)
    response.send(tweet)
  },
)

//7
app.get(
  '/tweets/:tweetId/likes/',
  jwtVerifyFun,
  tweetAccessVerification,
  async (request, response) => {
    const {tweetId} = request.params
    const getQuery = `SELECT username from user inner join like on user.user_id=like.user_id
  WHERE tweet_id='${tweetId}';`
    const tweet = await db.all(getQuery)
    const userArr = tweet.map(each => each.username)
    response.send({likes: userArr})
  },
)

//8
app.get(
  '/tweets/:tweetId/replies/',
  jwtVerifyFun,
  tweetAccessVerification,
  async (request, response) => {
    const {tweetId} = request.params
    const getQuery = `SELECT name,reply from user inner join reply on user.user_id=reply.user_id
  WHERE tweet_id='${tweetId}';`
    const tweet = await db.all(getQuery)
    response.send({replies: tweet})
  },
)

//9
app.get(
  '/user/tweets/',
  jwtVerifyFun,
  tweetAccessVerification,
  async (request, response) => {
    const {username, userId} = request
    const {tweetId} = request.params
    const getQuery = `SELECT tweet,COUNT(DISTINC like_id) AS likes,
  COUNT(DISTINCT reply_id) as replies, date_time as dateTime 
  FROM tweet LEFT JOIN reply On tweet.tweet_id=like.tweet_id
  WHERE tweet.user_id=${userId}
  GROUP BY tweet.tweet_id;`
    const tweet = await db.get(getQuery)
    response.send(tweet)
  },
)
//10
app.post('/user/tweets/', jwtVerifyFun, async (request, response) => {
  const {tweet} = request.body
  const userId = parseInt(request.userId)
  const dateTime = new Date().toJSON().substring(0, 19).replace('T', ' ')
  const createTweetQuery = `INSERT INTO tweet(tweet,user_id,date_time)
  VALUES('${tweet}','${userId}','${dateTime}');`
  await db.run(createTweetQuery)
  response.send('Created a Tweet')
})

//11
app.delete('/tweets/:tweetId/', jwtVerifyFun, async (request, response) => {
  const {tweetId} = request.params
  const {userId} = request
  const getTheTweetQuery = `SELECT * FROM tweet WHERE user_id='${userId}' AND 
tweet_id='${tweetId}';`
  const tweet = await db.get(getTheTweetQuery)
  if (tweet === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id='${tweetId}';`
    await db.run(deleteTweetQuery)
    reponse.send('Tweet Removed')
  }
})
module.exports = app
