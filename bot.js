var request = require("request")
var cheerio = require("cheerio")
var TelegramBot = require('node-telegram-bot-api')
var fs = require('fs')
var bot
var users = [] //user array
var inter //interval to check if pic needs to be send
var sendPics = [] //cache which user received a pic in the last 3 min

//read users, init bot & start interval with callbacks, cause of sync file readers
readUsers(function() {
  console.log("users loaded")
  initBot(function() {
    console.log("bot initialized")
    startInterval(function() {
      console.log("interval started. enjoy the bot")
    })
  })
})

//some messages
var botVersion = "CalvinAndHobbesBot\n\n" +
  "Author: FrozenMind\n" +
  "Version: 0.1.4 (alpha)\n" +
  "Last update: 08/09/2017\n\n" +
  "Changelog\n\n" +
  "* add /dailycomic to receive daily comic now\n" +
  "* add /randomcomic to receive a random comic\n" +
  "* some security functions\n" +
  "\nGithub repo: https://github.com/FrozenMind/CalvinAndHobbesBot"
var welcomeMessage = "Welcome to my Calvin and Hobbes bot (alpha).\n\n" +
  "This bot send you everyday to your favorite time a daily Calvin and Hobbes comic.\n" +
  "I hope you enjoy them. Type '/help' to get started."
var helpMessage = "Help Area:\n\n" +
  "/time hh:mm -> set the time you want to receive the comic. (24h)\n-> i.e. '/time 18:25' to receive the daily comic at 18:25\n" +
  "/dailycomic -> sends you the daily comic\n" +
  "/randomcomic -> sends you a random comic\n" +
  "/stop -> to stop the bot\n" +
  "/restart -> to restart the bot with your old time. use '/time' to set a new one\n" +
  "/status -> get your time and if your bot active or not\n" +
  "/version -> to get the bot version"

//initialize telegram bot
function initBot(callback) {
  //read token out of file
  let token = fs.readFileSync(__dirname + '/telegramToken.config').toString().replace("\n", "")
  bot = new TelegramBot(token, {
    polling: true
  })
  //bot commands
  //display start message
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, welcomeMessage);
  })
  //display help message
  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, helpMessage);
  })
  //stop the bot
  bot.onText(/\/stop/, (msg) => {
    updateUser(msg.chat.id, false)
    bot.sendMessage(msg.chat.id, "bot stopped");
  })
  //restart the bot
  bot.onText(/\/restart/, (msg) => {
    updateUser(msg.chat.id, true)
    bot.sendMessage(msg.chat.id, "bot restarted");
  })
  //set the time for the user
  bot.onText(/\/time (.+)/, (msg, match) => {
    if (match[1] && match[1].match(/([0-1]?[0-9]|2[0-3]):[0-5][0-9]/)) //check if time has write format
      updateUser(msg.chat.id, true, match[1])
    else
      bot.sendMessage(msg.chat.id, "Please use format /time 'hh:mm'")
  })
  //set the time for the user
  bot.onText(/\/status/, (msg) => {
    //find user
    for (let u = 0; u < users.length; u++) {
      if (users[u].id == msg.chat.id)
        bot.sendMessage(msg.chat.id, "your time is set to " + users[u].hour + ":" + users[u].min + " and your bot is " + (users[u].active ? "active" : "inactive"))
    }
  })
  //check the bot version
  bot.onText(/\/version/, (msg) => {
    bot.sendMessage(msg.chat.id, botVersion)
  })
  //send daily comic now
  bot.onText(/\/dailycomic/, (msg) => {
    sendImage(new Date(), msg.chat.id)
  })
  //send daily comic now
  bot.onText(/\/randomcomic/, (msg) => {
    let randomDate = new Date()
    let y, m, d
    let loopCounter = 0 //checks that loop is not infinite
    let lastWeDate = new Date(randomDate.getFullYear() + "-" + (randomDate.getMonth() + 1) + "-" + (randomDate.getDate() - 7))
    do {
      y = Math.floor(Math.random() * 2 + 2016)
      m = Math.floor(Math.random() * 12 + 1)
      d = Math.floor(Math.random() * 31 + 1)
      randomDate = new Date(y + "-" + m + "-" + d)

      loopCounter++
      if (loopCounter >= 100) //check that its no infinite loop
        break
    } while (randomDate >= lastWeDate) //random date needs to be older than 7 days

    if (loopCounter < 100) { //only if random date is found
      sendImage(randomDate, msg.chat.id)
    } else {
      bot.sendMessage(msg.chat.id, "something went wrong by getting a random image. Please try again. Sorry :(")
    }
  })

  //set up done, so run callback
  callback()
}

//get image for the current day and send it to the user
function sendImage(date, id) {
  let year = date.getFullYear()
  let month = date.getMonth() + 1
  let day = date.getDate()
  //load the page
  request({
    uri: "http://www.gocomics.com/calvinandhobbes/" + year + "/" + month + "/" + day,
  }, function(error, response, body) {
    let $ = cheerio.load(body)
    //get the picture
    let pictureUrl = $('.comic__image img').attr('src')
    console.log(pictureUrl)
    //send pic to user
    bot.sendPhoto(id, pictureUrl)
  })
}

//read users out of file and load to useres object
function readUsers(callback) {
  users = []
  users = JSON.parse(fs.readFileSync(__dirname + '/user_config.json'))
  console.log(users)
  callback() //done, so run callback
}

//check everyHour if a user wants a pic
function startInterval(callback) {
  inter = setInterval(function() {
    //remove every tick in sendPics object
    for (let t = sendPics.length - 1; t >= 0; t--) {
      sendPics[t].ticks--;
      if (sendPics[t].ticks < 0) //if ticks less 0 remove the cached user
        sendPics.splice(t)
    }
    let d = new Date()
    for (let i = 0; i < users.length; i++) {
      //hits if user active && minute is +- 1 of the set minute in the option
      if (users[i].active && users[i].hour == d.getHours() && (users[i].min >= d.getMinutes() - 1 && users[i].min <= d.getMinutes() + 1)) {
        //check if user is not in the sendPics arr, to be sure he didnt received the comic before
        if (sendPics.findIndex((o) => {
            return users[i].id == o.id
          }) != -1) {
          sendImage(d, users[i].id)
          sendPics.push({
            id: users[i].id,
            ticks: 5 //save it for 5 intervals
          })
        }
      }
    }
  }, 60000) //1 minute
  callback() //set up done, so run callback
}

function updateUser(id, active, time) {
  //TODO: use findIndex here
  let userFound = false
  //split time to hour and min
  let h, m
  if (time) {
    h = time.substring(0, time.indexOf(":"))
    m = time.substring(time.indexOf(":") + 1)
  }
  for (let u = 0; u < users.length; u++) {
    //if user found update his time
    if (users[u].id == id) {
      userFound = true
      users[u].active = active //update active value
      if (time) { //only if time is defined update it
        users[u].hour = h
        users[u].min = m
        console.log("update time for " + id + " to " + time)
        bot.sendMessage(id, "time set to " + time)
      }
    }
  }
  //if user not found in array, add new one
  if (time) { //add user only if time is defined
    if (!userFound) {
      let newUser = {
        id: id,
        hour: h,
        min: m,
        active: active
      }
      users.push(newUser)
      console.log("added new user: " + JSON.stringify(newUser))
      bot.sendMessage(id, "you were added.\n you will receive your first comic at " + time)
    }
  }
  //update user file
  fs.writeFileSync(__dirname + '/user_config.json', JSON.stringify(users))
}
