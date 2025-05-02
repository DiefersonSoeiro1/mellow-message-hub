
import React from 'react';
import ChatContainer from '@/components/ChatContainer';

const Index = () => {
  return (
    <div className="min-h-screen flex justify-center bg-slate-50">
      <div className="w-full max-w-md h-screen sm:h-[600px] sm:my-8 sm:rounded-xl sm:shadow-lg overflow-hidden bg-white">
        <ChatContainer />
      </div>
    </div>
  );
};

export default Index;
