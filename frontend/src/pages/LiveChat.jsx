import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, User, Loader2, Clock, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LiveChat = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
    
    // Poll cada 3 segundos para actualizaciones
    const interval = setInterval(() => {
      fetchConversations();
      if (selectedConversation) {
        fetchMessages(selectedConversation.id);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [selectedConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const response = await axios.get(`${API}/conversations`);
      setConversations(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const response = await axios.get(`${API}/conversations/${conversationId}/messages`);
      setMessages(response.data);
      
      // Marcar como leído
      await axios.put(`${API}/conversations/${conversationId}/mark-read`);
      
      // Actualizar contador en la lista
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId 
            ? { ...conv, unread_count: 0 } 
            : conv
        )
      );
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSelectConversation = (conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.id);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !selectedConversation) return;
    
    setSending(true);
    try {
      await axios.post(`${API}/conversations/${selectedConversation.id}/messages`, {
        message: newMessage
      });
      
      setNewMessage('');
      fetchMessages(selectedConversation.id);
      fetchConversations();
      toast.success('Mensaje enviado');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error al enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-AR', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-AR', { 
        day: '2-digit', 
        month: '2-digit' 
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Chat en Vivo</h1>
          <p className="page-description">Conversaciones en tiempo real con tus clientes</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-200px)]">
        {/* Lista de Conversaciones */}
        <Card className="col-span-4 flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>Conversaciones</span>
              <Badge variant="secondary">{conversations.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <ScrollArea className="h-full">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center p-6">
                  <MessageCircle className="w-12 h-12 text-gray-400 mb-3" />
                  <p className="text-gray-600">No hay conversaciones activas</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Cuando un cliente inicie un chat, aparecerá aquí
                  </p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedConversation?.id === conv.id ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-gray-500" />
                        <span className="font-semibold text-sm">
                          {conv.client_name || 'Cliente'}
                        </span>
                      </div>
                      {conv.unread_count > 0 && (
                        <Badge className="bg-red-500 text-white text-xs">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                    {conv.client_username && (
                      <p className="text-xs text-gray-500 mb-1">{conv.client_username}</p>
                    )}
                    <p className="text-sm text-gray-600 truncate mb-1">
                      {conv.last_message || 'Sin mensajes'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatDate(conv.last_message_time)}</span>
                      <span>{formatTime(conv.last_message_time)}</span>
                      {conv.status === 'closed' && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          Cerrado
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Área de Chat */}
        <Card className="col-span-8 flex flex-col">
          {selectedConversation ? (
            <>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {selectedConversation.client_name || 'Cliente'}
                    </CardTitle>
                    {selectedConversation.client_username && (
                      <p className="text-sm text-gray-500 mt-1">
                        {selectedConversation.client_username}
                      </p>
                    )}
                  </div>
                  <Badge 
                    variant={selectedConversation.status === 'active' ? 'success' : 'secondary'}
                    className={selectedConversation.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                  >
                    {selectedConversation.status === 'active' ? 'Activo' : 'Cerrado'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="flex-1 p-4 overflow-hidden">
                <ScrollArea className="h-full pr-4">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No hay mensajes en esta conversación</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender === 'admin' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              msg.sender === 'admin'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                            <p
                              className={`text-xs mt-1 ${
                                msg.sender === 'admin' ? 'text-indigo-200' : 'text-gray-500'
                              }`}
                            >
                              {formatTime(msg.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
              </CardContent>

              <div className="border-t p-4">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe tu mensaje..."
                    disabled={sending || selectedConversation.status === 'closed'}
                    className="flex-1"
                  />
                  <Button 
                    type="submit" 
                    disabled={sending || !newMessage.trim() || selectedConversation.status === 'closed'}
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Enviar
                      </>
                    )}
                  </Button>
                </form>
                {selectedConversation.status === 'closed' && (
                  <p className="text-xs text-gray-500 mt-2">
                    Esta conversación ha sido cerrada por el cliente
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Selecciona una conversación</p>
                <p className="text-sm text-gray-500 mt-1">
                  Elige un cliente de la lista para ver y responder mensajes
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default LiveChat;
