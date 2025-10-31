import React, { useEffect, useRef, useState } from "react";
import { useUser } from "../../context/UserContextApi";
import { useNavigate } from "react-router-dom";
import { FaBars, FaDoorClosed, FaMicrophone, FaMicrophoneSlash, FaPhoneAlt, FaPhoneSlash, FaTimes, FaVideo } from "react-icons/fa";
import apiClient from "../../apiClient";
import SocketContext from "../socket/SocketContext";
import Peer from "simple-peer";
import { ref } from "process";

const Dashboard = () => {
  const { user, updateUser } = useUser();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [me, setMe] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showRecieverDetailPopup, setShowRecieverDetailPopup] = useState(false);
  const [showRecieverDetails, setShowRecieverDetails] = useState(null);
  const connectionRef = useRef(); //current user peer ref
  const [recievingCall, setRecievingCall] = useState(false);
  const [caller, setCaller] = useState(null);
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [callRejectedPopup,setCallRejectedPopup]=useState(false)
  const [callRejectedUser,setCallRejectedUser]=useState(null)

  const hasJoined = useRef(false);
  const myVideo = useRef();
  const recieverVideo=useRef()
  const [stream, setStream] = useState();

  // State to track microphone & video status
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);

  const socket = SocketContext.getSocket();
  // console.log(socket);
  useEffect(() => {
    if (user && socket && !hasJoined.current) {
      socket.emit("join", { id: user._id, name: user.username });
      hasJoined.current = true;
    }
    socket.on("me", (id) => setMe(id));
    socket.on("online-users", (onlineUser) => {
      setOnlineUsers(onlineUser);
    });
    socket.on("callToUser", (data) => {
      setRecievingCall(true);
      setCaller(data);
      setCallerSignal(data.signal); 
    });
    socket.on("callEnded",(data)=>{
      endCallCleanup()
    })
    socket.on("callRejected",(data)=>{
      setCallRejectedPopup(true);
      setCallRejectedUser(data)
    })
    return () => {
      socket.off("me");
      socket.off("online-users");
      socket.off("callToUser");
      socket.off("callEnded");
      socket.off("callRejected");
    };
  }, [user, socket]);

  const allusers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/user");
      if (response.data.success !== false) {
        setUsers(response.data.users);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    allusers();
  }, []);
  const isOnlineUser = (userId) => onlineUsers.some((u) => u.userId === userId);

  const startCall = async () => {
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true, //speaker noise not get
          noiseSuppression: true, // background noise will not come
        },
      });
      setStream(currentStream);
      if (myVideo.current) {
        myVideo.current.srcObject = currentStream; //putting our current stream inside it
        myVideo.current.muted = true;
        myVideo.current.volume = 0;
      }
      //ensure that audio track is enabled
      currentStream.getAudioTracks().forEach((track) => (track.enabled = true));
      setIsSidebarOpen(false);
      setCallRejectedPopup(false)
      setSelectedUser(showRecieverDetails._id)

      const peer = new Peer({
        initiator: true, //user start a call
        trickle: false, //ensuring a single signal exchange
        stream: currentStream, // attach our local media to the stream
      });
      //handle the "signal" event (this occurs when the webrtc handshake is initiated)
      peer.on("signal", (data) => {
        //emit a callToUser event to the server with necessary call details
        socket.emit("callToUser", {
          callToUserId: showRecieverDetails._id,
          signalData: data,
          from: me,
          name: user.username,
          email: user.email,
          profilepic: user.profilepic,
        });
      });
      peer.on("stream",(remoteStream)=>{
        if(recieverVideo.current){
          recieverVideo.current.srcObject=remoteStream;
          recieverVideo.current.muted=false;
          recieverVideo.current.volume=1.0;
        }
      })
      socket.on("callAccepted",(data)=>{
        setCallRejectedPopup(false);
        setCallAccepted(true)
        // setCaller(data.from);
        setCaller((prev) => ({ ...prev, from: data.from }))
        peer.signal(data.signal)
      })
      //it will store the peer connection to manage it later like to end a call
      connectionRef.current = peer;
      setShowRecieverDetailPopup(false)
    } catch (error) {
      console.log("error occuring");
    }
  };

  const handelacceptCall=async()=>{
    try {
      const currentStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: {
          echoCancellation: true, //speaker noise not get
          noiseSuppression: true, // background noise will not come
        },
      });
      setStream(currentStream);
      if(myVideo.current){
        myVideo.current.srcObject = currentStream; //putting our current stream inside it
        myVideo.current.muted = true;
        myVideo.current.volume = 0;
      }
      currentStream.getAudioTracks().forEach((track) => (track.enabled = true));
      setCallAccepted(true)
      setRecievingCall(true);
      setIsSidebarOpen(false)
      const peer = new Peer({
        initiator: false, //user not the call initiator
        trickle: false, //ensuring a single signal exchange
        stream: currentStream, // attach our local media to the stream
      });
      peer.on("signal",(data)=>{
        socket.emit("answeredCall",{
          signal:data,
          from:me,
          to:caller?.from || caller?.socketId,
        })
      })
      peer.on("stream",(remoteStream)=>{
        if(recieverVideo.current){
          recieverVideo.current.srcObject=remoteStream;
          recieverVideo.current.muted=false;
          recieverVideo.current.volume=1.0;
        }
      })

      if(callerSignal) peer.signal(callerSignal);
      connectionRef.current=peer;
    } catch (error) {
      console.log("error occuring",error);
    }
  }

  const handelendCall=()=>{
    socket.emit("call-ended",{
      to:caller.from || selectedUser._id,
      name:user.username
    })
    endCallCleanup()
  }

  const handelrejectCall=()=>{
    setRecievingCall(false)
    setCallAccepted(false)
    socket.emit("reject-call",{
      to:caller.from,
      name:user.username,
      profilepic:user.profilepic
    })
    endCallCleanup()
  }

   const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicOn;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleCam = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isCamOn;
        setIsCamOn(videoTrack.enabled);
      }
    }
  };

  const endCallCleanup=()=>{
    if(stream){
      stream.getTracks().forEach((track)=>track.stop())
    }
      if(recieverVideo.current){
        recieverVideo.current.srcObject=null;
      }
      if(myVideo.current){
        myVideo.current.srcObject=null;
      }
      connectionRef.current?.destroy()
      setStream(null)
      setRecievingCall(false);
      setCallAccepted(false)
      setSelectedUser(null)
  }

  const handleLogout = async () => {
    // if (callAccepted || reciveCall) {
    //   alert("You must end the call before logging out.");
    //   return;
    // }
    try {
      await apiClient.post("/auth/logout");
      socket.off("disconnect");
      socket.disconnect();
      // socketInstance.setSocket();
      SocketContext.setSocket();
      updateUser(null);
      localStorage.removeItem("userData");
      navigate("/login");
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handelSelectedUser = (user) => {
    // if (callAccepted || reciveCall) {
    //   alert("You must end the current call before starting a new one.");
    //   return;
    // }
    // const selected = filteredUsers.find((user) => user._id === user._id);
    setSelectedUser(user._id);
    // setshowRecieverDetails(selected);
    // setShowUserDetailModal(true);
    setShowRecieverDetailPopup(true);
    setShowRecieverDetails(user);
  };
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-10 md:hidden bg-black/40"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      {/* Sidebar */}
      <aside
        className={`bg-white text-gray-800 w-64 h-full p-4 space-y-4 fixed z-20 shadow-xl border-r border-gray-200 transition-transform ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold text-indigo-600">Chat App</h1>
          <button
            type="button"
            className="md:hidden text-gray-600 hover:text-indigo-600"
            onClick={() => setIsSidebarOpen(false)}
          >
            <FaTimes />
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search user..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 rounded-md bg-gray-100 text-gray-700 border border-gray-300 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
        />

        {/* User List */}
        <ul className="space-y-3 overflow-y-auto h-[70vh]">
          {filteredUsers.map((user) => (
            <li
              key={user._id}
              className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all duration-200 ${
                selectedUser === user._id
                  ? "bg-indigo-100 border border-indigo-400"
                  : "hover:bg-gray-100"
              }`}
              onClick={() => handelSelectedUser(user)}
            >
              <div className="relative">
                <img
                  src={user.profilepic || "/default-avatar.png"}
                  alt={`${user.username}'s profile`}
                  className="w-10 h-10 rounded-full border border-gray-300 object-cover"
                />
                {isOnlineUser(user._id) && (
                  <span className="absolute top-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-800 rounded-full shadow-lg animate-bounce"></span>
                )}
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-sm text-gray-900">
                  {user.username}
                </span>
                <span className="text-xs text-gray-500 truncate w-32">
                  {user.email}
                </span>
              </div>
            </li>
          ))}
        </ul>

        {/* Logout */}
        {user && (
          <div
            onClick={handleLogout}
            className="absolute bottom-3 left-4 right-4 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-900 text-white px-4 py-2 cursor-pointer rounded-md transition-colors duration-200"
          >
            Logout
          </div>
        )}
      </aside>
      {/* Welcome */}
      {selectedUser || recievingCall || callAccepted ? (
        <div className="relative w-full h-screen bg-black flex items-center justify-center">
          
          <video ref={recieverVideo} autoPlay className="absolute top-0 left-0 w-full h-full object-contain rounded-lg"></video>
          <div className="absolute bottom-[75px] md:buttom-0 right-1 bg-gray-900 rounded-lg overflow-hidden shadow-lg">
            <video
              ref={myVideo}
              autoPlay
              playsInline
              className="w-32 h-40 md:w-56 md:h-52 object-cover rounded-lg"
            ></video>
          </div>
           <div className="absolute top-4 left-4 text-white text-lg font-bold flex gap-2 items-center">
            <button
              type="button"
              className="md:hidden text-2xl text-white cursor-pointer"
              onClick={() => setIsSidebarOpen(true)}
            >
              <FaBars />
            </button>
            {caller?.username || "Caller"}
          </div>

          {/* Call Controls */}
          <div className="absolute bottom-4 w-full flex justify-center gap-4">
            <button
              type="button"
              className="bg-red-600 p-4 rounded-full text-white shadow-lg cursor-pointer"
              onClick={handelendCall}
            >
              <FaPhoneSlash size={24} />
            </button>
            {/* 🎤 Toggle Mic */}
            <button
              type="button"
              onClick={toggleMic}
              className={`p-4 rounded-full text-white shadow-lg cursor-pointer transition-colors ${isMicOn ? "bg-green-600" : "bg-red-600"
                }`}
            >
              {isMicOn ? <FaMicrophone size={24} /> : <FaMicrophoneSlash size={24} />}
            </button>

            {/* 📹 Toggle Video */}
            <button
              type="button"
              onClick={toggleCam}
              className={`p-4 rounded-full text-white shadow-lg cursor-pointer transition-colors ${isCamOn ? "bg-green-600" : "bg-red-600"
                }`}
            >
              {isCamOn ? <FaVideo size={24} /> : <FaVideoSlash size={24} />}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 p-6 md:ml-72 text-white">
          {/* Mobile Sidebar Toggle */}
          <button
            type="button"
            className="md:hidden text-2xl text-black mb-4"
            onClick={() => setIsSidebarOpen(true)}
          >
            <FaBars />
          </button>
          <div className="flex items-center gap-5 mb-6 bg-gray-800 p-5 rounded-xl shadow-md">
            <div className="w-20 h-20">👋</div>
            <div>
              <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
                Hey {user?.username || "Guest"}! 👋
              </h1>
              <p className="text-lg text-gray-300 mt-2">
                Ready to <strong>connect with friends instantly?</strong>
                Just <strong>select a user</strong> and start your video call!
                🎥✨
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gray-800 p-4 rounded-lg shadow-lg text-sm">
            <h2 className="text-lg font-semibold mb-2">
              💡 How to Start a Video Call?
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-gray-400">
              <li>📌 Open the sidebar to see online users.</li>
              <li>🔍 Use the search bar to find a specific person.</li>
              <li>🎥 Click on a user to start a video call instantly!</li>
            </ul>
          </div>
        </div>
      )}
      {showRecieverDetailPopup && showRecieverDetails && (
        <div className="fixed inset-0 bg-transparent bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex flex-col items-center">
              <p className="font-black text-xl mb-2">User Details</p>
              <img
                src={showRecieverDetails?.profilepic || "/default-avatar.png"}
                alt="User"
                className="w-20 h-20 rounded-full border-4 border-blue-500"
              />
              <h3 className="text-lg font-bold mt-3">
                {showRecieverDetails?.username}
              </h3>
              <p className="text-sm text-gray-500">
                {showRecieverDetails?.email}
              </p>

              <div className="flex gap-4 mt-5">
                <button
                  onClick={() => {
                    setSelectedUser(showRecieverDetails._id);
                    startCall();
                    setShowRecieverDetailPopup(false);
                  }}
                  className="bg-green-600 text-white px-4 py-1 rounded-lg w-28 flex items-center gap-2 justify-center"
                >
                  Call
                </button>
                <button
                  onClick={() => setShowRecieverDetailPopup(false)}
                  className="bg-gray-400 text-white px-4 py-1 rounded-lg w-28"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {recievingCall && !callAccepted && (
        <div className="fixed inset-0 bg-transparent bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex flex-col items-center">
              <p className="font-black text-xl mb-2">Call From...</p>
              <img
                src={caller?.profilepic || "/default-avatar.png"}
                alt="Caller"
                className="w-20 h-20 rounded-full border-4 border-green-500"
              />
              <h3 className="text-lg font-bold mt-3">{caller?.name}</h3>
              <p className="text-sm text-gray-500">{caller?.email}</p>
              <div className="flex gap-4 mt-5">
                <button
                  type="button"
                  onClick={handelacceptCall}
                  className="bg-green-500 text-white px-4 py-1 rounded-lg w-28 flex gap-2 justify-center items-center"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={handelrejectCall}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg w-28 flex gap-2 justify-center items-center"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {callRejectedPopup && (
        <div className="fixed inset-0 bg-transparent bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <div className="flex flex-col items-center">
              <p className="font-black text-xl mb-2">Call Rejected From...</p>
              <img
                src={callRejectedUser.profilepic || "/default-avatar.png"}
                alt="Caller"
                className="w-20 h-20 rounded-full border-4 border-green-500"
              />
              <h3 className="text-lg font-bold mt-3">{callRejectedUser.name}</h3>
              <div className="flex gap-4 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    startCall(); // function that handles media and calling
                  }}
                  className="bg-green-500 text-white px-4 py-1 rounded-lg w-28 flex gap-2 justify-center items-center"
                >
                  Call Again
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // endCallCleanup();
                    setCallRejectedPopup(false);
                    setShowRecieverDetailPopup(false);
                  }}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg w-28 flex gap-2 justify-center items-center"
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
