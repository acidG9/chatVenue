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
  const [incomingCall, setIncomingCall] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);

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

  // Setup Twilio Device
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

        // Incoming call event
        twilioDevice.on("incoming", (call) => {
          toast("Incoming call...");
          setIncomingCall(call);
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

  // Start outgoing call
  const handleCall = async (recId) => {
    if (!device) {
      toast.error("Call device not ready");
      return;
    }

    try {
      const conn = await device.connect({ params: { To: recId } }); // ✅ await
      setActiveConnection(conn);
      setSelectedUser(recId);

      conn.on("accept", () => toast.success(`In call with ${recId}`));
      conn.on("disconnect", () => {
        toast("Call ended");
        cleanupCallState();
      });
    } catch (err) {
      console.error("Call failed:", err);
      toast.error("Failed to start call");
    }
  };

  // Answer incoming call
  const handleAnswerCall = () => {
    if (!incomingCall) return;
    incomingCall.accept();
    setActiveConnection(incomingCall);
    setSelectedUser(incomingCall.parameters.From);
    setIncomingCall(null);

    incomingCall.on("disconnect", () => {
      toast("Call ended");
      cleanupCallState();
    });

    toast.success("Call answered");
  };

  // Reject incoming call
  const handleRejectCall = () => {
    if (!incomingCall) return;
    incomingCall.reject();
    setIncomingCall(null);
    toast("Call rejected");
  };

  // End active call
  const handleEndCall = () => {
    if (activeConnection) {
      activeConnection.disconnect();
      toast("Call ended");
    }
    cleanupCallState();
  };

  // Toggle mute
  const handleMuteToggle = () => {
    if (!activeConnection) return;
    const newMuteState = !isMuted;
    activeConnection.mute(newMuteState);
    setIsMuted(newMuteState);
    toast(newMuteState ? "Muted" : "Unmuted");
  };

  // Reset call state
  const cleanupCallState = () => {
    setActiveConnection(null);
    setSelectedUser(null);
    setIsMuted(false);
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
        {incomingCall ? (
          <>
            <h2>Incoming Call...</h2>
            <div className="call-controls">
              <button className="answer-btn" onClick={handleAnswerCall}>
                Answer
              </button>
              <button className="reject-btn" onClick={handleRejectCall}>
                Reject
              </button>
            </div>
          </>
        ) : selectedUser ? (
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
