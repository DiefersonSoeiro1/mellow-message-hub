
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
    
    try {
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
            
            // Use function form to ensure we update based on latest state
            setMessages(prevMessages => [...prevMessages, responseMessage]);
            setIsLoading(false);
          }
        })
        .subscribe(error => {
          if (error) {
            console.error("Error subscribing to Supabase channel:", error);
          } else {
            console.log("Successfully subscribed to Supabase channel");
          }
        });
    
      return () => {
        console.log("Removing Supabase channel");
        supabase.removeChannel(channel);
      };
    } catch (error) {
      console.error("Failed to set up Supabase subscription:", error);
    }
  }, [chatId, setMessages, setIsLoading, formatTimestamp]);

  // Setup SSE listener for n8n responses
  useEffect(() => {
    const uniqueClientId = Date.now().toString();
    let eventSource: EventSource | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    const setupSSE = () => {
      try {
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
              
              // Use function form to ensure we update based on latest state
              setMessages(prevMessages => [...prevMessages, responseMessage]);
              setIsLoading(false);
            }
          } catch (error) {
            console.error('Error processing SSE response:', error);
            setIsLoading(false);
          }
        };
        
        eventSource.onerror = (error) => {
          console.error('SSE connection error:', error);
          
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          
          // Only attempt to reconnect if under max attempts
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Attempting to reconnect SSE (${reconnectAttempts}/${maxReconnectAttempts})...`);
            setTimeout(setupSSE, 3000); // Try reconnecting after 3 seconds
          } else {
            console.error(`Max reconnect attempts (${maxReconnectAttempts}) reached. Giving up on SSE connection.`);
          }
        };
      } catch (error) {
        console.error('Error setting up EventSource:', error);
        setIsLoading(false);
      }
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
