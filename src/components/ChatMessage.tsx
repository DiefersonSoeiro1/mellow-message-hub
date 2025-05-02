
import React from 'react';
import { cn } from '@/lib/utils';

type ChatMessageProps = {
  message: string;
  isSender: boolean;
  timestamp: string;
};

const ChatMessage = ({ message, isSender, timestamp }: ChatMessageProps) => {
  return (
    <div className={cn(
      "flex w-full mb-2 message-animation",
      isSender ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "max-w-[80%] px-4 py-2 rounded-2xl shadow-sm",
        isSender
          ? "bg-sender-bubble text-foreground rounded-tr-none"
          : "bg-receiver-bubble text-receiver-text rounded-tl-none"
      )}>
        <p className="break-words">{message}</p>
        <div className={cn(
          "text-xs mt-1 text-right",
          isSender ? "text-muted-foreground" : "text-receiver-text/80"
        )}>
          {timestamp}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
