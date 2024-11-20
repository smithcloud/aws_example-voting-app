var express = require('express'),
    async = require('async'),
    { Pool } = require('pg'),
    cookieParser = require('cookie-parser'),
    fs = require('fs'), 
    app = express(),
    server = require('http').Server(app),
    io = require('socket.io')(server);

var port = process.env.PORT || 4000;

const dbConfig = {
  user: 'postgres',
  host: 'postgres-15.c6melj87hlc4.ap-northeast-2.rds.amazonaws.com',
  database: 'postgres',
  password: 'postgres',
  port: 5432,
  ssl: {
    require: true,
    rejectUnauthorized: true,
    ca: fs.readFileSync('./ap-northeast-2-bundle.pem').toString(),
  }
};

var pool = new Pool(dbConfig);

io.on('connection', function (socket) {
  socket.emit('message', { text: 'Welcome!' });

  socket.on('subscribe', function (data) {
    socket.join(data.channel);
  });
});

async.retry(
  { times: 1000, interval: 1000 },
  function (callback) {
    pool.connect(function (err, client, done) {
      if (err) {
        console.error("DB Connection Error:", err.message); 
        return callback(err, null);
      }
      callback(null, client);
    });
  },
  function (err, client) {
    if (err) {
      return console.error("Giving up");
    }
    console.log("Connected to db");
    getVotes(client);
  }
);

function getVotes(client) {
  client.query('SELECT vote, COUNT(id) AS count FROM votes GROUP BY vote', [], function (err, result) {
    if (err) {
      console.error("Error performing query: " + err);
    } else {
      var votes = collectVotesFromResult(result);
      io.sockets.emit("scores", JSON.stringify(votes));
    }

    setTimeout(function () { getVotes(client) }, 1000);
  });
}

function collectVotesFromResult(result) {
  var votes = { a: 0, b: 0 };

  result.rows.forEach(function (row) {
    votes[row.vote] = parseInt(row.count);
  });

  return votes;
}

app.use(cookieParser());
app.use(express.urlencoded());
app.use(express.static(__dirname + '/views'));

app.get('/', function (req, res) {
  res.sendFile(path.resolve(__dirname + '/views/index.html'));
});

server.listen(port, function () {
  var port = server.address().port;
  console.log('App running on port ' + port);
});
