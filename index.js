const express = require("express");
const app = express();
const http = require("http");
const fs = require("fs");
const server = http.createServer(app);
const port = process.env.PORT || 3000;

const { Server } = require("socket.io");
const io = new Server(server);

let peerConfig = {};
try {
  const data = fs.readFileSync("config.json");
  peerConfig = JSON.parse(data);
} catch (err) {
  console.error("Error reading config file: ", err);
}

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
  res.json(peerConfig);
});

server.listen(port, () => {
  console.log("Server Started.");
  console.log(`Listening on http://localhost:${port}`);
});
