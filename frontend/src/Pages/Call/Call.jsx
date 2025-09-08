import { useEffect, useState, useRef } from "react";
import API from "../../axios";
import { useSocket } from "../../context/SocketContext";
import Video from "twilio-video";
import { Device } from "@twilio/voice-sdk"; // Voice SDK
import toast from "react-hot-toast";
import "./Call.css";

const Call = () => {
  const socket = useSocket();

  const [allUsers, setAllUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Video state
  const [room, setRoom] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);

  // Voice state
  const [device, setDevice] = useState(null);
  const [voiceConnection, setVoiceConnection] = useState(null);

  // Video refs
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

  // Handle online users via socket
  useEffect(() => {
    if (!socket) return;
    socket.on("onlineUsers", (users) => setOnlineUsers(users));
    return () => socket.off("onlineUsers");
  }, [socket]);

  // ---------------- VIDEO ----------------
  const getRoomName = (myId, otherId) => {
    const pair = [myId.toString(), otherId.toString()].sort();
    return `${pair[0]}_${pair[1]}`;
  };

  const startVideoCall = async (recId) => {
    try {
      const tokenRes = await API.get("/token/video");
      const { token, identity } = tokenRes.data;
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
      toast.success(`Video room: ${roomName}`);

      // Local tracks
      connectedRoom.localParticipant.tracks.forEach((pub) => {
        if (pub.track) localVideoRef.current.appendChild(pub.track.attach());
      });

      // Remote tracks
      connectedRoom.participants.forEach((participant) => {
        participant.tracks.forEach((pub) => {
          if (pub.track) remoteVideoRef.current.appendChild(pub.track.attach());
        });
        participant.on("trackSubscribed", (track) =>
          remoteVideoRef.current.appendChild(track.attach())
        );
        participant.on("trackUnsubscribed", (track) =>
          track.detach().forEach((el) => el.remove())
        );
      });

      connectedRoom.on("disconnected", () => {
        setRoom(null);
        setSelectedUser(null);
        if (localVideoRef.current) localVideoRef.current.innerHTML = "";
        if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = "";
        setIsMuted(false);
        setIsCameraOn(true);
      });
    } catch (err) {
      console.error(err);
      toast.error("Video call failed");
    }
  };

  // ---------------- VOICE ----------------
  const initVoiceDevice = async () => {
    try {
      const res = await API.get("/token/voice");
      const { token } = res.data;
      const twilioDevice = new Device(token, { debug: true });
      setDevice(twilioDevice);

      twilioDevice.on("ready", () => toast.success("Voice ready"));
      twilioDevice.on("error", (err) =>
        toast.error(`Voice error: ${err.message}`)
      );
    } catch (err) {
      console.error(err);
      toast.error("Failed to init voice device");
    }
  };

  useEffect(() => {
    initVoiceDevice();
  }, []);

  const startVoiceCall = (recId) => {
    if (!device) return toast.error("Voice not ready");
    setSelectedUser(recId);

    const conn = device.connect({ params: { to: recId } });
    setVoiceConnection(conn);

    conn.on("accept", () => toast.success("Voice call connected"));
    conn.on("disconnect", () => {
      setVoiceConnection(null);
      setSelectedUser(null);
      toast("Voice call ended");
    });
  };

  // ---------------- CONTROLS ----------------
  const handleEndCall = () => {
    if (room) {
      room.disconnect();
      setRoom(null);
    }
    if (voiceConnection) {
      voiceConnection.disconnect();
      setVoiceConnection(null);
    }
    setSelectedUser(null);
  };

  const handleMuteToggle = () => {
    if (!room) return;
    const newMute = !isMuted;
    room.localParticipant.audioTracks.forEach((pub) => {
      if (pub.track) newMute ? pub.track.disable() : pub.track.enable();
    });
    setIsMuted(newMute);
    toast(newMute ? "Muted" : "Unmuted");
  };

  const handleCameraToggle = () => {
    if (!room) return;
    const newState = !isCameraOn;
    room.localParticipant.videoTracks.forEach((pub) => {
      if (pub.track) newState ? pub.track.enable() : pub.track.disable();
    });
    setIsCameraOn(newState);
    toast(newState ? "Camera On" : "Camera Off");
  };

  return (
    <div className="call-container">
      <div className="users-section">
        <h3>All Users</h3>
        <ul>
          {allUsers.map((u) => (
            <li key={u._id}>{u.name}</li>
          ))}
        </ul>
      </div>

      <div className="online-section">
        <h3>Online Users</h3>
        <ul>
          {onlineUsers
            .filter((u) => u._id !== currentUserId)
            .map((u) => (
              <li key={u._id} className="online-user">
                <span>{u.name}</span>
                <button
                  onClick={() => startVoiceCall(u._id)}
                  disabled={!!room || !!voiceConnection}
                >
                  Voice
                </button>
                <button
                  onClick={() => startVideoCall(u._id)}
                  disabled={!!room || !!voiceConnection}
                >
                  Video
                </button>
              </li>
            ))}
        </ul>
      </div>

      <div className="call-box">
        {room && (
          <>
            <h2>Video call with {selectedUser}</h2>
            <div className="video-wrapper">
              <div ref={localVideoRef} className="local-video"></div>
              <div ref={remoteVideoRef} className="remote-video"></div>
            </div>
            <div className="call-controls">
              <button onClick={handleEndCall}>End</button>
              <button onClick={handleMuteToggle}>
                {isMuted ? "Unmute" : "Mute"}
              </button>
              <button onClick={handleCameraToggle}>
                {isCameraOn ? "Camera Off" : "Camera On"}
              </button>
            </div>
          </>
        )}

        {voiceConnection && (
          <>
            <h2>Voice call with {selectedUser}</h2>
            <div className="call-controls">
              <button onClick={handleEndCall}>End</button>
            </div>
          </>
        )}

        {!room && !voiceConnection && <h2>No Active Call</h2>}
      </div>
    </div>
  );
};

export default Call;
