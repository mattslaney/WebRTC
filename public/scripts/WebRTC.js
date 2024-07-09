const socket = io();

let peerConnection;
let peerConfig;
let localUser = false;
let remoteUser = false;

// Load rtc config from server
(async () => {
  const response = await fetch("/config");
  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }

  peerConfig = await response.json();
})();

const joinRoom = document.getElementById("joinRoom");
const roomCode = document.getElementById("roomCode");
joinRoom.onclick = () => {
  let code = roomCode.value;
  if (code) {
    if (roomCode.disabled) {
      socket.emit("leave", code);
      console.debug("Left room: ", code);
      joinRoom.value = "Join Room";
      roomCode.disabled = "";
    } else {
      socket.emit("join", code);
      console.debug("Joined room: ", code);
      joinRoom.value = "Leave Room";
      roomCode.disabled = "disabled";
    }
  }
};

/*
Signalling with Socket.IO
*/
socket.on("welcome", async () => {
  await init();
});
socket.on("created", (code) => {
  localUser = true;
  console.debug("Room created: ", code);
});
socket.on("joined", (code) => {
  remoteUser = true;
  console.debug("Room joined: ", code);
});
socket.on("full", (code) => {
  alert(`The room ${code} is full`);
});
socket.on("begin", () => {
  console.debug("Both users ready to start");
  if (localUser) call();
});
socket.on("describe", (remoteSessionDesc) => {
  peerConnection.setRemoteDescription(
    new RTCSessionDescription(remoteSessionDesc)
  );
  if (remoteUser) answer();
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
  hangup();
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

// When local user joins get camera permission and create peer connection
const init = async () => {
  let localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });
  localVideo.srcObject = localStream;

  peerConnection = new RTCPeerConnection(peerConfig);

  localStream.getTracks().forEach((track) => {
    console.debug("Track added to local stream: ", track);
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.onicecandidate = handleIceCandidate;
  peerConnection.ontrack = handleRemoteStreamAdded;
  peerConnection.removetrack = handleRemoteStreamRemoved;

  console.log("INITIALISED");
  console.debug("Peer Connection: ", peerConnection);
};

// When remote user joins, send offer
const call = () => {
  peerConnection.createOffer(
    (sessionDesc) => {
      peerConnection.setLocalDescription(sessionDesc);
      console.log("OFFER");
      console.debug("Sending offer", sessionDesc);
      socket.emit("describe", sessionDesc);
    },
    (err) => console.error(err)
  );
};

function answer() {
  peerConnection.createAnswer().then(
    (sessionDesc) => {
      peerConnection.setLocalDescription(sessionDesc);
      console.log("ANSWER");
      console.debug("Sending answer", sessionDesc);
      socket.emit("describe", sessionDesc);
    },
    (err) => console.error(err)
  );
}

const hangup = () => {
  console.log("HANGUP");
  peerConnection.close();
  peerConnection = null;
};

const handleIceCandidate = (event) => {
  if (event.candidate) {
    console.debug("New ICE Candidate", event.candidate);
    socket.emit("candidate", {
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
    });
  }
};
const handleRemoteStreamAdded = (event) => {
  let remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;
  event.streams[0].getTracks().forEach((track) => {
    console.debug("Track added to remote stream: ", track);
    remoteStream.addTrack(track);
  });
};
const handleRemoteStreamRemoved = (ev) => {
  console.log("Remote Stream Removed");
  remoteVideo.srcObject = "";
};
