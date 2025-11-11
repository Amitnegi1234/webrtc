import { useEffect, useRef, useState } from "react";
import { useUser } from "../../context/UserContextApi";
import { useNavigate } from "react-router-dom";
import {
  FaBars,
  FaTimes,
  FaMicrophone,
  FaMicrophoneSlash,
  FaPhoneSlash,
  FaVideo,
  FaVideoSlash,
} from "react-icons/fa";
import apiClient from "../../apiClient";
import SocketContext from "../socket/SocketContext";
import Peer from "simple-peer";

const Dashboard = () => {
  const { user, updateUser } = useUser();
  const navigate = useNavigate();

  // Core state + refs
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);

  const [me, setMe] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);

  const [showRecieverDetailPopup, setShowRecieverDetailPopup] = useState(false);
  const [showRecieverDetails, setShowRecieverDetails] = useState(null);

  const connectionRef = useRef(null); // simple-peer instance
  const hasJoined = useRef(false);

  const [recievingCall, setRecievingCall] = useState(false);
  const [caller, setCaller] = useState(null);
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);

  const [callRejectedPopup, setCallRejectedPopup] = useState(false);
  const [callRejectedUser, setCallRejectedUser] = useState(null);

  const myVideo = useRef(null);
  const recieverVideo = useRef(null);
  const connection = useRef(null);

  const [stream, setStream] = useState(null);

  // mic/cam toggles
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);

  const socket = SocketContext.getSocket();

  // ---------------------------
  // Socket event handlers setup
  // ---------------------------
  useEffect(() => {
    if (!socket) return;

    if (user && socket && !hasJoined.current) {
      socket.emit("join", { id: user._id, name: user.username });
      hasJoined.current = true;
    }

    const onMe = (id) => setMe(id);
    const onOnlineUsers = (online) => setOnlineUsers(online);
    const onCallToUser = (data) => {
      setRecievingCall(true);
      setCaller(data);
      setCallerSignal(data.signal);
    };
    const onCallEnded = () => {
      endCallCleanup();
    };
    const onCallRejected = (data) => {
      setCallRejectedPopup(true);
      setCallRejectedUser(data);
    };

    socket.on("me", onMe);
    socket.on("online-users", onOnlineUsers);
    socket.on("callToUser", onCallToUser);
    socket.on("callEnded", onCallEnded);
    socket.on("callRejected", onCallRejected);

    return () => {
      socket.off("me", onMe);
      socket.off("online-users", onOnlineUsers);
      socket.off("callToUser", onCallToUser);
      socket.off("callEnded", onCallEnded);
      socket.off("callRejected", onCallRejected);
    };
  }, [socket, user]);

  // ---------------------------
  // Fetch users
  // ---------------------------
  const allusers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/user");
      if (response?.data?.success !== false) {
        setUsers(response.data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    allusers();
    // cleanup on unmount (stop any active stream)
    return () => {
      endCallCleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOnlineUser = (userId) => onlineUsers.some((u) => u.userId === userId);

  // ---------------------------
  // Start call (caller)
  // ---------------------------
  const startCall = async () => {
    if (!showRecieverDetails) return;
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      setStream(currentStream);
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream;
        myVideo.current.muted = true;
      }
      currentStream.getAudioTracks().forEach((t) => (t.enabled = true));

      setIsSidebarOpen(false);
      setCallRejectedPopup(false);
      setSelectedUser(showRecieverDetails._id);

      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream: currentStream,
      });

      peer.on("signal", (data) => {
        socket.emit("callToUser", {
          callToUserId: showRecieverDetails._id,
          signalData: data,
          from: me,
          name: user?.username,
          email: user?.email,
          profilepic: user?.profilepic,
        });
      });

      peer.on("stream", (remoteStream) => {
        if (recieverVideo.current) {
          recieverVideo.current.srcObject = remoteStream;
        }
      });

      const onCallAccepted = (data) => {
        setCallRejectedPopup(false);
        setCallAccepted(true);
        setCaller((prev) => ({ ...prev, from: data.from }));
        peer.signal(data.signal);
      };
      // listen for callAccepted only while peer exists
      socket.on("callAccepted", onCallAccepted);

      connectionRef.current = peer;
      connection.current = peer;

      setShowRecieverDetailPopup(false);

      // cleanup listener if peer closed/destroyed later
      peer.on("close", () => {
        socket.off("callAccepted", onCallAccepted);
      });
    } catch (error) {
      console.error("startCall error:", error);
    }
  };

  // ---------------------------
  // Accept call (callee)
  // ---------------------------
  const handelacceptCall = async () => {
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({
        video: false, 
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      setStream(currentStream);
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream;
        myVideo.current.muted = true;
      }
      currentStream.getAudioTracks().forEach((t) => (t.enabled = true));

      setCallAccepted(true);
      setRecievingCall(true);
      setIsSidebarOpen(false);

      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: currentStream,
      });

      peer.on("signal", (data) => {
        socket.emit("answeredCall", {
          signal: data,
          from: me,
          to: caller?.from || caller?.socketId,
        });
      });

      peer.on("stream", (remoteStream) => {
        if (recieverVideo.current) {
          recieverVideo.current.srcObject = remoteStream;
        }
      });

      if (callerSignal) peer.signal(callerSignal);

      connectionRef.current = peer;
      connection.current = peer;
    } catch (error) {
      console.error("handelacceptCall error:", error);
    }
  };

  // ---------------------------
  // End / Reject call
  // ---------------------------
  const handelendCall = () => {
    try {
      socket.emit("call-ended", {
        to: caller?.from || selectedUser,
        name: user?.username,
      });
    } catch (err) {
      console.warn("handelendCall emit failed:", err);
    }
    endCallCleanup();
  };

  const handelrejectCall = () => {
    setRecievingCall(false);
    setCallAccepted(false);
    try {
      socket.emit("reject-call", {
        to: caller?.from,
        name: user?.username,
        profilepic: user?.profilepic,
      });
    } catch (err) {
      console.warn("handelrejectCall emit failed:", err);
    }
    endCallCleanup();
  };

  // ---------------------------
  // Mic / Cam toggles
  // ---------------------------
  const toggleMic = () => {
    if (!stream) return setIsMicOn((s) => !s);
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !isMicOn;
      setIsMicOn(audioTrack.enabled);
    }
  };

  const toggleCam = () => {
    if (!stream) return setIsCamOn((s) => !s);
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !isCamOn;
      setIsCamOn(videoTrack.enabled);
    }
  };

  // ---------------------------
  // Cleanup helper
  // ---------------------------
  const endCallCleanup = () => {
    try {
      if (stream) {
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch (e) {
            // ignore
          }
        });
      }
      if (recieverVideo.current) recieverVideo.current.srcObject = null;
      if (myVideo.current) myVideo.current.srcObject = null;
      connectionRef.current?.destroy?.();
      connectionRef.current = null;
      connection.current = null;
    } catch (err) {
      console.warn("endCallCleanup error:", err);
    } finally {
      setStream(null);
      setRecievingCall(false);
      setCallAccepted(false);
      setSelectedUser(null);
      setCaller(null);
      setCallerSignal(null);
      setShowRecieverDetailPopup(false);
    }
  };

  // ---------------------------
  // Logout
  // ---------------------------
  const handleLogout = async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch (err) {
      console.warn("logout request failed:", err);
    } finally {
      try {
        socket.off("disconnect");
        socket.disconnect?.();
      } catch (e) {}
      SocketContext.setSocket?.();
      updateUser(null);
      localStorage.removeItem("userData");
      navigate("/login");
    }
  };

  // ---------------------------
  // Filtered users
  // ---------------------------
  const filteredUsers = users.filter(
    (u) =>
      u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ---------------------------
  // Select user (open detail popup)
  // ---------------------------
  const handelSelectedUser = (userObj) => {
    setSelectedUser(userObj._id);
    setShowRecieverDetailPopup(true);
    setShowRecieverDetails(userObj);
  };

  // ---------------------------
  // Render UI (Glassmorphism)
  // ---------------------------
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800 text-white relative overflow-hidden">
      {/* decorative blurred shapes */}
      <div className="pointer-events-none absolute -top-28 -left-28 w-96 h-96 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 w-80 h-80 rounded-full bg-pink-500/10 blur-3xl" />

      {/* Sidebar */}
      <aside
        className={`fixed top-4 left-4 z-30 h-[calc(100vh-32px)] w-72 rounded-2xl border border-white/10 backdrop-blur-lg bg-white/6 p-4 transition-transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-96"
        } md:translate-x-0`}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 to-pink-300">
              LinkSpace
            </h2>
            <p className="text-xs text-white/60">Secure video calling</p>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-2 rounded-lg hover:bg-white/10"
            aria-label="close sidebar"
          >
            <FaTimes />
          </button>
        </div>

        <div className="mb-4">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-white/8 border border-white/8 placeholder-white/50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="Search contacts..."
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <ul className="space-y-2">
            {loading && (
              <li className="text-xs text-white/60">Loading contacts...</li>
            )}
            {!loading && filteredUsers.length === 0 && (
              <li className="text-xs text-white/60">No contacts found</li>
            )}
            {filteredUsers.map((u) => (
              <li
                key={u._id}
                onClick={() => handelSelectedUser(u)}
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition ${
                  selectedUser === u._id ? "bg-indigo-500/20 border border-indigo-400/10" : "hover:bg-white/6"
                }`}
              >
                <div className="relative">
                  <img
                    src={u.profilepic || "/default-avatar.png"}
                    alt={u.username}
                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                  />
                  {isOnlineUser(u._id) && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-slate-900" />
                  )}
                </div>
                <div className="truncate">
                  <div className="text-sm font-medium truncate">{u.username}</div>
                  <div className="text-xs text-white/60 truncate">{u.email}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4">
          {user && (
            <button
              onClick={handleLogout}
              className="w-full py-2 rounded-lg bg-gradient-to-r from-pink-500 to-red-500 text-sm font-semibold hover:opacity-95"
            >
              Logout
            </button>
          )}
        </div>
      </aside>

      {/* Main area */}
      <main className="ml-0 md:ml-96 transition-all min-h-screen">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-white/10"
            >
              <FaBars />
            </button>
            <div>
              <h1 className="text-xl font-semibold">Welcome, {user?.username || "Guest"}</h1>
              <p className="text-xs text-white/60">Connect with friends instantly</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-white/60 hidden sm:block">Online: {onlineUsers.length}</div>
          </div>
        </div>

        {/* Video / Welcome area */}
        <div className="p-6">
          {selectedUser || recievingCall || callAccepted ? (
            <div className="relative rounded-2xl h-[70vh] border border-white/8 overflow-hidden bg-black">
              {/* Remote stream */}
              <video
                ref={recieverVideo}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* self preview */}
              <div className="absolute right-6 bottom-6 w-40 h-56 rounded-xl overflow-hidden border border-white/10 bg-white/6 backdrop-blur-md shadow-lg">
                <video
                  ref={myVideo}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Caller label */}
              <div className="absolute left-6 top-6 bg-white/6 backdrop-blur-md border border-white/8 rounded-lg px-3 py-2">
                <div className="text-sm font-medium">{caller?.name || showRecieverDetails?.username || "Calling..."}</div>
                <div className="text-xs text-white/60">{caller?.email || showRecieverDetails?.email || ""}</div>
              </div>

              {/* Controls */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-6 flex items-center gap-4">
                <button
                  onClick={handelendCall}
                  className="p-4 rounded-full bg-red-500 hover:bg-red-600 shadow-lg"
                >
                  <FaPhoneSlash />
                </button>

                <button
                  onClick={toggleMic}
                  className={`p-3 rounded-full shadow-lg ${isMicOn ? "bg-green-500" : "bg-red-500"}`}
                >
                  {isMicOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
                </button>

                <button
                  onClick={toggleCam}
                  className={`p-3 rounded-full shadow-lg ${isCamOn ? "bg-green-500" : "bg-red-500"}`}
                >
                  {isCamOn ? <FaVideo /> : <FaVideoSlash />}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 p-8 bg-white/4 backdrop-blur-lg">
              <h2 className="text-2xl font-bold mb-2">Ready to connect</h2>
              <p className="text-sm text-white/70 mb-4">
                Select a contact from the left to start a secure peer-to-peer call.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-white/6 border border-white/6">
                  <h3 className="font-semibold">How it works</h3>
                  <ul className="text-xs text-white/60 mt-2 space-y-1">
                    <li>• Uses WebRTC for real-time audio/video</li>
                    <li>• Socket.IO is used for signaling</li>
                    <li>• Simple-Peer simplifies offers/answers</li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-white/6 border border-white/6">
                  <h3 className="font-semibold">Controls</h3>
                  <ul className="text-xs text-white/60 mt-2 space-y-1">
                    <li>• Accept/Reject on incoming calls</li>
                    <li>• Mute microphone or turn off camera</li>
                    <li>• End call to disconnect</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Receiver detail modal */}
      {showRecieverDetailPopup && showRecieverDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl p-6 bg-white/6 backdrop-blur-lg border border-white/10">
            <div className="flex flex-col items-center">
              <img
                src={showRecieverDetails.profilepic || "/default-avatar.png"}
                alt={showRecieverDetails.username}
                className="w-20 h-20 rounded-full object-cover border-2 border-white/10 mb-3"
              />
              <h3 className="text-lg font-semibold">{showRecieverDetails.username}</h3>
              <p className="text-xs text-white/60 mb-4">{showRecieverDetails.email}</p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedUser(showRecieverDetails._id);
                    startCall();
                    setShowRecieverDetailPopup(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600"
                >
                  Call
                </button>
                <button
                  onClick={() => setShowRecieverDetailPopup(false)}
                  className="px-4 py-2 rounded-lg bg-white/8"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Incoming call modal */}
      {recievingCall && !callAccepted && caller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-xl p-6 bg-white/6 backdrop-blur-lg border border-white/10">
            <div className="flex flex-col items-center">
              <p className="font-semibold mb-3">Incoming Call</p>
              <img
                src={caller.profilepic || "/default-avatar.png"}
                alt={caller.name}
                className="w-20 h-20 rounded-full mb-3 object-cover border-2 border-green-400"
              />
              <h4 className="font-semibold">{caller.name}</h4>
              <p className="text-xs text-white/60">{caller.email}</p>

              <div className="flex gap-3 mt-4">
                <button onClick={handelacceptCall} className="px-4 py-2 rounded-lg bg-green-500">
                  Accept
                </button>
                <button onClick={handelrejectCall} className="px-4 py-2 rounded-lg bg-red-500">
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Call rejected popup */}
      {callRejectedPopup && callRejectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-xl p-6 bg-white/6 backdrop-blur-lg border border-white/10">
            <div className="flex flex-col items-center">
              <p className="font-semibold mb-3">Call Rejected</p>
              <img
                src={callRejectedUser.profilepic || "/default-avatar.png"}
                alt={callRejectedUser.name}
                className="w-20 h-20 rounded-full mb-3 object-cover border-2 border-white/10"
              />
              <h4 className="font-semibold">{callRejectedUser.name}</h4>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    startCall();
                    setCallRejectedPopup(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-green-500"
                >
                  Call Again
                </button>
                <button
                  onClick={() => {
                    setCallRejectedPopup(false);
                    setShowRecieverDetailPopup(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-white/8"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
