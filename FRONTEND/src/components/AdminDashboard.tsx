import React, { useState, useEffect } from 'react';
import { Search, Shield, MessageSquare, Clock, LogOut, RefreshCw, TrendingUp, User, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { sessionStorage } from '@/utils/storage';
import { ChatMessage, ChatHistory, HistoryItem, AdminHistoryResponse } from '@/types/api';
import CorrectionModal from './CorrectionModal';
import { chatApi } from '@/utils/api';

interface AdminDashboardProps {
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInteraction, setSelectedInteraction] = useState<ChatHistory | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Admin history state
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionIdFilter, setSessionIdFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'QUESTION' | 'AI_RESPONSE' | 'ADMIN_CORRECTION'>('all');
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    // Load chat history from localStorage (in real app, this would come from API)
    loadChatHistory();
  }, []);

  useEffect(() => {
    const fetchAllHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const response: AdminHistoryResponse = await chatApi.getAdminHistory(); // no params
        // Sort chronologically (oldest first)
        const sortedHistory = (response.history || []).sort((a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime());
        setHistoryData(sortedHistory);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };
    fetchAllHistory();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [historyData, sessionIdFilter, searchTerm, eventTypeFilter]);

  const loadChatHistory = () => {
    const messages = sessionStorage.getChatHistory();
    const history: ChatHistory[] = [];
    
    for (let i = 0; i < messages.length - 1; i++) {
      const currentMsg = messages[i];
      const nextMsg = messages[i + 1];
      
      if (currentMsg.type === 'user' && nextMsg.type === 'ai' && nextMsg.interactionId) {
        history.push({
          sessionId: nextMsg.sessionId || 'unknown',
          interactionId: nextMsg.interactionId,
          userQuestion: currentMsg.content,
          aiResponse: nextMsg.content,
          timestamp: nextMsg.timestamp,
        });
      }
    }
    
    setChatHistory(history.reverse()); // Show newest first
  };

  const applyFilters = () => {
    let filtered = [...historyData];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.Content.toLowerCase().includes(term) ||
        item.SessionId.toLowerCase().includes(term) ||
        item.InteractionId.toLowerCase().includes(term) ||
        (item.UserQuestion && item.UserQuestion.toLowerCase().includes(term))
      );
    }
    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(item => item.EventType === eventTypeFilter);
    }
    setFilteredHistory(filtered);
  };

  const groupHistoryByInteraction = (history: HistoryItem[]) => {
    const groups: { 
      [key: string]: { 
        question?: HistoryItem; 
        response?: HistoryItem; 
        corrections?: HistoryItem[] 
      } 
    } = {};
    
    history.forEach(item => {
      const key = item.InteractionId;
      if (!groups[key]) {
        groups[key] = { corrections: [] };
      }
      
      if (item.EventType === 'QUESTION') {
        groups[key].question = item;
      } else if (item.EventType === 'AI_RESPONSE') {
        groups[key].response = item;
      } else if (item.EventType === 'ADMIN_CORRECTION') {
        if (!groups[key].corrections) {
          groups[key].corrections = [];
        }
        groups[key].corrections!.push(item);
      }
    });
    
    // Debug logging
    console.log('Grouped interactions:', Object.values(groups));
    
    return Object.values(groups).filter(group => group.question && group.response);
  };

  const interactionGroups = groupHistoryByInteraction(filteredHistory);

  // Get all corrections for the corrections history tab
  const getAllCorrections = () => {
    const corrections = historyData.filter(item => item.EventType === 'ADMIN_CORRECTION');
    console.log('All corrections found:', corrections);
    return corrections;
  };

  // Check if a group has corrections
  const hasCorrections = (group: any) => {
    const hasCorrections = group.corrections && group.corrections.length > 0;
    console.log('Group has corrections:', hasCorrections, group.corrections);
    return hasCorrections;
  };

  const handleCorrect = (questionItem: HistoryItem, responseItem: HistoryItem) => {
    const interaction: ChatHistory = {
      sessionId: questionItem.SessionId,
      interactionId: questionItem.InteractionId,
      userQuestion: questionItem.Content,
      aiResponse: responseItem.Content,
      timestamp: new Date(questionItem.Timestamp),
    };
    setSelectedInteraction(interaction);
    setIsModalOpen(true);
  };

  const handleCorrectionSuccess = () => {
    setIsModalOpen(false);
    setSelectedInteraction(null);
    // Re-fetch history to show new corrections
    const fetchAllHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const response: AdminHistoryResponse = await chatApi.getAdminHistory();
        const sortedHistory = (response.history || []).sort((a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime());
        setHistoryData(sortedHistory);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };
    fetchAllHistory();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-600 rounded-xl flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Admin Dashboard</h1>
                <p className="text-sm text-slate-600">Review and improve AI interactions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-300">
                <Shield className="h-3 w-3 mr-1" />
                Admin Access
              </Badge>
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

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total History Items</p>
                  <p className="text-2xl font-bold text-slate-800">{historyData.length}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-slate-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Questions</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {historyData.filter(h => h.EventType === 'QUESTION').length}
                  </p>
                </div>
                <User className="h-8 w-8 text-slate-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">AI Responses</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {historyData.filter(h => h.EventType === 'AI_RESPONSE').length}
                  </p>
                </div>
                <Bot className="h-8 w-8 text-slate-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Admin Corrections</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {historyData.filter(h => h.EventType === 'ADMIN_CORRECTION').length}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-slate-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Unique Sessions</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {new Set(historyData.map(h => h.SessionId)).size}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-slate-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="interactions" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md bg-slate-100 border-slate-200">
            <TabsTrigger value="interactions" className="data-[state=active]:bg-white data-[state=active]:text-slate-800">
              Chat Interactions
            </TabsTrigger>
            <TabsTrigger value="corrections" className="data-[state=active]:bg-white data-[state=active]:text-slate-800">
              Corrections History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="interactions" className="space-y-6">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <MessageSquare className="h-5 w-5 text-slate-600" />
                  Chat Interactions
                </CardTitle>
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <Input
                      placeholder="Search by question, response, or session ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
                    />
                  </div>
                  <Button 
                    onClick={loadChatHistory} 
                    variant="outline"
                    className="border-slate-300 text-slate-600 hover:bg-slate-50"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {interactionGroups.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 text-lg mb-2">No chat interactions found</p>
                    <p className="text-sm text-slate-500">Chat interactions will appear here after users have conversations</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {interactionGroups.map((group, idx) => (
                      <Card key={group.question?.InteractionId + '-' + idx} className="border-slate-200 bg-slate-50">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-xs border-slate-300 text-slate-600">
                                Session: {group.question?.SessionId.slice(0, 8)}...
                              </Badge>
                              <Badge variant="outline" className="text-xs border-slate-300 text-slate-600">
                                ID: {group.question?.InteractionId.slice(0, 8)}...
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Clock className="h-3 w-3" />
                              {new Date(group.question?.Timestamp || '').toLocaleString()}
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm font-medium text-slate-700 mb-2">User Question:</p>
                              <p className="text-sm bg-blue-50 border border-blue-200 p-3 rounded-lg text-slate-800">
                                {group.question?.Content}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-700 mb-2">AI Response:</p>
                              <p className="text-sm bg-white border border-slate-200 p-3 rounded-lg text-slate-800">
                                {group.response?.Content}
                              </p>
                            </div>
                            {hasCorrections(group) && (
                              <div className="mt-4 p-4 bg-slate-100 border border-slate-200 rounded-lg">
                                <div className="flex items-center gap-2 mb-3">
                                  <Shield className="h-4 w-4 text-slate-600" />
                                  <span className="text-sm font-medium text-slate-700">
                                    Admin Corrections ({group.corrections?.length || 0})
                                  </span>
                                </div>
                                {group.corrections?.map((correction, cidx) => (
                                  <div key={cidx} className="mb-3 last:mb-0 p-3 bg-white border border-slate-300 rounded-md shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div>
                                        <p className="text-xs font-medium text-slate-600 mb-1">Original Question:</p>
                                        <p className="text-xs bg-slate-50 border border-slate-200 p-2 rounded text-slate-700">
                                          {correction.UserQuestion || 'N/A'}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs font-medium text-slate-600 mb-1">Original Response:</p>
                                        <p className="text-xs bg-slate-50 border border-slate-200 p-2 rounded text-slate-700">
                                          {correction.Content}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-200">
                                      <p className="text-xs font-medium text-slate-600 mb-1">Corrected Response:</p>
                                      <p className="text-xs bg-blue-50 border border-blue-200 p-2 rounded text-slate-800">
                                        {correction.Content}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex justify-end mt-6">
                            {!hasCorrections(group) ? (
                              <Button
                                onClick={() => handleCorrect(group.question!, group.response!)}
                                size="sm"
                                className="bg-slate-600 hover:bg-slate-700 text-white"
                              >
                                Correct Response
                              </Button>
                            ) : (
                              <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">
                                <Shield className="h-3 w-3 mr-1" />
                                Already Corrected ({group.corrections?.length || 0})
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="corrections">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-800">
                  <Shield className="h-5 w-5 text-slate-600" />
                  Corrections History ({getAllCorrections().length} corrections)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {getAllCorrections().length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-slate-600 text-lg mb-2">No corrections found</p>
                    <p className="text-sm text-slate-500">
                      Corrections will appear here after admins correct AI responses
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {getAllCorrections().map((correction, index) => (
                      <Card key={`${correction.InteractionId}-${index}`} className="border-slate-200 bg-slate-50">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-xs border-slate-300 text-slate-600 bg-slate-100">
                                Session: {correction.SessionId.slice(0, 8)}...
                              </Badge>
                              <Badge variant="outline" className="text-xs border-slate-300 text-slate-600 bg-slate-100">
                                ID: {correction.InteractionId.slice(0, 8)}...
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Clock className="h-3 w-3" />
                              {new Date(correction.Timestamp).toLocaleString()}
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <div>
                              <p className="text-sm font-medium text-slate-700 mb-2">Original Question:</p>
                              <p className="text-sm bg-slate-50 border border-slate-200 p-3 rounded-lg text-slate-800">
                                {correction.UserQuestion || 'N/A'}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-sm font-medium text-slate-700 mb-2">Original AI Response:</p>
                              <p className="text-sm bg-slate-50 border border-slate-200 p-3 rounded-lg text-slate-800">
                                {correction.Content}
                              </p>
                            </div>
                            
                            <div className="p-4 bg-slate-100 border border-slate-200 rounded-lg">
                              <div className="flex items-center gap-2 mb-3">
                                <Shield className="h-4 w-4 text-slate-600" />
                                <span className="text-sm font-medium text-slate-700">Corrected Response</span>
                              </div>
                              <p className="text-sm bg-blue-50 border border-blue-200 p-3 rounded-lg text-slate-800">
                                {correction.Content}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {selectedInteraction && (
        <CorrectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          interaction={selectedInteraction}
          onSuccess={handleCorrectionSuccess}
        />
      )}
    </div>
  );
};

export default AdminDashboard;
