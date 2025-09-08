import { useEffect, useState, useRef } from "react";
import API from "../../axios";
import { useSocket } from "../../context/SocketContext";
import Video from "twilio-video";
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
      // attach() can return an element or an array
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
        // ignore if detach fails
        console.log(err);
      }
      if (typeof track.stop === "function") {
        try {
          track.stop();
        } catch (err) {
          // ignore
          console.log(err);
        }
      }
    });
  };

  // Build deterministic room name so both peers join same room
  const getRoomName = (myId, otherId) => {
    if (!myId) return `${otherId}`; // fallback
    const pair = [myId.toString(), otherId.toString()].sort();
    return `${pair[0]}_${pair[1]}`;
  };

  // Start video call (caller side)
  const startVideoCall = async (recId) => {
    try {
      // Request a token (no room param required)
      const tokenRes = await API.get("/token/video");
      const token = tokenRes.data.token;
      const identity = tokenRes.data.identity;

      // Save identity (fixes earlier eslint unused setCurrentUserId)
      setCurrentUserId(identity);

      // deterministic room name so both parties can join same room
      const roomName = getRoomName(identity, recId);

      setSelectedUser(recId);

      const connectedRoom = await Video.connect(token, {
        name: roomName,
        audio: true,
        video: { width: 640 },
      });

      // Clear any previous UI
      if (localVideoRef.current) localVideoRef.current.innerHTML = "";
      if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = "";

      setRoom(connectedRoom);
      toast.success(`Connected to room: ${roomName}`);

      // attach local participant's existing tracks
      connectedRoom.localParticipant.tracks.forEach((publication) => {
        const track = publication.track;
        if (track) attachTracks([track], localVideoRef.current);
      });

      // attach tracks of participants already in the room
      connectedRoom.participants.forEach((participant) => {
        participant.tracks.forEach((pub) => {
          if (pub.track) attachTracks([pub.track], remoteVideoRef.current);
        });

        // subscribe to future track events
        participant.on("trackSubscribed", (track) =>
          attachTracks([track], remoteVideoRef.current)
        );
        participant.on("trackUnsubscribed", (track) => detachTracks([track]));
      });

      // When a new participant connects
      connectedRoom.on("participantConnected", (participant) => {
        participant.tracks.forEach((pub) => {
          if (pub.track) attachTracks([pub.track], remoteVideoRef.current);
        });
        participant.on("trackSubscribed", (track) =>
          attachTracks([track], remoteVideoRef.current)
        );
        participant.on("trackUnsubscribed", (track) => detachTracks([track]));
      });

      // When a participant disconnects
      connectedRoom.on("participantDisconnected", (participant) => {
        participant.tracks.forEach((pub) => {
          if (pub.track) detachTracks([pub.track]);
        });
      });

      // Cleanup when the room itself disconnects for this client
      connectedRoom.on("disconnected", (roomObj) => {
        // detach and stop local tracks
        roomObj.localParticipant.tracks.forEach((publication) => {
          if (publication.track) detachTracks([publication.track]);
        });

        // detach remote tracks
        roomObj.participants.forEach((participant) => {
          participant.tracks.forEach((pub) => {
            if (pub.track) detachTracks([pub.track]);
          });
        });

        // clear UI
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
        // force disconnect; 'disconnected' handler will clean up tracks/UI
        room.disconnect();
        toast("Call ended");
      } catch (err) {
        console.error("Error ending call:", err);
        // attempt manual cleanup
        room.localParticipant.tracks.forEach((pub) => {
          if (pub.track) detachTracks([pub.track]);
        });
        if (localVideoRef.current) localVideoRef.current.innerHTML = "";
        if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = "";
        setRoom(null);
        setSelectedUser(null);
      }
    }
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
