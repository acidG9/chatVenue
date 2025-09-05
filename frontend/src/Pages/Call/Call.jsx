import { useEffect, useState } from "react";
import API from "../../axios";
import { useSocket } from "../../context/SocketContext";
import { Device } from "@twilio/voice-sdk";
import toast from "react-hot-toast";
import "./Call.css";

const Call = () => {
  const socket = useSocket();
  const [allUsers, setAllUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [device, setDevice] = useState(null);
  const [activeConnection, setActiveConnection] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

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

  useEffect(() => {
    if (!socket) return;
    socket.on("onlineUsers", (users) => setOnlineUsers(users));
    return () => socket.off("onlineUsers");
  }, [socket]);

  useEffect(() => {
    const setupDevice = async () => {
      try {
        const tokenRes = await API.get("/token/voice");
        const token = tokenRes.data.token;

        setCurrentUserId(tokenRes.data.identity);

        const twilioDevice = new Device(token, {
          codecPreferences: ["opus", "pcmu"],
          debug: true,
        });

        twilioDevice.on("registered", () =>
          console.log("Twilio Device is registered")
        );

        twilioDevice.on("incoming", (call) => {
          toast.success("Incoming call!");
          call.accept();
          setActiveConnection(call);

          call.on("disconnect", () => {
            toast("Call ended");
            setActiveConnection(null);
            setSelectedUser(null);
            setIsMuted(false);
          });
        });

        twilioDevice.on("error", (err) =>
          console.error("Twilio Device error:", err)
        );

        setDevice(twilioDevice);
      } catch (err) {
        console.error("Error setting up Twilio Device:", err);
        toast.error("Failed to setup call device");
      }
    };

    setupDevice();
  }, []);

  const handleCall = (recId) => {
    if (!device) {
      toast.error("Call device not ready");
      return;
    }

    const conn = device.connect({ params: { To: recId } });
    setActiveConnection(conn);
    setSelectedUser(recId);

    conn.on("accept", () => toast.success(`In call with ${recId}`));
    conn.on("disconnect", () => {
      toast("Call ended");
      setActiveConnection(null);
      setSelectedUser(null);
      setIsMuted(false);
    });
  };

  const handleEndCall = () => {
    if (activeConnection) {
      activeConnection.disconnect();
      setActiveConnection(null);
      setSelectedUser(null);
      setIsMuted(false);
      toast("Call ended");
    }
  };

  const handleMuteToggle = () => {
    if (!activeConnection) return;
    const newMuteState = !isMuted;
    activeConnection.mute(newMuteState);
    setIsMuted(newMuteState);
    toast(newMuteState ? "Muted" : "Unmuted");
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
                  onClick={() => handleCall(user._id)}
                >
                  📞
                </button>
              </li>
            ))}
        </ul>
      </div>

      <div className="call-box">
        {selectedUser ? (
          <>
            <h2>In Call with {selectedUser}</h2>
            <div className="call-controls">
              <button className="end-btn" onClick={handleEndCall}>
                End Call
              </button>
              <button className="mute-btn" onClick={handleMuteToggle}>
                {isMuted ? "Unmute" : "Mute"}
              </button>
              <button className="video-btn">📷 (soon)</button>
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
