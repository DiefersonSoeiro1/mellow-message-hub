
import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { toast } from 'sonner';

type Message = {
  id: number;
  text: string;
  isSender: boolean;
  timestamp: string;
};

const N8N_WEBHOOK_URL = 'https://n8n.crisdulabs.com.br/webhook/conversar-com-bot';

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
  
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTimestamp = (): string => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  };

  const handleSendMessage = async (text: string) => {
    // Current timestamp
    const timestamp = formatTimestamp();

    // Add user message
    const newMessage: Message = {
      id: messages.length + 1,
      text,
      isSender: true,
      timestamp
    };
    
    setMessages(prevMessages => [...prevMessages, newMessage]);
    setIsLoading(true);

    try {
      console.log("Sending message to n8n:", text);
      
      // Send message to n8n webhook with mode: 'no-cors' to avoid CORS issues
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'no-cors', // Add no-cors mode to handle CORS issues
        body: JSON.stringify({
          message: text,
          timestamp: new Date().toISOString(),
        }),
      });

      console.log("Received response from n8n webhook");
      
      // Since we're using no-cors, we won't be able to access the response status or body
      // We'll need to hardcode a response for now
      setTimeout(() => {
        const botResponse = "Thank you for your message! This is a simulated response since we're using no-cors mode.";
        const responseMessage: Message = {
          id: messages.length + 2,
          text: botResponse,
          isSender: false,
          timestamp: formatTimestamp()
        };
        
        setMessages(prevMessages => [...prevMessages, responseMessage]);
        setIsLoading(false);
        toast.success("Message sent successfully!");
      }, 1000);
      
    } catch (error) {
      console.error('Error sending message to n8n:', error);
      toast.error("Failed to send message. Please try again.");
      
      // Add a fallback response even if there's an error
      setTimeout(() => {
        const errorResponseMessage: Message = {
          id: messages.length + 2,
          text: "I'm having trouble connecting right now. Please try again later.",
          isSender: false,
          timestamp: formatTimestamp()
        };
        
        setMessages(prevMessages => [...prevMessages, errorResponseMessage]);
        setIsLoading(false);
      }, 1000);
    }
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
        {isLoading && (
          <div className="flex w-full justify-start mb-2">
            <div className="bg-receiver-bubble text-receiver-text px-4 py-2 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
};

export default ChatContainer;
