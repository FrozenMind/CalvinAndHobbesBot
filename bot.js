var request = require("request")
var cheerio = require("cheerio")
var TelegramBot = require('node-telegram-bot-api')
var fs = require('fs')
var bot
var users = [] //user array
var token //telegram bot api token
var inter //interval to check if pic needs to be send

//read users, init bot & start interval with callbacks, cause of sync file readers
readUsers(function(){
  console.log("users loaded")
  initBot(function(){
    console.log("bot initialized")
    startInterval(function(){
      console.log("interval started. enjoy the bot")
    })
  })
})

//initialite telegram bot
function initBot(callback) {
  //read token out of file
  bot = new TelegramBot(fs.readFileSync(__dirname + '/telegramToken.config').toString(), {
    polling: true
  })
  bot.on('message', (msg) => {
    switch (msg.text.split(' ')[0]) {
      case "time": //sets the time the user want to receive the img
        //check if user exist
        var userFound = false
        //get the time out of the message
        var newTime = msg.text.replace(/\s+/g, '').replace('time', '')
        for(var u = 0; u < users.length; u++){
          //if user found update his time
          if(users[u].id == msg.chat.id){
            userFound = true            
            users[u].time = newTime
            console.log("update time for " + msg.chat.id + " to " + newTime)
          }
        }
        //if user not found in array, add new one
        if(!userFound){
          var newUser = {
            id: msg.chat.id,
            time: newTime
          }
          users.push(newUser)
          console.log("added new user: " + JSON.stringify(newUser))
        }
        //update user file
        fs.writeFileSync(__dirname + '/user_config.json', JSON.stringify(users))
        break
    }
  })
  callback() //done, so run callback
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
