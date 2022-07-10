import { config } from "./config.js";
const socket = io();

let pc;
let a = false;
let b = false;

/*
Signalling with Socket.IO
*/
socket.on("welcome", () => {
  let code;
  while (!code) {
    code = prompt("Enter a room code", "test");
  }
  socket.emit("join", code);
});
socket.on("created", () => {
  a = true;
});
socket.on("joined", () => {
  b = true;
});
socket.on("full", (code) => {
  alert(`The room ${code} is full`);
});
socket.on("begin", () => {
  startRTC();
});
socket.on("describe", (remoteSessionDesc) => {
  pc.setRemoteDescription(new RTCSessionDescription(remoteSessionDesc));
  if (b) answer();
});
socket.on("candidate", (iceCandidate) => {
  let candidate = new RTCIceCandidate({
    sdpMLineIndex: iceCandidate.label,
    candidate: iceCandidate.candidate,
  });
  pc.addIceCandidate(candidate);
});
socket.on("bye", () => {
  alert("The other user has left");
  stopRTC();
});

/* WebRTC 
------------------------------
 A & B make new RTCPeerConnection()
 A .createOffer()
 A .setLocalDescription()
 A --> emit offer --> B
 B setRemoteDescription()
 B createAnswer()
 B setLocalDescription()
 B --> emit answer --> A
 A setRemoteDescription()
------------------------------
ice candidates generated and added
------------------------------
*/

var localVideo = document.querySelector("#localVideo");
var remoteVideo = document.querySelector("#remoteVideo");

function startRTC() {
  try {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        localVideo.srcObject = stream;
        pc = new RTCPeerConnection(config);
        pc.onicecandidate = handleIceCandidate;
        pc.onaddstream = handleRemoteStreamAdded;
        pc.onremovestream = handleRemoteStreamRemoved;
        pc.addStream(stream);
        if (a) call();
      })
      .catch((err) => {
        console.error("getUserMedia() error: " + e.name);
      });
  } catch (err) {
    console.error("Failed to create PeerConnection, exception: " + err.message);
    return;
  }
}

function endRTC() {
  pc.close();
  pc = null;
}

function handleIceCandidate(ev) {
  if (ev.candidate) {
    socket.emit("candidate", {
      label: ev.candidate.sdpMLineIndex,
      id: ev.candidate.sdpMid,
      candidate: ev.candidate.candidate,
    });
  }
}
function handleRemoteStreamAdded(ev) {
  remoteVideo.srcObject = ev.stream;
}
function handleRemoteStreamRemoved(ev) {
  console.log("gone");
  remoteVideo.srcObject = "";
}

function call() {
  pc.createOffer(
    (sessionDesc) => {
      pc.setLocalDescription(sessionDesc);
      socket.emit("describe", sessionDesc);
    },
    (err) => console.error(err)
  );
}
function answer() {
  pc.createAnswer().then(
    (sessionDesc) => {
      pc.setLocalDescription(sessionDesc);
      socket.emit("describe", sessionDesc);
    },
    (err) => console.error(err)
  );
}
function hangup() {}
