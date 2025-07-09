
import React from 'react';
import { MessageCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface NavigationProps {
  currentView: 'customer' | 'admin';
  onViewChange: (view: 'customer' | 'admin') => void;
}

const Navigation: React.FC<NavigationProps> = ({ currentView, onViewChange }) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex gap-2">
      <Button
        variant={currentView === 'customer' ? 'default' : 'outline'}
        onClick={() => onViewChange('customer')}
        className="flex items-center gap-2"
      >
        <MessageCircle className="h-4 w-4" />
        Customer Chat
      </Button>
      <Button
        variant={currentView === 'admin' ? 'default' : 'outline'}
        onClick={() => onViewChange('admin')}
        className="flex items-center gap-2"
      >
        <Settings className="h-4 w-4" />
        Admin Dashboard
        <Badge variant="secondary" className="ml-1">
          Admin
        </Badge>
      </Button>
    </div>
  );
};

export default Navigation;
