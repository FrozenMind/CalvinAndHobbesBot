var request = require("request");
var cheerio = require("cheerio");
var TelegramBot = require('node-telegram-bot-api');
var fs = require('fs');
var bot;
var users = [];
var token;
var inter;

readUsers();
initBot();
startInterval();

//initialite telegram bot
function initBot() {
  bot = new TelegramBot(process.env.CAH_BOT, { //token is read from environment
    polling: true
  });
  bot.on('message', (msg) => {
    switch (msg.text.split(' ')[0]) {
      case "time": //sets the time the user want to receive the img
        //save user with time to config file
        var save = msg.chat.id + "_" + msg.text.replace(/\s+/g, '').replace('time', '') + "\n";
        //add to file
        fs.appendFile(__dirname + '/user.config', save, function(err) {
          if (err) {
            console.log(err);
          } else {
            // done
          }
        });
        //read user again
        readUsers();
        break;
    }
    console.log(msg.chat.id);
  });
}

//get image by date
function getImage(date, id) {
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var day = date.getDate();

  request({
    uri: "http://www.gocomics.com/calvinandhobbes/" + year + "/" + month + "/" + day,
  }, function(error, response, body) {
    var $ = cheerio.load(body);

    $('img').each(function(i, ele) {
      var link = $(this).attr('src');
      if (link.startsWith('http://assets')) {
        console.log(link);
        sendImg(id, link);
      }
    });
  });
}

//send Img to user
function sendImg(id, url) {
  bot.sendPhoto(id, url);
}

function readUsers() {
  users = [];
  fs.readFile(__dirname + '/user.config', (err, data) => {
    if (!err) {
      lines = data.toString().split('\n');
      for (i = 0; i < lines.length; i++) {
        if (lines[i] != "") {
          cline = lines[i].split('_')
          users.push({
            id: cline[0],
            time: parseInt(cline[1])
          });
        }
      }
    } else {
      console.log("err");
    }
    console.log(users);
  });
}

//check everyHour if a user wants a pic
function startInterval() {
  inter = setInterval(function() {
    var d = new Date();
    for (i = 0; i < users.length; i++) {
      if (users[i].time == d.getHours())
        getImage(d, users[i].id)
    }
  }, 3600000); //3600000 = 1 hour
}
