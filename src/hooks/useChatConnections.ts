
import { useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Message } from './useChatMessages';

type UseChatConnectionsProps = {
  chatId: string;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  formatTimestamp: () => string;
};

export const useChatConnections = ({
  chatId,
  setMessages,
  setIsLoading,
  formatTimestamp
}: UseChatConnectionsProps) => {

  // Monitor new AI responses for this chat_id
  useEffect(() => {
    if (!chatId) return;

    console.log("Setting up monitoring for chat_id:", chatId);
    
    const channel = supabase
      .channel('chat-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        console.log("New message detected:", payload);
        
        // Check if message has AI response
        if (payload.new && payload.new.ai_message) {
          const aiMessage = payload.new.ai_message;
          console.log("New AI response received:", aiMessage);
          
          const responseMessage: Message = {
            id: Date.now(),
            text: aiMessage,
            isSender: false,
            timestamp: formatTimestamp()
          };
          
          setMessages(prevMessages => [...prevMessages, responseMessage]);
          setIsLoading(false);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("Successfully subscribed to Supabase channel");
        } else if (status === 'CHANNEL_ERROR') {
          console.error("Error subscribing to Supabase channel:", status);
        } else {
          console.log("Supabase channel status:", status);
        }
      });
  
    return () => {
      console.log("Removing Supabase channel");
      supabase.removeChannel(channel);
    };
  }, [chatId, setMessages, setIsLoading, formatTimestamp]);

  // Setup SSE listener for n8n responses
  useEffect(() => {
    const uniqueClientId = Date.now().toString();
    let eventSource: EventSource | null = null;
    
    const setupSSE = () => {
      console.log("Setting up SSE connection with clientId:", uniqueClientId);
      eventSource = new EventSource(`/api/chat-response?clientId=${uniqueClientId}`);
      
      eventSource.onmessage = (event) => {
        try {
          console.log("Received SSE message:", event.data);
          const data = JSON.parse(event.data);
          if (data && data.message) {
            const responseMessage: Message = {
              id: Date.now(),
              text: data.message,
              isSender: false,
              timestamp: formatTimestamp()
            };
            
            setMessages(prevMessages => [...prevMessages, responseMessage]);
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Error processing SSE response:', error);
          setIsLoading(false);
        }
      };
      
      eventSource.onerror = () => {
        console.log("SSE connection error or closed");
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
      };
    };
    
    setupSSE();
    
    return () => {
      if (eventSource) {
        console.log("Closing SSE connection");
        eventSource.close();
      }
    };
  }, [setMessages, setIsLoading, formatTimestamp]);
};
