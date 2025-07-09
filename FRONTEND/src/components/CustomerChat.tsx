import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, RefreshCw, LogOut, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { chatApi } from '@/utils/api';
import { sessionStorage } from '@/utils/storage';
import { ChatMessage } from '@/types/api';
import { useToast } from '@/hooks/use-toast';

interface CustomerChatProps {
  onLogout: () => void;
}

const CustomerChat: React.FC<CustomerChatProps> = ({ onLogout }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Load session and chat history on component mount
    const existingSessionId = sessionStorage.getSessionId();
    const chatHistory = sessionStorage.getChatHistory();
    
    if (existingSessionId) {
      setSessionId(existingSessionId);
    }
    
    if (chatHistory.length > 0) {
      setMessages(chatHistory);
    }
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const generateMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await chatApi.sendMessage(inputMessage.trim(), sessionId || undefined);
      
      const aiMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'ai',
        content: response.response,
        timestamp: new Date(),
        sessionId: response.sessionId,
        interactionId: response.interactionId,
      };

      const finalMessages = [...updatedMessages, aiMessage];
      setMessages(finalMessages);
      
      if (response.sessionId !== sessionId) {
        setSessionId(response.sessionId);
        sessionStorage.setSessionId(response.sessionId);
      }
      
      sessionStorage.saveChatHistory(finalMessages);
      
    } catch (error) {
      console.error('Chat API error:', error);
      toast({
        title: "Connection Error",
        description: "Please check your API configuration and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId(null);
    sessionStorage.clearChatHistory();
    toast({
      title: "Chat Cleared",
      description: "Your conversation has been cleared.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Fairental AI Support</h1>
                <p className="text-sm text-slate-600">How can we help you today?</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearChat}
                className="border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Clear
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onLogout}
                className="border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Exit
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <Card className="h-[600px] shadow-lg border-slate-200 bg-white">
          <CardContent className="p-0 h-full flex flex-col">
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <div className="bg-slate-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                      <MessageCircle className="h-10 w-10 text-slate-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-800 mb-2">Welcome to Fairental AI</h3>
                    <p className="text-slate-600 max-w-md mx-auto">
                      Ask me anything about our services, policies, or how we can help you today.
                    </p>
                  </div>
                )}
                
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-4 animate-fade-in ${
                      message.type === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.type === 'ai' && (
                      <Avatar className="h-10 w-10 border-2 border-slate-200">
                        <AvatarFallback className="bg-slate-600 text-white text-sm font-semibold">
                          AI
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                        message.type === 'user'
                          ? 'bg-slate-600 text-white rounded-br-sm'
                          : 'bg-slate-100 border border-slate-200 text-slate-800 rounded-bl-sm'
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      <p className={`text-xs mt-2 ${
                        message.type === 'user' ? 'text-slate-200' : 'text-slate-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                    
                    {message.type === 'user' && (
                      <Avatar className="h-10 w-10 border-2 border-slate-200">
                        <AvatarFallback className="bg-slate-300 text-slate-700 text-sm">
                          You
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start gap-4">
                    <Avatar className="h-10 w-10 border-2 border-slate-200">
                      <AvatarFallback className="bg-slate-600 text-white text-sm font-semibold">
                        AI
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-slate-100 border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-slate-600 rounded-full animate-pulse-subtle"></div>
                        <div className="w-2 h-2 bg-slate-600 rounded-full animate-pulse-subtle" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-slate-600 rounded-full animate-pulse-subtle" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div ref={messagesEndRef} />
            </ScrollArea>
            
            <div className="p-6 border-t border-slate-200 bg-slate-50/50">
              <div className="flex gap-3">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={isLoading}
                  className="flex-1 bg-white border-slate-300 text-slate-800 placeholder:text-slate-500 focus:border-slate-600"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="bg-slate-600 hover:bg-slate-700 text-white"
                  size="lg"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerChat;
