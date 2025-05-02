
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

import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";

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
  const [messageQueue, setMessageQueue] = useState<string[]>([]);
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

  // Process message queue
  useEffect(() => {
    if (messageQueue.length > 0 && !isLoading) {
      const nextMessage = messageQueue[0];
      const newQueue = messageQueue.slice(1);
      setMessageQueue(newQueue);
      
      // Process the message
      processMessage(nextMessage);
    }
  }, [messageQueue, isLoading]);

  const processMessage = async (text: string) => {
    setIsLoading(true);

    try {
      console.log("Sending message to n8n:", text);
      console.log("Using chat_id:", chatId);
      
      // Save user message in Supabase first
      const { error: insertError } = await supabase.from('chat').insert({
        chat_id: chatId,
        user_message: text,
        created_at: new Date().toISOString()
      });
      
      if (insertError) {
        console.error("Error saving message to Supabase:", insertError);
        setIsLoading(false);
        return;
      }
      
      console.log("Message saved to Supabase successfully");
      
      // Send to n8n with chat_id, text and timestamp
      const timestamp = new Date().toISOString();
      const N8N_WEBHOOK_URL = 'teste123';
      
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'no-cors',
        body: JSON.stringify({
          message: text,
          timestamp: timestamp,
          clientId: chatId, 
          chat_id: chatId
        }),
      });

      console.log("Received response from n8n webhook");
      
      // Fallback timer if no response is received
      const fallbackTimer = setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
          
          const fallbackMessage: Message = {
            id: Date.now(),
            text: "Sorry, I didn't receive a response from the server. Please try again.",
            isSender: false,
            timestamp: formatTimestamp()
          };
          
          setMessages(prevMessages => [...prevMessages, fallbackMessage]);
        }
      }, 15000); // 15 second timeout
      
      return () => clearTimeout(fallbackTimer);
      
    } catch (error) {
      console.error('Error sending message to n8n:', error);
      
      setTimeout(() => {
        const errorResponseMessage: Message = {
          id: Date.now(),
          text: "I'm having trouble connecting right now. Please try again later.",
          isSender: false,
          timestamp: formatTimestamp()
        };
        
        setMessages(prevMessages => [...prevMessages, errorResponseMessage]);
        setIsLoading(false);
      }, 1000);
    }
  };

  const handleSendMessage = (text: string) => {
    // Current timestamp
    const timestamp = formatTimestamp();

    // Add user message to UI
    const newMessage: Message = {
      id: Date.now(),
      text,
      isSender: true,
      timestamp
    };
    
    setMessages(prevMessages => [...prevMessages, newMessage]);
    
    // Add message to processing queue
    setMessageQueue(prevQueue => [...prevQueue, text]);
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
