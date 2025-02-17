"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";

// Use environment variable for Socket.IO server URL
const SOCKET_SERVER = process.env.NEXT_PUBLIC_SOCKET_SERVER;

export default function VoiceCall() {
  const [roomId, setRoomId] = useState<string>("");
  const [isInCall, setIsInCall] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const socketRef = useRef<Socket | null>(null);
  const peerRef = useRef<Peer.Instance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current.on("connect", () => {
      console.log("Socket connected");
    });

    socketRef.current.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
      setError("Failed to connect to the server. Please try again later.");
    });

    socketRef.current.on("reconnect", () => {
      console.log("Socket reconnected");
    });

    socketRef.current.on("room-full", () => {
      setError("Room is full. Maximum 2 participants allowed.");
    });

    socketRef.current.on(
      "user-joined",
      ({ signal }: { signal: Peer.SignalData }) => {
        if (streamRef.current) {
          const peer = new Peer({
            initiator: false,
            trickle: false,
            stream: streamRef.current,
            config: {
              iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                {
                  urls: "relay1.expressturn.com:3478",
                  username: "efQZWEG6AZABVUX9JK",
                  credential: "9KyTq00gxMPtl3DV",
                },
              ],
            },
          });

          peer.on("signal", (data: Peer.SignalData) => {
            socketRef.current?.emit("returning-signal", {
              signal: data,
              roomId,
            });
          });

          peer.on("stream", (stream: MediaStream) => {
            const audio = new Audio();
            audio.srcObject = stream;
            audio.play();
          });

          peer.signal(signal);
          peerRef.current = peer;
        } else {
          setError("Local stream is not available.");
        }
      }
    );

    socketRef.current.on(
      "receiving-returned-signal",
      ({ signal }: { signal: Peer.SignalData }) => {
        if (peerRef.current) {
          peerRef.current.signal(signal);
        }
      }
    );

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
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun.services.mozilla.com" },
            { urls: "stun:stun.stunprotocol.org:3478" },
          ],
        },
      });

      peer.on("signal", (data: Peer.SignalData) => {
        socketRef.current?.emit("join-room", { roomId, signal: data });
      });

      peer.on("stream", (stream: MediaStream) => {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.play();
      });

      peerRef.current = peer;
      setIsInCall(true);
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
              <p className="text-xs text-white/50">
                Share this ID with others to join
              </p>
            </div>

            <div className="flex justify-center gap-4">
              <Button
                onClick={toggleMute}
                variant="outline"
                className="bg-white/5 border-white/10 hover:bg-white/10"
              >
                {isMuted ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
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
