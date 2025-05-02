
import React, { useState } from 'react';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatConnections } from '@/hooks/useChatConnections';

const ChatContainer = () => {
  const {
    messages,
    setMessages,
    isLoading,
    setIsLoading,
    chatId,
    messagesEndRef,
    handleSendMessage,
    formatTimestamp
  } = useChatMessages();
  
  // Setup connections
  useChatConnections({
    chatId,
    setMessages,
    setIsLoading,
    formatTimestamp
  });

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
      <ChatInput onSendMessage={handleSendMessage} isLoading={false} />
    </div>
  );
};

export default ChatContainer;
