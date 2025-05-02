
import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";

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
  
  const [chatId, setChatId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [messageQueue, setMessageQueue] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Gerar um chat_id único no primeiro carregamento
  useEffect(() => {
    const newChatId = uuidv4();
    console.log("Novo chat_id gerado:", newChatId);
    setChatId(newChatId);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
  }, [chatId]);

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
          if (isLoading) {
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
  }, []);

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

  const formatTimestamp = (): string => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  };

  const processMessage = async (text: string) => {
    setIsLoading(true);

    try {
      console.log("Sending message to n8n:", text);
      console.log("Using chat_id:", chatId);
      
      // Salvar a mensagem do usuário no Supabase primeiro
      const { error: insertError } = await supabase.from('chat').insert({
        chat_id: chatId,
        user_message: text,
        created_at: new Date().toISOString()
      });
      
      if (insertError) {
        console.error("Error saving message to Supabase:", insertError);
        toast.error("Erro ao salvar mensagem");
        setIsLoading(false);
        return;
      }
      
      console.log("Mensagem salva no Supabase com sucesso");
      
      // Enviando para n8n com o chat_id
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'no-cors', // Add no-cors mode to handle CORS issues
        body: JSON.stringify({
          message: text,
          timestamp: new Date().toISOString(),
          clientId: chatId, // Usando chat_id como clientId
          chat_id: chatId // Enviando chat_id explicitamente também
        }),
      });

      console.log("Received response from n8n webhook");
      
      // Since we're using no-cors, we'll wait for the response via Supabase realtime updates
      // The loading state will be cleared when a new AI message is detected for this chat_id
      
      // Add a fallback in case no response is received
      const fallbackTimer = setTimeout(() => {
        if (isLoading) {
          setIsLoading(false);
          toast.error("Sem resposta recebida. Por favor, tente novamente.");
          
          // Add a simulated response if we don't get one from the SSE
          const fallbackMessage: Message = {
            id: Date.now(),
            text: "Desculpe, não recebi uma resposta do servidor. Por favor, tente novamente.",
            isSender: false,
            timestamp: formatTimestamp()
          };
          
          setMessages(prevMessages => [...prevMessages, fallbackMessage]);
        }
      }, 10000); // 10 second timeout
      
      return () => clearTimeout(fallbackTimer);
      
    } catch (error) {
      console.error('Error sending message to n8n:', error);
      toast.error("Falha ao enviar mensagem. Por favor, tente novamente.");
      
      // Add a fallback response even if there's an error
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

    // Add user message
    const newMessage: Message = {
      id: messages.length + 1,
      text,
      isSender: true,
      timestamp
    };
    
    setMessages(prevMessages => [...prevMessages, newMessage]);
    
    // Add message to queue
    setMessageQueue(prevQueue => [...prevQueue, text]);
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
