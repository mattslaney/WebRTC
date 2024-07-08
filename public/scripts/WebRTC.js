const socket = io();

let peerConnection;
let peerConfig;
let a = false;
let b = false;

// Load rtc config from server
(async () => {
  const response = await fetch("/config");
  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }

  peerConfig = await response.json();
})();

/*
Signalling with Socket.IO
*/
socket.on("welcome", () => {
  let code;
  while (!code) {
    code = prompt("Enter a room code", "test");
  }
  socket.emit("join", code);
  console.debug("Joined room: ", code);
});
socket.on("created", (code) => {
  a = true;
  console.debug("Room created: ", code)
});
socket.on("joined", (code) => {
  b = true;
  console.debug("Room joined: ", code)
});
socket.on("full", (code) => {
  alert(`The room ${code} is full`);
});
socket.on("begin", () => {
  startRTC();
});
socket.on("describe", (remoteSessionDesc) => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(remoteSessionDesc));
  if (b) answer();
});
socket.on("candidate", (iceCandidate) => {
  let candidate = new RTCIceCandidate({
    sdpMLineIndex: iceCandidate.label,
    candidate: iceCandidate.candidate,
  });
  peerConnection.addIceCandidate(candidate);
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
        peerConnection = new RTCPeerConnection(peerConfig);
        console.log(peerConnection)
        peerConnection.onicecandidate = handleIceCandidate;
        peerConnection.onaddstream = handleRemoteStreamAdded;
        peerConnection.onremovestream = handleRemoteStreamRemoved;
        peerConnection.addStream(stream);
        if (a) call();
      })
      .catch((err) => {
        console.error("getUserMedia() error: " + err.name);
      });
  } catch (err) {
    console.error("Failed to create PeerConnection, exception: " + err.message);
    return;
  }
}

function endRTC() {
  peerConnection.close();
  peerConnection = null;
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
  peerConnection.createOffer(
    (sessionDesc) => {
      peerConnection.setLocalDescription(sessionDesc);
      socket.emit("describe", sessionDesc);
    },
    (err) => console.error(err)
  );
}
function answer() {
  peerConnection.createAnswer().then(
    (sessionDesc) => {
      peerConnection.setLocalDescription(sessionDesc);
      socket.emit("describe", sessionDesc);
    },
    (err) => console.error(err)
  );
}
function hangup() {}
