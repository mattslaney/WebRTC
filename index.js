const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const port = process.env.PORT || 3000;

const { Server } = require("socket.io");
const io = new Server(server);

io.on("connection", (socket) => {
  socket.emit("welcome");

  socket.on("join", (code) => {
    if (!io.sockets.adapter.rooms.get(code)) {
      //First client - create
      socket.join(code);
      socket.emit("created");
    } else if (io.sockets.adapter.rooms.get(code).size === 1) {
      //Second client - join
      socket.join(code);
      socket.emit("joined");
      io.to(code).emit("begin");
    } else {
      //Room full - full
      socket.emit("full", code);
      socket.emit("welcome");
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
  });
});

app.use(express.static("public"));
server.listen(port, () => {
  console.log("Server Started.");
  console.log(`Listening on http://localhost:${port}`);
});
