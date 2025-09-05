import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { io } from "socket.io-client";

import Home from "./Pages/Home/Home";
import Login from "./Pages/Login/Login";
import Call from "./Pages/Call/Call";

import Navbar from "./Components/Navbar/Navbar";
import Footer from "./Components/Footer/Footer";

import API from "./axios";
import SocketContext from "./context/SocketContext";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [socket, setSocket] = useState(null);
  const location = useLocation();

  useEffect(() => {
    let newSocket;

    const verifyToken = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setIsAuthenticated(false);
        return;
      }

      try {
        const res = await API.get("/auth/verify");
        setIsAuthenticated(res.data.valid);

        if (res.data.valid) {
          const user = localStorage.getItem("user");

          newSocket = io("http://localhost:8000", { auth: { token } });
          setSocket(newSocket);

          newSocket.emit("userOnline", user);
        }
      } catch (err) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        console.log(err);
        setIsAuthenticated(false);
        toast.error("Session expired. Please login again.");
      }
    };

    verifyToken();

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, [location.pathname]);

  if (isAuthenticated === null) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Checking authentication...</p>
      </div>
    );
  }

  return (
    <SocketContext.Provider value={socket}>
      <Toaster position="top-center" reverseOrder={false} />

      <main>
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated ? <Navigate to="/home" replace /> : <Login />
            }
          />

          <Route
            path="/home"
            element={
              isAuthenticated ? (
                <>
                  <Navbar />
                  <Home />
                  <Footer />
                </>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route
            path="/call"
            element={
              isAuthenticated ? (
                <>
                  <Navbar />
                  <Call />
                  <Footer />
                </>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </SocketContext.Provider>
  );
}

export default App;
