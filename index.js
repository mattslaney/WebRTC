const crypto = require("crypto");
const dotenv = require("dotenv");
const express = require("express");
const app = express();
const http = require("http");
const fs = require("fs");
const server = http.createServer(app);
const port = process.env.PORT || 3000;
const config = dotenv.config().parsed;

const { Server } = require("socket.io");
const io = new Server(server);

let peerConfig = {};
try {
  const data = fs.readFileSync("config.json");
  peerConfig = JSON.parse(data);
} catch (err) {
  console.error("Error reading config file: ", err);
}

const generateTurnCredentials = () => {
  const secret = config.TURN_SECRET;
  const ttl = parseInt(config.TURN_TTL);
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
      io.to(code).emit("begin");
      console.debug("Second client: ", code);
    } else {
      //Room full - full
      socket.emit("full", code);
      socket.emit("welcome");
      console.debug("Room full: ", code);
    }
  });

  socket.on("describe", (sessionDesc) => {
    socket.broadcast.emit("describe", sessionDesc);
  });

  socket.on("candidate", (candidate) => {
    socket.broadcast.emit("candidate", candidate);
  });

  io.on("disconnecting", (socket) => {
    io.to(socket.rooms).emit("bye");
    console.debug("Disconnected: ", socket);
  });
});

app.use(express.static("public"));

app.get("/config", (_, res) => {
  const [username, password] = generateTurnCredentials();
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

server.listen(port, () => {
  console.log("Server Started.");
  console.log(`Listening on http://localhost:${port}`);
});
