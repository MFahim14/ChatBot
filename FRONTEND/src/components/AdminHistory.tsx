import React, { useState, useEffect } from 'react';
import { Search, Filter, Calendar, MessageSquare, User, Bot, Clock, RefreshCw, Download, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { chatApi } from '@/utils/api';
import { HistoryItem, AdminHistoryResponse } from '@/types/api';
import CorrectionModal from './CorrectionModal';
import { ChatHistory } from '@/types/api';

interface AdminHistoryProps {
  onLogout: () => void;
  onNavigateToDashboard: () => void;
}

const AdminHistory: React.FC<AdminHistoryProps> = ({ onLogout, onNavigateToDashboard }) => {
  const [historyData, setHistoryData] = useState<HistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [sessionIdFilter, setSessionIdFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'QUESTION' | 'AI_RESPONSE' | 'ADMIN_CORRECTION'>('all');
  const [limit, setLimit] = useState(100);
  
  // Modal states
  const [selectedInteraction, setSelectedInteraction] = useState<ChatHistory | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch ALL history on mount, no params, just like curl
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

  const applyFilters = () => {
    let filtered = [...historyData];

    // Apply search term filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.Content.toLowerCase().includes(term) ||
        item.SessionId.toLowerCase().includes(term) ||
        item.InteractionId.toLowerCase().includes(term) ||
        (item.UserQuestion && item.UserQuestion.toLowerCase().includes(term))
      );
    }

    // Apply event type filter
    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(item => item.EventType === eventTypeFilter);
    }

    setFilteredHistory(filtered);
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
    // No need to refresh history here, as it's already loaded
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
        groups[key].corrections = groups[key].corrections || [];
        groups[key].corrections!.push(item);
      }
    });
    
    // Return only groups that have both question and response
    return Object.values(groups).filter(group => group.question && group.response);
  };

  const interactionGroups = groupHistoryByInteraction(filteredHistory);

  const exportHistory = () => {
    const csvContent = [
      'Session ID,Interaction ID,Timestamp,User Question,AI Response',
      ...interactionGroups.map(group => 
        `"${group.question?.SessionId}","${group.question?.InteractionId}","${group.question?.Timestamp}","${group.question?.Content}","${group.response?.Content}"`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-600 rounded-xl flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Admin History</h1>
                <p className="text-sm text-slate-600">Review and manage chat interactions</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToDashboard}
                className="border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                <Shield className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-300">
                <MessageSquare className="h-3 w-3 mr-1" />
                History View
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={onLogout}
                className="border-slate-300 text-slate-600 hover:bg-slate-50"
              >
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
                  <p className="text-sm text-slate-600">Total Interactions</p>
                  <p className="text-2xl font-bold text-slate-800">{interactionGroups.length}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-slate-600" />
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
                <User className="h-8 w-8 text-slate-600" />
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
        </div>

        {/* Filters */}
        <Card className="bg-white border-slate-200 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Filter className="h-5 w-5 text-slate-600" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  placeholder="Search content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
                />
              </div>
              
              <Input
                placeholder="Session ID filter..."
                value={sessionIdFilter}
                onChange={(e) => setSessionIdFilter(e.target.value)}
                className="bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
              />
              
              <Select value={eventTypeFilter} onValueChange={(value: any) => setEventTypeFilter(value)}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-800">
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="QUESTION">Questions Only</SelectItem>
                  <SelectItem value="AI_RESPONSE">AI Responses Only</SelectItem>
                  <SelectItem value="ADMIN_CORRECTION">Admin Corrections Only</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value))}>
                <SelectTrigger className="bg-white border-slate-200 text-slate-800">
                  <SelectValue placeholder="Limit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 records</SelectItem>
                  <SelectItem value="100">100 records</SelectItem>
                  <SelectItem value="200">200 records</SelectItem>
                  <SelectItem value="500">500 records</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-3 mt-4">
              <Button 
                onClick={applyFilters} 
                variant="outline"
                className="border-slate-300 text-slate-600 hover:bg-slate-50"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Refresh'}
              </Button>
              
              <Button 
                onClick={exportHistory}
                variant="outline"
                className="border-slate-300 text-slate-600 hover:bg-slate-50"
                disabled={interactionGroups.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="bg-red-50 border-red-200 shadow-sm mb-6">
            <CardContent className="p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* History Display */}
        <Card className="bg-white border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <MessageSquare className="h-5 w-5 text-slate-600" />
              Chat History ({interactionGroups.length} interactions)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-12 w-12 text-slate-400 mx-auto mb-4 animate-spin" />
                <p className="text-slate-600 text-lg">Loading history...</p>
              </div>
            ) : interactionGroups.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 text-lg mb-2">No chat interactions found</p>
                <p className="text-sm text-slate-500">
                  {error ? 'Try refreshing or check your filters' : 'Chat interactions will appear here after users have conversations'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {interactionGroups.map((group, index) => (
                  <Card key={`${group.question?.InteractionId}-${index}`} className="border-slate-200 bg-slate-50">
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
                          <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-600" />
                            User Question:
                          </p>
                          <p className="text-sm bg-blue-50 border border-blue-200 p-3 rounded-lg text-slate-800">
                            {group.question?.Content}
                          </p>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                            <Bot className="h-4 w-4 text-green-600" />
                            AI Response:
                          </p>
                          <p className="text-sm bg-white border border-slate-200 p-3 rounded-lg text-slate-800">
                            {group.response?.Content}
                          </p>
                        </div>
                        
                        {/* Show corrections if any exist */}
                        {group.corrections && group.corrections.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                              <Shield className="h-4 w-4 text-orange-600" />
                              Admin Corrections ({group.corrections.length}):
                            </p>
                            {group.corrections.map((correction, idx) => (
                              <div key={idx} className="mb-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                <p className="text-xs text-orange-700 mb-1">
                                  <strong>Original Question:</strong> {correction.UserQuestion || 'N/A'}
                                </p>
                                <p className="text-xs text-orange-700 mb-1">
                                  <strong>Original Response:</strong> {correction.Content}
                                </p>
                                <p className="text-xs text-orange-700">
                                  <strong>Corrected:</strong> {correction.Content}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-end mt-6">
                        <Button
                          onClick={() => handleCorrect(group.question!, group.response!)}
                          size="sm"
                          className="bg-slate-600 hover:bg-slate-700 text-white flex items-center gap-2"
                        >
                          <Shield className="h-4 w-4" />
                          Correct Response
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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

export default AdminHistory; 