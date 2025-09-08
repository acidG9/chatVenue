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

  const recognizersRef = useRef({});
  const trackSpeakerMap = useRef({});
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

  // Online users from socket
  useEffect(() => {
    if (!socket) return;
    socket.on("onlineUsers", (users) => setOnlineUsers(users));
    return () => socket.off("onlineUsers");
  }, [socket]);

  // Helper: attach track(s) to container
  const attachTracks = (tracks = [], container) => {
    if (!container) return;
    tracks.forEach((track) => {
      const attached = track.attach();
      if (Array.isArray(attached))
        attached.forEach((el) => container.appendChild(el));
      else if (attached) container.appendChild(attached);
    });
  };

  // Helper: detach & stop track(s)
  const detachTracks = (tracks = []) => {
    tracks.forEach((track) => {
      try {
        const elems = track.detach();
        elems.forEach((el) => el.remove());
      } catch (e) {
        console.log(e);
      }
      if (typeof track.stop === "function") track.stop?.();
    });
  };

  // Map user ID to name
  const getUserNameById = (id) => {
    if (id === currentUserId) return "You";
    const user = allUsers.find((u) => u._id === id);
    return user?.name || "Unknown";
  };

  // Deterministic room name
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
      setSelectedUser(recId);

      const roomName = getRoomName(identity, recId);

      const connectedRoom = await Video.connect(token, {
        name: roomName,
        audio: true,
        video: { width: 640 },
      });

      if (localVideoRef.current) localVideoRef.current.innerHTML = "";
      if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = "";

      setRoom(connectedRoom);
      toast.success(`Connected to room: ${roomName}`);

      // Local participant
      connectedRoom.localParticipant.tracks.forEach((pub) => {
        const track = pub.track;
        if (track) {
          attachTracks([track], localVideoRef.current);
          if (track.kind === "audio")
            trackSpeakerMap.current[track.mediaStreamTrack.id] = "You";
        }
      });

      // Remote participant handling
      const subscribeParticipantTracks = (participant) => {
        participant.tracks.forEach((pub) => {
          const track = pub.track;
          if (track) {
            attachTracks([track], remoteVideoRef.current);
            if (track.kind === "audio")
              trackSpeakerMap.current[track.mediaStreamTrack.id] =
                getUserNameById(participant.identity);
          }
        });

        participant.on("trackSubscribed", (track) => {
          attachTracks([track], remoteVideoRef.current);
          if (track.kind === "audio")
            trackSpeakerMap.current[track.mediaStreamTrack.id] =
              getUserNameById(participant.identity);
        });

        participant.on("trackUnsubscribed", (track) => {
          detachTracks([track]);
          if (track.kind === "audio")
            delete trackSpeakerMap.current[track.mediaStreamTrack.id];
        });
      };

      connectedRoom.participants.forEach(subscribeParticipantTracks);
      connectedRoom.on("participantConnected", subscribeParticipantTracks);

      connectedRoom.on("participantDisconnected", (participant) => {
        participant.tracks.forEach((pub) => {
          if (pub.track) detachTracks([pub.track]);
        });
      });

      connectedRoom.on("disconnected", (roomObj) => {
        roomObj.localParticipant.tracks.forEach(
          (pub) => pub.track && detachTracks([pub.track])
        );
        roomObj.participants.forEach((p) =>
          p.tracks.forEach((pub) => pub.track && detachTracks([pub.track]))
        );

        if (localVideoRef.current) localVideoRef.current.innerHTML = "";
        if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = "";

        setRoom(null);
        setSelectedUser(null);
        setIsMuted(false);
        setIsCameraOn(true);
        recognizersRef.current = {};
        trackSpeakerMap.current = {};
      });
    } catch (err) {
      console.error("Video call error:", err);
      toast.error("Failed to start video call");
    }
  };

  // End call
  const handleEndCall = () => {
    if (room) room.disconnect();
    Object.values(recognizersRef.current).forEach((rec) =>
      rec.stopContinuousRecognitionAsync()
    );
    recognizersRef.current = {};
    setTranscript("");
    trackSpeakerMap.current = {};
    toast("Call ended");
  };

  // Toggle mute/unmute
  const handleMuteToggle = () => {
    if (!room) return;
    const newMute = !isMuted;
    room.localParticipant.audioTracks.forEach(
      (pub) => pub.track && (newMute ? pub.track.disable() : pub.track.enable())
    );
    setIsMuted(newMute);
    toast(newMute ? "Muted" : "Unmuted");
  };

  // Toggle camera
  const handleCameraToggle = () => {
    if (!room) return;
    const newState = !isCameraOn;
    room.localParticipant.videoTracks.forEach(
      (pub) =>
        pub.track && (newState ? pub.track.enable() : pub.track.disable())
    );
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

      const audioTracks = [];
      if (room) {
        room.localParticipant.audioTracks.forEach(
          (pub) => pub.track && audioTracks.push(pub.track)
        );
        room.participants.forEach((p) =>
          p.tracks.forEach(
            (pub) =>
              pub.track && pub.kind === "audio" && audioTracks.push(pub.track)
          )
        );
      }

      if (audioTracks.length === 0) {
        toast.error("No audio tracks available");
        return;
      }

      for (const track of audioTracks) {
        if (recognizersRef.current[track.mediaStreamTrack.id]) continue;

        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(
          new MediaStream([track.mediaStreamTrack])
        );
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);

        const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(
          destination.stream
        );
        const recognizer = new SpeechSDK.SpeechRecognizer(
          speechConfig,
          audioConfig
        );

        const speakerName =
          trackSpeakerMap.current[track.mediaStreamTrack.id] || "Unknown";

        recognizer.recognizing = (_, e) => {
          if (e.result.reason === SpeechSDK.ResultReason.RecognizingSpeech)
            setTranscript(
              (prev) => prev + ` [${speakerName}] ${e.result.text}`
            );
        };

        recognizer.recognized = (_, e) => {
          if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech)
            setTranscript(
              (prev) => prev + ` [${speakerName}] ${e.result.text}`
            );
        };

        recognizer.startContinuousRecognitionAsync();
        recognizersRef.current[track.mediaStreamTrack.id] = recognizer;
      }

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
            <h2>In Video Call with {getUserNameById(selectedUser)}</h2>
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
