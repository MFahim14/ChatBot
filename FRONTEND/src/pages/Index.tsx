import React, { useState } from 'react';
import CustomerChat from '@/components/CustomerChat';
import AdminDashboard from '@/components/AdminDashboard';
import AdminHistory from '@/components/AdminHistory';
import LoginPage from '@/components/LoginPage';

const Index = () => {
  const [currentView, setCurrentView] = useState<'login' | 'customer' | 'admin' | 'admin-history'>('login');

  const handleLogin = (mode: 'customer' | 'admin') => {
    setCurrentView(mode);
  };

  const handleLogout = () => {
    setCurrentView('login');
  };

  const handleAdminNavigation = (view: 'admin' | 'admin-history') => {
    setCurrentView(view);
  };

  if (currentView === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="relative">
      {currentView === 'customer' ? (
        <CustomerChat onLogout={handleLogout} />
      ) : currentView === 'admin' ? (
        <AdminDashboard onLogout={handleLogout} onNavigateToHistory={() => handleAdminNavigation('admin-history')} />
      ) : (
        <AdminHistory onLogout={handleLogout} onNavigateToDashboard={() => handleAdminNavigation('admin')} />
      )}
    </div>
  );
};

export default Index;
