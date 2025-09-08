import { useEffect, useState, useRef } from "react";
import API from "../../axios";
import { useSocket } from "../../context/SocketContext";
import Video from "twilio-video";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import toast from "react-hot-toast";
import "./Call.css";

const Call = () => {
  const socket = useSocket();

  const [allUsers, setAllUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);

  const [transcript, setTranscript] = useState("");
  const recognizerRef = useRef(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await API.get("/auth/users");
        setAllUsers(res.data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch users");
      }
    };
    fetchUsers();
  }, []);

  // Handle online users from socket
  useEffect(() => {
    if (!socket) return;
    socket.on("onlineUsers", (users) => setOnlineUsers(users));
    return () => socket.off("onlineUsers");
  }, [socket]);

  // Helper: attach track(s) to a container
  const attachTracks = (tracks = [], container) => {
    if (!container) return;
    tracks.forEach((track) => {
      const attached = track.attach();
      if (Array.isArray(attached)) {
        attached.forEach((el) => container.appendChild(el));
      } else if (attached) {
        container.appendChild(attached);
      }
    });
  };

  // Helper: detach & stop track(s)
  const detachTracks = (tracks = []) => {
    tracks.forEach((track) => {
      try {
        const elems = track.detach();
        elems.forEach((el) => el.remove());
      } catch (err) {
        console.log(err);
      }
      if (typeof track.stop === "function") {
        try {
          track.stop();
        } catch (err) {
          console.log(err);
        }
      }
    });
  };

  // Build deterministic room name so both peers join same room
  const getRoomName = (myId, otherId) => {
    if (!myId) return `${otherId}`;
    const pair = [myId.toString(), otherId.toString()].sort();
    return `${pair[0]}_${pair[1]}`;
  };

  // Start video call
  const startVideoCall = async (recId) => {
    try {
      const tokenRes = await API.get("/token/video");
      const token = tokenRes.data.token;
      const identity = tokenRes.data.identity;

      setCurrentUserId(identity);

      const roomName = getRoomName(identity, recId);
      setSelectedUser(recId);

      const connectedRoom = await Video.connect(token, {
        name: roomName,
        audio: true,
        video: { width: 640 },
      });

      if (localVideoRef.current) localVideoRef.current.innerHTML = "";
      if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = "";

      setRoom(connectedRoom);
      toast.success(`Connected to room: ${roomName}`);

      connectedRoom.localParticipant.tracks.forEach((publication) => {
        const track = publication.track;
        if (track) attachTracks([track], localVideoRef.current);
      });

      connectedRoom.participants.forEach((participant) => {
        participant.tracks.forEach((pub) => {
          if (pub.track) attachTracks([pub.track], remoteVideoRef.current);
        });

        participant.on("trackSubscribed", (track) =>
          attachTracks([track], remoteVideoRef.current)
        );
        participant.on("trackUnsubscribed", (track) => detachTracks([track]));
      });

      connectedRoom.on("participantConnected", (participant) => {
        participant.tracks.forEach((pub) => {
          if (pub.track) attachTracks([pub.track], remoteVideoRef.current);
        });
        participant.on("trackSubscribed", (track) =>
          attachTracks([track], remoteVideoRef.current)
        );
        participant.on("trackUnsubscribed", (track) => detachTracks([track]));
      });

      connectedRoom.on("participantDisconnected", (participant) => {
        participant.tracks.forEach((pub) => {
          if (pub.track) detachTracks([pub.track]);
        });
      });

      connectedRoom.on("disconnected", (roomObj) => {
        roomObj.localParticipant.tracks.forEach((publication) => {
          if (publication.track) detachTracks([publication.track]);
        });
        roomObj.participants.forEach((participant) => {
          participant.tracks.forEach((pub) => {
            if (pub.track) detachTracks([pub.track]);
          });
        });

        if (localVideoRef.current) localVideoRef.current.innerHTML = "";
        if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = "";

        setRoom(null);
        setSelectedUser(null);
        setIsMuted(false);
        setIsCameraOn(true);
      });
    } catch (err) {
      console.error("Video call error:", err);
      toast.error("Failed to start video call");
    }
  };

  // End call
  const handleEndCall = () => {
    if (room) {
      try {
        room.disconnect();
        toast("Call ended");
      } catch (err) {
        console.error("Error ending call:", err);
      }
    }
    // Stop speech recognition too
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync();
      recognizerRef.current = null;
    }
    setTranscript("");
  };

  // Toggle mute/unmute
  const handleMuteToggle = () => {
    if (!room) return;
    const newMute = !isMuted;
    room.localParticipant.audioTracks.forEach((pub) => {
      const track = pub.track;
      if (!track) return;
      try {
        newMute ? track.disable() : track.enable();
      } catch (err) {
        console.warn("Audio toggle error:", err);
      }
    });
    setIsMuted(newMute);
    toast(newMute ? "Muted" : "Unmuted");
  };

  // Toggle camera on/off
  const handleCameraToggle = () => {
    if (!room) return;
    const newState = !isCameraOn;
    room.localParticipant.videoTracks.forEach((pub) => {
      const track = pub.track;
      if (!track) return;
      try {
        newState ? track.enable() : track.disable();
      } catch (err) {
        console.warn("Video toggle error:", err);
      }
    });
    setIsCameraOn(newState);
    toast(newState ? "Camera On" : "Camera Off");
  };

  // Start speech recognition
  const startSpeechRecognition = async () => {
    try {
      const { data } = await API.get("/token/speech");
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        data.key,
        data.region
      );
      speechConfig.speechRecognitionLanguage = "en-US";

      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      const recognizer = new SpeechSDK.SpeechRecognizer(
        speechConfig,
        audioConfig
      );

      recognizer.recognizing = (_, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech) {
          setTranscript((prev) => prev + " " + e.result.text);
        }
      };

      recognizer.recognized = (_, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          setTranscript((prev) => prev + " " + e.result.text);
        }
      };

      recognizer.startContinuousRecognitionAsync();
      recognizerRef.current = recognizer;
      toast("Speech recognition started");
    } catch (err) {
      console.error("Speech recognition error:", err);
      toast.error("Speech recognition failed");
    }
  };

  return (
    <div className="call-container">
      <div className="users-section">
        <h3>All Users</h3>
        <ul>
          {allUsers.map((user) => (
            <li key={user._id}>
              <span>{user.name}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="online-section">
        <h3>Online Users</h3>
        <ul>
          {onlineUsers
            .filter((user) => user._id !== currentUserId)
            .map((user) => (
              <li key={user._id} className="online-user">
                <span>{user.name}</span>
                <button
                  className="call-btn"
                  onClick={() => startVideoCall(user._id)}
                  disabled={!!room}
                >
                  camera
                </button>
              </li>
            ))}
        </ul>
      </div>

      <div className="call-box">
        {room ? (
          <>
            <h2>In Video Call with {selectedUser}</h2>
            <div className="video-wrapper">
              <div className="local-video" ref={localVideoRef}></div>
              <div className="remote-video" ref={remoteVideoRef}></div>
            </div>
            <div className="call-controls">
              <button className="end-btn" onClick={handleEndCall}>
                End Call
              </button>
              <button className="mute-btn" onClick={handleMuteToggle}>
                {isMuted ? "Unmute" : "Mute"}
              </button>
              <button className="video-btn" onClick={handleCameraToggle}>
                {isCameraOn ? "Camera Off" : "Camera On"}
              </button>
              <button className="speech-btn" onClick={startSpeechRecognition}>
                Start Speech
              </button>
            </div>
            <div className="transcript-box">
              <h4>Transcript</h4>
              <p>{transcript}</p>
            </div>
          </>
        ) : (
          <h2>No Active Call</h2>
        )}
      </div>
    </div>
  );
};

export default Call;
