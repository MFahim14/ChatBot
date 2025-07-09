
import React, { useState } from 'react';
import { User, Shield, ArrowRight, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LoginPageProps {
  onLogin: (mode: 'customer' | 'admin') => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [selectedMode, setSelectedMode] = useState<'customer' | 'admin' | null>(null);

  const handleModeSelect = (mode: 'customer' | 'admin') => {
    setSelectedMode(mode);
    setTimeout(() => onLogin(mode), 200);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-slate-600 to-slate-700 rounded-xl flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-800">
              Fairental AI
            </h1>
          </div>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Advanced AI-powered customer support with intelligent admin oversight
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* Customer Mode */}
          <Card 
            className={`group cursor-pointer transition-all duration-300 hover:shadow-lg ${
              selectedMode === 'customer' 
                ? 'ring-2 ring-slate-600 shadow-lg' 
                : 'hover:ring-1 hover:ring-slate-300'
            }`}
            onClick={() => handleModeSelect('customer')}
          >
            <CardHeader className="text-center pb-4">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
                selectedMode === 'customer' 
                  ? 'bg-slate-600' 
                  : 'bg-slate-200 group-hover:bg-slate-300'
              }`}>
                <User className={`h-8 w-8 transition-colors ${
                  selectedMode === 'customer' 
                    ? 'text-white' 
                    : 'text-slate-600'
                }`} />
              </div>
              <CardTitle className="text-2xl text-slate-800">Customer Support</CardTitle>
              <p className="text-slate-600">Get instant help with your questions</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-700">
                  <div className="w-2 h-2 bg-slate-600 rounded-full"></div>
                  <span>24/7 AI-powered assistance</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <div className="w-2 h-2 bg-slate-600 rounded-full"></div>
                  <span>Instant responses</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <div className="w-2 h-2 bg-slate-600 rounded-full"></div>
                  <span>No registration required</span>
                </div>
              </div>
              <Button 
                className="w-full bg-slate-600 hover:bg-slate-700 text-white"
                size="lg"
              >
                Start Chat
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Admin Mode */}
          <Card 
            className={`group cursor-pointer transition-all duration-300 hover:shadow-lg ${
              selectedMode === 'admin' 
                ? 'ring-2 ring-slate-700 shadow-lg' 
                : 'hover:ring-1 hover:ring-slate-300'
            }`}
            onClick={() => handleModeSelect('admin')}
          >
            <CardHeader className="text-center pb-4">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${
                selectedMode === 'admin' 
                  ? 'bg-slate-700' 
                  : 'bg-slate-200 group-hover:bg-slate-300'
              }`}>
                <Shield className={`h-8 w-8 transition-colors ${
                  selectedMode === 'admin' 
                    ? 'text-white' 
                    : 'text-slate-600'
                }`} />
              </div>
              <CardTitle className="text-2xl text-slate-800">Admin Dashboard</CardTitle>
              <p className="text-slate-600">Manage and improve AI responses</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-700">
                  <div className="w-2 h-2 bg-slate-700 rounded-full"></div>
                  <span>Review chat interactions</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <div className="w-2 h-2 bg-slate-700 rounded-full"></div>
                  <span>Submit AI corrections</span>
                </div>
                <div className="flex items-center gap-3 text-slate-700">
                  <div className="w-2 h-2 bg-slate-700 rounded-full"></div>
                  <span>Analytics & insights</span>
                </div>
              </div>
              <Button 
                className="w-full bg-slate-700 hover:bg-slate-800 text-white"
                size="lg"
              >
                Access Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <p className="text-slate-500 text-sm">
            Powered by advanced AI technology • Secure • Reliable
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
