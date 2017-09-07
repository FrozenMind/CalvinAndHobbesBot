var request = require("request")
var cheerio = require("cheerio")
var TelegramBot = require('node-telegram-bot-api')
var fs = require('fs')
var bot
var users = [] //user array
var inter //interval to check if pic needs to be send

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
var welcomeMessage = "Welcome to my Calvin and Hobbes bot.\n" +
  "I hope you enjoy the comics. Type '/help' to get started."
var helpMessage = "Help Area:\n" +
  "/time hh:mm -> set the time you want to receive the bot. (24h) -> i.e. '/time 18:25' to receive the daily comic at 18:25\n" +
  "/stop -> to stop the bot\n" +
  "/restart -> to restart the bot with your old time"


//initialize telegram bot
function initBot(callback) {
  //read token out of file
  var token = fs.readFileSync(__dirname + '/telegramToken.config').toString().replace("\n", "")
  console.log(token)
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
    bot.sendMessage(msg.chat.id, "bot stopped");
  })
  //restart the bot
  bot.onText(/\/restart/, (msg) => {
    bot.sendMessage(msg.chat.id, "bot restarted");
  })
  //set the time for the user
  bot.onText(/\/time (.+)/, (msg, match) => {
    //check if user exist
    var userFound = false
    //get the time out of the message
    var newTime = match[1]
    for (var u = 0; u < users.length; u++) {
      //if user found update his time
      if (users[u].id == msg.chat.id) {
        userFound = true
        users[u].time = newTime
        console.log("update time for " + msg.chat.id + " to " + newTime)
      }
    }
    //if user not found in array, add new one
    if (!userFound) {
      var newUser = {
        id: msg.chat.id,
        time: newTime
      }
      users.push(newUser)
      console.log("added new user: " + JSON.stringify(newUser))
    }
    bot.sendMessage(msg.chat.id, "time set to: " + newTime)
    //update user file
    fs.writeFileSync(__dirname + '/user_config.json', JSON.stringify(users))
  })

  //set up done, so run callback
  callback()
}

//get image for the current day and send it to the user
function sendImage(date, id) {
  var year = date.getFullYear()
  var month = date.getMonth() + 1
  var day = date.getDate()
  //load the page
  request({
    uri: "http://www.gocomics.com/calvinandhobbes/" + year + "/" + month + "/" + day,
  }, function(error, response, body) {
    var $ = cheerio.load(body)
    //get the picture
    var pictureUrl = $('.comic__image img').attr('src')
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
//TODO: check every min, so its to 1 minute exactly, and find a way to save if user got the picture already today.
function startInterval(callback) {
  inter = setInterval(function() {
    var d = new Date()
    for (i = 0; i < users.length; i++) {
      if (users[i].time == d.getHours())
        sendImage(d, users[i].id)
    }
  }, 3600000) //3600000 = 1 hour
  callback() //done, so run callback
}
