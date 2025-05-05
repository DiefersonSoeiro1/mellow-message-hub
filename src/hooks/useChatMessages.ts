
import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";

// Define formatTimestamp function before it's used
const formatTimestamp = (): string => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const formattedHours = hours % 12 || 12;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
  return `${formattedHours}:${formattedMinutes} ${ampm}`;
};

export type Message = {
  id: number;
  text: string;
  isSender: boolean;
  timestamp: string;
};

export const useChatMessages = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Olá, como posso te ajudar hoje?",
      isSender: false,
      timestamp: formatTimestamp()
    }
  ]);
  
  const [chatId, setChatId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate a unique chat_id on first load
  useEffect(() => {
    const newChatId = uuidv4();
    console.log("New chat_id generated:", newChatId);
    setChatId(newChatId);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const processMessage = async (text: string) => {
    setIsLoading(true);
    
    console.log("Sending message to n8n:", text);
    console.log("Using chat_id:", chatId);
    
    // Try to save user message in Supabase
    try {
      await supabase.from('chat').insert({
        chat_id: chatId,
        user_message: text,
        created_at: new Date().toISOString()
      });
      console.log("Message saved to Supabase successfully");
    } catch (error) {
      console.error("Failed to save message to Supabase:", error);
      // Continue even if Supabase fails
    }
    
    // Send to n8n
    try {
      const N8N_WEBHOOK_URL = 'https://n8n.crisdulabs.com.br/webhook/conversar-com-bot';
      await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'no-cors',
        body: JSON.stringify({
          message: text,
          timestamp: new Date().toISOString(),
          clientId: chatId,
          chat_id: chatId
        }),
      });

      console.log("Request sent to n8n webhook");
      // Response will be handled via SSE or Supabase subscription
      
    } catch (error) {
      console.error('Error sending message to n8n:', error);
      setIsLoading(false);
    }
    
    // Set a timeout for 30 seconds in case no response is received
    setTimeout(() => {
      if (isLoading) {
        console.log("No response received within timeout period");
        setIsLoading(false);
      }
    }, 30000);
  };

  const handleSendMessage = (text: string) => {
    // Add user message to UI
    const newMessage: Message = {
      id: Date.now(),
      text,
      isSender: true,
      timestamp: formatTimestamp()
    };
    
    setMessages(prevMessages => [...prevMessages, newMessage]);
    processMessage(text);
  };

  return {
    messages,
    setMessages,
    isLoading,
    setIsLoading,
    chatId,
    messagesEndRef,
    handleSendMessage,
    formatTimestamp
  };
};
