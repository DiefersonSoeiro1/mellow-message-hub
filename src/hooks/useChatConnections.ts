
import { useEffect } from 'react';
import { toast } from 'sonner';
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

  // Monitorar novas respostas de AI para este chat_id
  useEffect(() => {
    if (!chatId) return;

    console.log("Configurando monitoramento para chat_id:", chatId);
    
    const channel = supabase
      .channel('chat-updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat',
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        console.log("Nova mensagem detectada:", payload);
        
        // Verificar se a mensagem tem uma resposta de AI
        if (payload.new && payload.new.ai_message) {
          const aiMessage = payload.new.ai_message;
          console.log("Nova resposta de AI recebida:", aiMessage);
          
          const responseMessage: Message = {
            id: Date.now(),
            text: aiMessage,
            isSender: false,
            timestamp: formatTimestamp()
          };
          
          setMessages(prevMessages => [...prevMessages, responseMessage]);
          setIsLoading(false);
          toast.success("Resposta recebida!");
        }
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, setMessages, setIsLoading, formatTimestamp]);

  // Setup SSE listener for n8n responses
  useEffect(() => {
    const uniqueClientId = Date.now().toString();
    let eventSource: EventSource | null = null;
    
    try {
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
            toast.success("Response received!");
          }
        } catch (error) {
          console.error('Error processing SSE response:', error);
          toast.error("Error processing response from n8n");
          setIsLoading(false);
        }
      };
      
      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        
        // Don't automatically close the connection, just reconnect
        if (eventSource?.readyState === EventSource.CLOSED) {
          setTimeout(() => {
            // Attempt to reconnect
            if (eventSource) {
              eventSource.close();
            }
            // Create a new EventSource instance
            eventSource = new EventSource(`/api/chat-response?clientId=${uniqueClientId}`);
          }, 3000); // Try reconnecting after 3 seconds
        }
        
        // Only set loading to false if it's been more than 10 seconds
        setTimeout(() => {
          if (setIsLoading) {
            setIsLoading(false);
            toast.error("Lost connection to server");
          }
        }, 10000);
      };
    } catch (error) {
      console.error('Error setting up EventSource:', error);
      toast.error("Failed to connect to the server");
      setIsLoading(false);
    }
    
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [setMessages, setIsLoading, formatTimestamp]);
};
