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
  const [isDeviceReady, setIsDeviceReady] = useState(false);

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

  // Setup Twilio Device (called only after button click)
  const setupDevice = async () => {
    try {
      console.log("setupDevice called");

      const tokenRes = await API.get("/token/voice");
      const token = tokenRes.data.token;

      setCurrentUserId(tokenRes.data.identity);

      console.log("Got token:", tokenRes.data.identity);

      const twilioDevice = new Device(token, {
        codecPreferences: ["opus", "pcmu"],
        debug: true,
      });

      console.log(1);

      twilioDevice.on("registered", () => {
        console.log("is this coming");
        console.log("Twilio Device is registered");
      });

      console.log(2);

      // Incoming call event
      twilioDevice.on("incoming", (call) => {
        console.log("Incoming call event fired");
        toast("Incoming call...");
        setIncomingCall(call);
      });

      console.log(3);

      twilioDevice.on("error", (err) =>
        console.error("Twilio Device error:", err)
      );

      // IMPORTANT: register the device with Twilio
      await twilioDevice.register();
      console.log("Device.register() finished");

      setDevice(twilioDevice);
      setIsDeviceReady(true);

      console.log(4);
    } catch (err) {
      console.error("Error setting up Twilio Device:", err);
      toast.error("Failed to setup call device");
    }
  };

  // Start outgoing call
  const handleCall = async (recId) => {
    if (!device) {
      toast.error("Call device not ready");
      return;
    }

    try {
      console.log(5);
      const conn = await device.connect({ params: { To: recId } });
      setActiveConnection(conn);
      setSelectedUser(recId);

      console.log(6);

      conn.on("accept", () => toast.success(`In call with ${recId}`));
      conn.on("disconnect", () => {
        toast("Call ended");
        cleanupCallState();
      });
      console.log(7);
    } catch (err) {
      console.error("Call failed:", err);
      toast.error("Failed to start call");
    }
  };

  // Answer incoming call
  const handleAnswerCall = () => {
    console.log(8);
    if (!incomingCall) return;
    incomingCall.accept();
    setActiveConnection(incomingCall);
    setSelectedUser(incomingCall.parameters.From);
    setIncomingCall(null);

    console.log(9);

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
      {!isDeviceReady && (
        <div className="setup-box">
          <button onClick={setupDevice} className="setup-btn">
            Enable Calling
          </button>
        </div>
      )}

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
                  disabled={!isDeviceReady}
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
