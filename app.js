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

//follower id Array get Fun
const followingPeopleIdsOdUser = async username => {
  const getTheFollowingPeopleQuery = `SELECT user_id FROM user
WHERE username='${username}';`
  const followingPeopleArray = await db.get(getTheFollowingPeopleQuery)
  return followingPeopleArray
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
  const getTweetQuery = `SELECT * FROM tweet INNER JOIN follower
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
  const anstry = `SELECT * from follower inner join tweet on tweet.user_id=follower.follower_id;
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

const checkFun = async num => {
  const singleQuery = `select user.username,tweet.tweet,tweet.date_time as dateTime from tweet inner join user
    on user.user_id=tweet.user_id
    where user.user_id=${num};`
  const getQuery = await db.get(singleQuery)
  return getQuery
}

const tweetResponse = dbObject => ({
  username: dbObject.username,
  tweet: dbObject.tweet,
  dateTime: dbObject.date_time,
})
/*

    INNER JOIN follower
    ON tweet.user_id=follower.following_user_id
    WHERE tweet.tweet_id='${tweetId}' AND follower_user_id='${userId}';

    // user tweets api
    app.get('/user/tweets/feed/', jwtVerifyFun, async (request, response) => {
    const latestTweets = await db.all(`

    select
    tweet.tweet_id,
    tweet.user_id,
    user.username,
    tweet.tweet,
    tweet.date_time
    from
    follower
    left join tweet on tweet.user_id = follower.following_user_id
    left join user on follower.following_user_id= user.user_id
    where follower.follower_user_id= (select user_id from user where username = "${request.username}")
    order by tweet.date_time desc
    limit 4;
    `)
    response.send(latestTweets.map(item => tweetResponse(item)))
    })
    //sime corr

    app.get('/user/tweets/feed/', jwtVerifyFun, async (request, response) => {
    const {user_id, username} = request
    const followingPeopleArray = await followingPeopleIdsOdUser(username)
    const userNum = followingPeopleArray.user_id
    console.log(userNum)
    const arrayList = await arrayUserIdGet(userNum)
    console.log(arrayList)
    const followQuery = `SELECT * from follower
    where follower_user_id=${userNum}
    ;`;
    const QueryResponse = await db.all(followQuery)

    console.log(QueryResponse)
    response.send(QueryResponse)
    })


    app.get('/user/tweets/feed/', jwtVerifyFun, async (request, response) => {
    const {payload} = request
    const {username, userId} = payload
    console.log(username)
    const followingPeopleArray = await followingPeopleIdsOdUser(username)
    console.log(followingPeopleArray)
    const getQuery = `SELECT username,tweet,date_time AS
    dateTime FROM follower INNER JOIN tweet ON
    follower.following_user_id=tweet.user_id INNER JOIN user ON
    user.user_id=follower.following_user_id
    WHERE follower.follower_user_id=${userId};
    ORDER BY date_time DESC
    limit 4
    ;`
    const QueryResponse = await db.all(getQuery)

    ELECT user.username,tweet.tweet from follower inner join tweet
    on tweet.user_id=follower.follower_id inner join user on user.user_id=follower.follower_user_id;
    where follower_user_id=${userNum}
    response.send(QueryResponse)
    })

    */
app.get('/user/tweets/feed/', jwtVerifyFun, async (request, response) => {
  const {username} = request
  const followingPeopleArray = await followingPeopleIdsOdUser(username)
  const userNum = followingPeopleArray.user_id
  console.log(userNum)
  const followQuery = `SELECT user.username,tweet.tweet,tweet.date_time as dateTime from follower 
  inner join tweet on tweet.user_id=follower.follower_id inner join user
  on user.user_id=tweet.user_id
    where follower_user_id=${userNum}
    order by dateTime desc
    limit 4;`
  const QueryResponse = await db.all(followQuery)
  console.log(QueryResponse)
  //const ArrayOfUsers = QueryResponse.map(each => each.follower_id)
  //const lostPatience = QueryResponse.map(each => checkFun(each.follower_id))
  //response.send(ArrayOfUsers)
  response.send(QueryResponse)
})

app.get('/user/following/', jwtVerifyFun, async (request, response) => {
  const {username} = request
  const followingPeopleArray = await followingPeopleIdsOdUser(username)
  const userNum = followingPeopleArray.user_id
  console.log(userNum)
  const followQuery = `SELECT user.username from follower 
  inner join user
  on user.user_id=follower.follower_id
    where follower.following_user_id=${userNum};`
  const QueryResponse = await db.all(followQuery)
  console.log(QueryResponse)
  //const ArrayOfUsers = QueryResponse.map(each => each.follower_id)
  //const lostPatience = QueryResponse.map(each => checkFun(each.follower_id))
  //response.send(ArrayOfUsers)
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
