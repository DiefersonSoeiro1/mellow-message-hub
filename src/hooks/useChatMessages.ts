
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
      
      // Try to save user message in Supabase, but don't block if it fails
      try {
        const { error: insertError } = await supabase.from('chat').insert({
          chat_id: chatId,
          user_message: text,
          created_at: new Date().toISOString()
        });
        
        if (insertError) {
          console.error("Error saving message to Supabase:", insertError);
          // Continue execution even if Supabase insert fails
        } else {
          console.log("Message saved to Supabase successfully");
        }
      } catch (supabaseError) {
        console.error("Failed to connect to Supabase:", supabaseError);
        // Continue execution even if Supabase connection fails
      }
      
      // Always send to n8n regardless of Supabase status
      const timestamp = new Date().toISOString();
      const N8N_WEBHOOK_URL = 'https://n8n.crisdulabs.com.br/webhook/conversar-com-bot';
      
      try {
        await fetch(N8N_WEBHOOK_URL, {
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

        console.log("Request sent to n8n webhook");
        
        // Since we're using no-cors, we won't get a meaningful status code
        // The response will be handled via SSE or Supabase subscription
        // Don't set isLoading to false here, it will be set when a response is received
        
      } catch (n8nError) {
        console.error('Error sending message to n8n:', n8nError);
        setIsLoading(false);
        
        // Add a fallback response if n8n request fails
        setTimeout(() => {
          const fallbackMessage: Message = {
            id: Date.now(),
            text: "Desculpe, estou tendo problemas para processar sua mensagem. Por favor, tente novamente mais tarde.",
            isSender: false,
            timestamp: formatTimestamp()
          };
          
          setMessages(prevMessages => [...prevMessages, fallbackMessage]);
        }, 1000);
      }
      
      // Set a fallback timer for 15 seconds if no response is received
      const fallbackTimer = setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
          
          const fallbackMessage: Message = {
            id: Date.now(),
            text: "Não recebi resposta do servidor a tempo. Por favor, tente novamente.",
            isSender: false,
            timestamp: formatTimestamp()
          };
          
          setMessages(prevMessages => [...prevMessages, fallbackMessage]);
        }
      }, 15000);
      
      return () => clearTimeout(fallbackTimer);
      
    } catch (error) {
      console.error('Error in processMessage:', error);
      
      setTimeout(() => {
        const errorResponseMessage: Message = {
          id: Date.now(),
          text: "Estou com problemas para me conectar no momento. Por favor, tente novamente mais tarde.",
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
