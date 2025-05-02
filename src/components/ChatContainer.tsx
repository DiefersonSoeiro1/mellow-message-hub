
import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';

type Message = {
  id: number;
  text: string;
  isSender: boolean;
  timestamp: string;
};

const ChatContainer = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello there! 👋",
      isSender: false,
      timestamp: "10:01 AM"
    },
    {
      id: 2,
      text: "Welcome to our simple chat app! How can I help you today?",
      isSender: false,
      timestamp: "10:02 AM"
    }
  ]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (text: string) => {
    // Get current time
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const timestamp = `${formattedHours}:${formattedMinutes} ${ampm}`;

    // Add user message
    const newMessage: Message = {
      id: messages.length + 1,
      text,
      isSender: true,
      timestamp
    };
    
    setMessages(prevMessages => [...prevMessages, newMessage]);

    // Simulate response after a short delay
    setTimeout(() => {
      const responses = [
        "That's interesting!",
        "Tell me more about that.",
        "I understand what you mean.",
        "Great to hear from you!",
        "Thanks for your message.",
        "I'm here to help if you need anything.",
      ];
      
      const responseMessage: Message = {
        id: messages.length + 2,
        text: responses[Math.floor(Math.random() * responses.length)],
        isSender: false,
        timestamp: `${formattedHours}:${formattedMinutes + 1} ${ampm}`
      };
      
      setMessages(prevMessages => [...prevMessages, responseMessage]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full bg-chat-bg overflow-hidden">
      <div className="p-4 bg-background border-b flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-green-500"></div>
        <h2 className="font-semibold">Chat</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message.text}
            isSender={message.isSender}
            timestamp={message.timestamp}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSendMessage={handleSendMessage} />
    </div>
  );
};

export default ChatContainer;
