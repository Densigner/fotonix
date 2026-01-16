import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageCircle, Users, ShoppingBag, Mail, Star } from 'lucide-react';
import { API_URL } from '../../../config/environment';

// Store Widgets - Interactive components for published stores
// These are the actual widgets that appear on live stores

export function StoreChatbot({ storeHandle, config }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: "Hi! I'm here to help you find the perfect products. What are you looking for?",
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!config.enabled) return null;

  async function sendMessage() {
    if (!inputMessage.trim() || sending) return;

    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setSending(true);

    try {
      const response = await fetch(`${API_URL}/api/stores/${storeHandle}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage,
          conversationHistory: messages
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const botMessage = {
          id: messages.length + 2,
          type: 'bot',
          content: data.response,
          timestamp: data.timestamp
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: messages.length + 2,
        type: 'bot',
        content: "Sorry, I'm having trouble right now. Please try again later!",
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  }

  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
  };

  return (
    <div className={`fixed ${positionClasses[config.position]} z-50`}>
      {!isOpen ? (
        // Chatbot button
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 animate-pulse"
          title={`Chat with ${config.botName}`}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      ) : (
        // Chatbot window
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 h-96 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium">{config.botName}</div>
                  <div className="text-xs opacity-90">Online</div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-2xl ${
                    message.type === 'user'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-2 rounded-2xl">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={config.placeholder}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                disabled={sending}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || sending}
                className="bg-indigo-500 text-white p-2 rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StoreSocialProof({ config }) {
  const [currentNotification, setCurrentNotification] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!config.enabled || config.notifications.length === 0) return;

    const interval = setInterval(() => {
      setIsVisible(true);
      setTimeout(() => setIsVisible(false), 4000); // Show for 4 seconds
      setCurrentNotification(prev => (prev + 1) % config.notifications.length);
    }, config.animationSpeed);

    return () => clearInterval(interval);
  }, [config]);

  if (!config.enabled || config.notifications.length === 0) return null;

  const notification = config.notifications[currentNotification];
  const positionClasses = {
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4'
  };

  return (
    <div className={`fixed ${positionClasses[config.position]} z-40 transition-all duration-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            {notification.type === 'purchase' && <ShoppingBag className="h-4 w-4 text-white" />}
            {notification.type === 'signup' && <Mail className="h-4 w-4 text-white" />}
            {notification.type === 'review' && <Star className="h-4 w-4 text-white" />}
            {notification.type === 'custom' && <Users className="h-4 w-4 text-white" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{notification.message}</p>
            <p className="text-xs text-gray-600 mt-1">{notification.time}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Widget manager to render all active widgets for a store
export function StoreWidgets({ storeHandle, blocks }) {
  const chatbotBlock = blocks.find(block => block.type === 'chatbot');
  const socialProofBlock = blocks.find(block => block.type === 'socialProof');

  return (
    <>
      {chatbotBlock && (
        <StoreChatbot 
          storeHandle={storeHandle} 
          config={chatbotBlock.data} 
        />
      )}
      {socialProofBlock && (
        <StoreSocialProof 
          config={socialProofBlock.data} 
        />
      )}
    </>
  );
}