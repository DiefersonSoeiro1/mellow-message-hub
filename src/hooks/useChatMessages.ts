
import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";

export type Message = {
  id: number;
  text: string;
  isSender: boolean;
  timestamp: string;
};

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
      
      // Enviando para n8n com o chat_id, texto e timestamp
      const timestamp = new Date().toISOString();
      const N8N_WEBHOOK_URL = 'https://n8n.crisdulabs.com.br/webhook/conversar-com-bot';
      
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'no-cors',
        body: JSON.stringify({
          message: text,
          timestamp: timestamp,
          clientId: chatId, // Mantendo para compatibilidade
          chat_id: chatId // Enviando chat_id explicitamente
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

  return {
    messages,
    isLoading,
    chatId,
    messagesEndRef,
    handleSendMessage,
    formatTimestamp
  };
};
