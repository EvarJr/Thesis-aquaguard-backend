import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@/types';
import { LogoutIcon, UserCircleIcon, MenuIcon, SettingsIcon, MoonIcon, SunIcon } from '@/components/icons/IconComponents';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/context/ThemeContext';
import ProfileModal from './ProfileModal';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onMenuClick }) => {
  const { language, setLanguage, t } = useTranslation();
  const { theme, toggleTheme } = useTheme(); 
  const navigate = useNavigate();
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await onLogout(); 
      navigate('/login'); 
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleProfileUpdate = () => {
    window.location.reload();
  };

  return (
    <>
      <header className="relative z-20 bg-brand-surface border-b border-brand-border shadow-sm p-4 flex justify-between items-center transition-colors duration-300">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="text-brand-muted hover:text-brand-primary md:hidden"
            aria-label="Open sidebar"
          >
            <MenuIcon className="w-6 h-6" />
          </button>

          <h1 className="text-xl font-semibold text-brand-text">
            {t('header.welcome', { name: user.name })}
          </h1>
        </div>

        <div className="flex items-center space-x-4">
          
          {/* 🌗 Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2 rounded-lg text-brand-muted hover:bg-brand-bg hover:text-brand-primary transition-colors"
            title="Toggle Theme"
          >
            {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5 text-yellow-400" />}
          </button>

          {/* 🌐 Language Switcher */}
          <div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'fil')}
              // ✅ FIX: Force White Background & Black Text regardless of theme
              className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-brand-primary focus:border-brand-primary block w-full p-2"
            >
              <option value="en">English</option>
              <option value="fil">Filipino</option>
            </select>
          </div>

          {/* 👤 User Dropdown */}
          <div className="relative">
            <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 focus:outline-none hover:bg-brand-bg p-2 rounded-lg transition"
            >
              <UserCircleIcon className="w-8 h-8 text-brand-muted" />
              <div className="text-right hidden sm:block">
                <p className="font-medium text-brand-text text-sm">{user.name}</p>
                <p className="text-xs text-brand-muted">{user.role}</p>
              </div>
            </button>

            {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-brand-surface rounded-md shadow-lg py-1 border border-brand-border z-50 ring-1 ring-black ring-opacity-5">
                    <div className="px-4 py-2 border-b border-brand-border sm:hidden">
                        <p className="text-sm font-bold text-brand-text">{user.name}</p>
                        <p className="text-xs text-brand-muted">{user.role}</p>
                    </div>
                    
                    <button 
                        onClick={() => { setIsProfileModalOpen(true); setIsDropdownOpen(false); }}
                        className="flex items-center w-full text-left px-4 py-2 text-sm text-brand-text hover:bg-brand-bg"
                    >
                        <SettingsIcon className="w-4 h-4 mr-2" />
                        Profile Settings
                    </button>

                    <button 
                        onClick={handleLogout}
                        className="flex items-center w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-brand-bg"
                    >
                        <LogoutIcon className="w-4 h-4 mr-2" />
                        {t('header.logout')}
                    </button>
                </div>
            )}
            
            {isDropdownOpen && (
                <div 
                    className="fixed inset-0 z-40 cursor-default" 
                    onClick={() => setIsDropdownOpen(false)}
                ></div>
            )}
          </div>
        </div>
      </header>

      <ProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onUpdate={handleProfileUpdate}
      />
    </>
  );
};

export default Header;