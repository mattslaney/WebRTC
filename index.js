const crypto = require("crypto");
const dotenv = require("dotenv");
const express = require("express");
const bodyParser = require('body-parser');
const cookieParser = require("cookie-parser");
const app = express();
const http = require("http");
const fs = require("fs");
const server = http.createServer(app);
const port = process.env.PORT || 3000;
const config = dotenv.config().parsed;

const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.json())
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(cookieParser());

let peerConfig = {};
try {
  const data = fs.readFileSync("config.json");
  peerConfig = JSON.parse(data);
} catch (err) {
  console.error("Error reading config file: ", err);
}

const generateTurnCredentials = (secret, ttl) => {
  const timestamp = Math.floor(Date.now() / 1000) + ttl;
  const userId = "turnuser";
  const userCombo = `${timestamp}:${userId}`;
  console.debug(`Generating password for ${userCombo}`);

  const hmac = crypto.createHmac("sha1", secret);
  hmac.setEncoding("base64");
  hmac.write(userCombo);
  hmac.end();

  const password = hmac.read();
  return [userCombo, password];
};

io.on("connection", (socket) => {
  socket.emit("welcome");
  console.debug("New connection: ", socket.id);

  socket.on("join", (code) => {
    if (!io.sockets.adapter.rooms.get(code)) {
      //First client - create
      socket.join(code);
      socket.emit("created", code);
      console.debug("First client: ", code);
    } else if (io.sockets.adapter.rooms.get(code).size === 1) {
      //Second client - join
      socket.join(code);
      socket.emit("joined", code);
      socket.to(code).emit("begin");
      console.debug("Second client: ", code);
    } else {
      //Room full - full
      socket.emit("full", code);
      socket.emit("welcome");
      console.debug("Room full: ", code);
    }
  });

  socket.on("leave", (code) => {
    console.debug(`${socket.id} left room: `, code);
    const rooms = Array.from(socket.rooms);
    rooms.forEach((room) => {
      socket.to(room).emit("bye");
    });
    socket.leave(code);
  });

  socket.on("describe", (sessionDesc) => {
    console.debug("SDP received of type: ", sessionDesc.type);
    socket.rooms.forEach((room) => {
      socket.to(room).emit("describe", sessionDesc);
    });
  });

  socket.on("candidate", (candidate) => {
    console.debug("Candidate received: ", candidate.candidate);
    socket.rooms.forEach((room) => {
      socket.to(room).emit("candidate", candidate);
    });
  });

  socket.on("test", () => {
    console.debug(`Received Test from ${socket.id}`);
    let rooms = socket.rooms;
    console.log(`${socket.id} is in rooms ${rooms.size}`);
    rooms.forEach((room) => {
      console.log(`Sending test to room ${room}`);
      socket.to(room).emit("test", "socket.to");
    });
    socket.broadcast.emit("test", "socket.broadcast");
  });

  socket.on("disconnecting", () => {
    console.log(`User ${socket.id} disconnected from rooms: `, socket.rooms);
    const rooms = Array.from(socket.rooms);

    rooms.forEach((room) => {
      socket.to(room).emit("bye");
    });
  });
});

const checkApiKey = (req, res, next) => {
  const expectedApiKey = config.SITE_PASSWORD;
  const providedApiKey = req.headers["api-key"];

  if (!providedApiKey || providedApiKey !== expectedApiKey) {
    return res.status(401).json({ message: "unauthorized" });
  }

  next();
};

const genCode = (size) =>
  [...Array(size)]
.map(() => Math.floor(Math.random() * 36).toString(36))
.join("")
.toUpperCase();

const validKeys = new Map();
const refreshKeys = () => {
  const currentTime = Math.floor(Date.now() / 1000);
  for (const [key, timestamp] of validKeys) {
    if (currentTime > timestamp) {
      console.log("Expired: ", key);
      validKeys.delete(key);
    }
  }
  if(validKeys.size === 0) {
    validKeys.set(genCode(8), Math.floor(Date.now() / 1000) + 600);
    console.log("Refreshed default key", validKeys);
  }
}
refreshKeys();
setInterval(refreshKeys, 60000);

const validKey = (key) => {
  return validKeys.get(key) 
    ? true
    : false
}

const getKeyTTL = (key) => {
  const now = Math.floor(Date.now()/1000);
  const keyExpiryTime = validKeys.get(key);
  const ttl = keyExpiryTime - now;
  console.debug(`key: ${key}, ttl: ${ttl}`);
  return ttl;
}

const checkKey = (req, res, next) => {
  // console.log({
  //   url: req.url,
  //   cookie: req.cookies.key,
  //   header: req.headers.key,
  //   query: req.query.key,
  //   body: req.body.key
  // })
  const providedKey = req.cookies.key || req.headers.key || req.query.key || req.body.key || undefined;
  if(!providedKey) {
    next(); 
    return;
  }

  console.log(providedKey);
  if (providedKey !== "undefined" && !validKey(providedKey) ) {
    console.debug("Invalid key, clearing cookie: ", providedKey);
    res.clearCookie("key");
  } else if (!req.cookies.key) {
    const ttl_ms = getKeyTTL(providedKey) * 1000;
    console.log("Key not in cookies yet, adding: ", providedKey);
    res.cookie("key", providedKey, { maxAge: ttl_ms, SameSite: "None" });
    res.locals.key = providedKey;
  } else {
    console.log("Key still valid: ", providedKey);
  }

  next();
};

app.post("/login", checkKey, (req, res) => {
  if(res.locals.key) res.redirect(`/index.html?key=${res.locals.key}`);
  else res.redirect("index.html");
});

app.put("/new", checkApiKey, (req, res) => {
  const newKey = genCode(8);
  validKeys.set(newKey, Math.floor(Date.now() / 1000) + 600);
  res.json({ key: newKey });
});

app.get("/list", checkApiKey, (req, res) => {
  res.json(Object.fromEntries(validKeys));
});

app.delete("/clear", checkApiKey, (req, res) => {
  validKeys.clear();
  res.json({ message: "cleared" });
});

app.get("/config", checkKey, (req, res) => {
  console.log(" in /config");
  const secret = config.TURN_SECRET;
  const ttl = parseInt(config.TURN_TTL);
  const [username, password] = generateTurnCredentials(secret, ttl);
  console.log(`TURN username: ${username}, password: ${password}`);

  const updatedIceServers = peerConfig.iceServers.map((server) => {
    if (server.urls[0].startsWith("turn:")) {
      return {
        urls: server.urls,
        username: username,
        credential: password,
      };
    } else {
      return server;
    }
  });

  const updatedPeerConfig = {
    iceServers: updatedIceServers,
    iceTransportPolicy: peerConfig.iceTransportPolicy,
  };

  res.json(updatedPeerConfig);
});

app.use(
  "/material-icons",
  express.static("node_modules/material-icons/iconfont")
);

app.use(checkKey, express.static("public"));

server.listen(port, () => {
  console.log("Server Started.");
  console.log(`Listening on http://localhost:${port}`);
});
