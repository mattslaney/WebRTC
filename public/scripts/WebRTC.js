const socket = io();

const testBtn = document.getElementById("test-btn");
const joinRoom = document.getElementById("join-room");
const joinRoomBtn = document.getElementById("join-btn");
const leaveRoom = document.getElementById("leave-btn");
const micBtn = document.getElementById("mic-btn");
const camBtn = document.getElementById("cam-btn");
const roomCode = document.getElementById("room-code-input");
const pipVideo = document.getElementById("pip-video");
const mainVideo = document.getElementById("main-video");

let peerConnection;
let peerConfig;
let isCaller = false;
let isCallee = false;

// Load rtc config from server
(async () => {
  const response = await fetch("/config");
  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
  }

  peerConfig = await response.json();
})();

joinRoomBtn.onclick = () => {
  let code = roomCode.value;
  if (code) {
    socket.emit("join", code);
    console.debug("Joined room: ", code);
    joinRoom.style.display = "none";
    leaveRoom.style.display = "flex";
    leaveRoom.onclick = () => {
      socket.emit("leave", code);
      console.debug("Left room: ", code);
      joinRoom.style.display = "flex";
      leaveRoom.style.display = "none";
      leaveRoom.onclick = undefined;
    };
  }
};

micBtn.onclick = () => {
  toggleTrack("audio")
    ? (micBtn.style.backgroundColor = "")
    : (micBtn.style.backgroundColor = "gray");
};

camBtn.onclick = () => {
  toggleTrack("video")
    ? (camBtn.style.backgroundColor = "")
    : (camBtn.style.backgroundColor = "gray");
};

const toggleTrack = (kind) => {
  let mediaTrack = pipVideo.srcObject
    .getTracks()
    .find((track) => track.kind === kind);
  mediaTrack.enabled
    ? mediaTrack.enabled = false
    : mediaTrack.enabled = true;
  return mediaTrack.enabled;
};

/*
Signalling with Socket.IO
*/
testBtn.onclick = () => {
  console.debug("Sending Test");
  socket.emit("test");
};
socket.on("test", (data) => {
  console.log("Received test message: ", data);
});
socket.on("welcome", async () => {
  await init();
});
socket.on("created", (code) => {
  isCaller = true;
  console.debug("Room created: ", code);
});
socket.on("joined", (code) => {
  isCallee = true;
  console.debug("Room joined: ", code);
});
socket.on("full", (code) => {
  alert(`The room ${code} is full`);
});
socket.on("begin", () => {
  console.debug("Both users ready to start");
  if (isCaller) call();
});
socket.on("describe", (remoteSessionDesc) => {
  peerConnection.setRemoteDescription(
    new RTCSessionDescription(remoteSessionDesc)
  );
  if (isCallee) answer();
});
socket.on("candidate", (iceCandidate) => {
  let candidate = new RTCIceCandidate({
    sdpMLineIndex: iceCandidate.label,
    candidate: iceCandidate.candidate,
  });
  peerConnection.addIceCandidate(candidate);
});
socket.on("bye", () => {
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

// When local user joins get camera permission and create peer connection
const init = async () => {
  let localStream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });
  pipVideo.srcObject = localStream;

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
  //peerConnection.close();
  //peerConnection = null;
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
  mainVideo.srcObject = remoteStream;
  event.streams[0].getTracks().forEach((track) => {
    console.debug("Track added to remote stream: ", track);
    remoteStream.addTrack(track);
  });
  mainVideo.style.display = "block";
};
const handleRemoteStreamRemoved = (ev) => {
  console.log("Remote Stream Removed");
  mainVideo.srcObject = "";
};
