"use client";
import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter, useSearchParams } from "next/navigation";

interface ChatMessage {
  sender: string;
  text: string;
  timestamp?: string;
}

export default function ChatPageContent() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get URL parameters
  const roomId = searchParams.get("roomId");
  const username = searchParams.get("username");
  const role = searchParams.get("role");

  useEffect(() => {
    if (!roomId || !username || !role) {
      router.push("/");
      return;
    }

    // Create socket connection
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_SERVER, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    // Connect and join room
    socket.on("connect", () => {
      console.log("Connected to server");
      socket.emit("join-chat-room", { roomId, username, role });
    });

    // Handle connection errors
    socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      setError("Failed to connect to chat server");
    });

    // Handle received messages
    socket.on("receive-message", (message: ChatMessage) => {
      console.log("Received message:", message);
      setMessages((prev) => [...prev, message]);
    });

    // Handle user joined events
    socket.on("user-joined", ({ username: joinedUser, role: userRole }) => {
      console.log("User joined:", joinedUser, userRole);
      setMessages((prev) => [
        ...prev,
        {
          sender: "System",
          text: `${joinedUser} (${userRole}) joined the room`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    });

    // Handle room full error
    socket.on("room-full", () => {
      setError("Room is full. Maximum 2 participants allowed.");
    });

    // Cleanup on unmount
    return () => {
      console.log("Disconnecting socket");
      socket.disconnect();
    };
  }, [roomId, username, role]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && roomId && socketRef.current?.connected) {
      console.log("Sending message:", message);
      socketRef.current.emit("send-message", {
        roomId,
        message: {
          text: message,
        },
      });
      setMessage("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md p-6 bg-white/10 backdrop-blur-lg border-none rounded-lg text-white">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Room: {roomId}</h2>
          <span className="text-sm text-white/70">
            {username} ({role})
          </span>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="h-96 overflow-y-auto mb-4 rounded bg-white/5 p-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`mb-3 ${msg.sender === username ? "text-right" : ""} ${
                msg.sender === "System"
                  ? "text-center text-white/50 italic"
                  : ""
              }`}
            >
              {msg.sender !== "System" && (
                <div className="text-sm text-white/70 mb-1">
                  {msg.sender} • {msg.timestamp}
                </div>
              )}
              <div
                className={`inline-block rounded-lg px-4 py-2 ${
                  msg.sender === "System"
                    ? "bg-transparent"
                    : msg.sender === username
                    ? "bg-blue-500"
                    : "bg-white/10"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2 rounded bg-white/5 border border-white/10 text-white placeholder:text-white/50"
          />
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={!message.trim() || !socketRef.current?.connected}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}