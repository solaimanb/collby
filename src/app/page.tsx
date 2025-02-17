"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import Peer from "simple-peer";

// Use environment variable for Socket.IO server URL
const SOCKET_SERVER = process.env.NEXT_PUBLIC_SOCKET_SERVER || "http://localhost:5000";

export default function VoiceCall() {
  const [roomId, setRoomId] = useState("");
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [peerId, setPeerId] = useState("");
  const [error, setError] = useState("");

  const socketRef = useRef<any>(null); // Provide a default value
  const peerRef = useRef<any>(null); // Provide a default value
  const streamRef = useRef<MediaStream>(null); // Provide a default value

  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER);

    socketRef.current.on("room-full", () => {
      setError("Room is full. Maximum 2 participants allowed.");
    });

    socketRef.current.on("user-joined", ({ signal }) => {
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream: streamRef.current,
      });

      peer.on("signal", (data) => {
        socketRef.current.emit("returning-signal", { signal: data, roomId });
      });

      peer.on("stream", (stream) => {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.play();
      });

      peer.signal(signal);
      peerRef.current = peer;
    });

    socketRef.current.on("receiving-returned-signal", ({ signal }) => {
      peerRef.current.signal(signal);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomId]);

  const joinRoom = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream,
      });

      peer.on("signal", (data) => {
        socketRef.current.emit("join-room", { roomId, signal: data });
      });

      peer.on("stream", (stream) => {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.play();
      });

      peerRef.current = peer;
      setIsInCall(true);
      setPeerId(socketRef.current.id);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Could not access microphone. Please check permissions.");
    }
  };

  const leaveCall = () => {
    if (peerRef.current) {
      peerRef.current.destroy();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setIsInCall(false);
    setPeerId("");
    setError("");
  };

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 bg-white/10 backdrop-blur-lg border-none text-white">
        <h1 className="text-2xl font-bold text-center mb-6">Voice Call</h1>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {!isInCall ? (
          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/50"
            />
            <Button
              onClick={joinRoom}
              className="w-full bg-blue-500 hover:bg-blue-600"
              disabled={!roomId}
            >
              Join Room
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-white/70">Room ID: {roomId}</p>
              <p className="text-xs text-white/50">Share this ID with others to join</p>
            </div>
            
            <div className="flex justify-center gap-4">
              <Button
                onClick={toggleMute}
                variant="outline"
                className="bg-white/5 border-white/10 hover:bg-white/10"
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              
              <Button
                onClick={leaveCall}
                variant="destructive"
                className="bg-red-500 hover:bg-red-600"
              >
                <PhoneOff className="h-4 w-4 mr-2" />
                Leave Call
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}