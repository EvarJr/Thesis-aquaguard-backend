import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Role } from '@/types';
import {
  WaterDropIcon, HomeIcon, SettingsIcon, DocumentReportIcon, MapIcon,
  HomeModernIcon, PumpIcon, Squares2X2Icon, ChevronDownIcon,
  UserGroupIcon, ChatBubbleLeftRightIcon, CpuChipIcon,
  ClipboardListIcon, XIcon
} from '@/components/icons/IconComponents';
import { useTranslation } from '@/i18n';

interface SidebarProps {
  user: User;
  activeView: string;
  setActiveView: (view: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

// ✅ YOUR TEAM NAMES
const DEVELOPERS = [
  "Evar Idala Sanglitan Jr.",
  "Yuan Roman Barraca",
  "Jazzy Anne Vallejo Dabu",
  "Julie Ann Saluta Olano"
];

const NavLink: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
      isActive
        ? 'bg-brand-primary/10 text-brand-primary font-bold'
        : 'text-brand-muted hover:bg-brand-bg hover:text-brand-text'
    }`}
  >
    {icon}
    <span className="flex-1 text-left">{label}</span>
  </button>
);

const SubNavLink: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-2 text-sm rounded-lg transition-all duration-200 ${
      isActive
        ? 'bg-brand-primary/10 text-brand-primary font-semibold'
        : 'text-brand-muted hover:bg-brand-bg hover:text-brand-text'
    }`}
  >
    {icon}
    <span className="flex-1 text-left">{label}</span>
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeView,
  setActiveView,
  isOpen,
  setIsOpen,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isManagementActive = [
    'sensors', 'households', 'pumps', 'users', 'ml', 'logs',
  ].includes(activeView);

  const [isManagementOpen, setIsManagementOpen] = useState(isManagementActive);

  useEffect(() => {
    if (isManagementActive) setIsManagementOpen(true);
  }, [activeView, isManagementActive]);

  const handleNav = (view: string) => {
    setActiveView(view);
    setIsOpen(false);
    navigate('/dashboard'); 
  };

  return (
    <div
      className={`
        w-64 bg-brand-surface flex-shrink-0 border-r border-brand-border flex flex-col
        fixed inset-y-0 left-0 z-30 md:z-auto transform transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 mb-2">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-brand-primary rounded-lg">
            <WaterDropIcon className="w-8 h-8 text-brand-primary-text" />
          </div>
          <h1 className="text-2xl font-bold text-brand-text">{t('sidebar.title')}</h1>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="md:hidden p-1 text-brand-muted hover:text-brand-text"
          aria-label="Close sidebar"
        >
          <XIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar px-4 pb-4">
        <NavLink
          icon={<HomeIcon className="w-6 h-6" />}
          label={t('sidebar.overview')}
          isActive={activeView === 'overview'}
          onClick={() => handleNav('overview')}
        />
        <NavLink
          icon={<MapIcon className="w-6 h-6" />}
          label={t('sidebar.pipelineMap')}
          isActive={activeView === 'pipeline'}
          onClick={() => handleNav('pipeline')}
        />
        <NavLink
          icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />}
          label={t('sidebar.forum')}
          isActive={activeView === 'forum'}
          onClick={() => handleNav('forum')}
        />
        <NavLink
          icon={<DocumentReportIcon className="w-6 h-6" />}
          label={t('sidebar.reports')}
          isActive={activeView === 'reports'}
          onClick={() => handleNav('reports')}
        />

        {user.role === Role.Admin && (
          <div className="pt-2">
            <button
              onClick={() => setIsManagementOpen(!isManagementOpen)}
              className={`w-full flex items-center justify-between space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                isManagementActive
                  ? 'bg-brand-primary/10 text-brand-primary font-bold'
                  : 'text-brand-muted hover:bg-brand-bg hover:text-brand-text'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Squares2X2Icon className="w-6 h-6" />
                <span className="flex-1 text-left">{t('sidebar.management')}</span>
              </div>
              <ChevronDownIcon
                className={`w-5 h-5 transition-transform ${
                  isManagementOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isManagementOpen && (
              <div className="pl-6 pt-1 space-y-1 border-l-2 border-brand-border ml-4 mt-1">
                <SubNavLink
                  icon={<SettingsIcon className="w-5 h-5" />}
                  label={t('sidebar.sensorManagement')}
                  isActive={activeView === 'sensors'}
                  onClick={() => handleNav('sensors')}
                />
                <SubNavLink
                  icon={<HomeModernIcon className="w-5 h-5" />}
                  label={t('sidebar.householdManagement')}
                  isActive={activeView === 'households'}
                  onClick={() => handleNav('households')}
                />
                <SubNavLink
                  icon={<PumpIcon className="w-5 h-5" />}
                  label={t('sidebar.pumpManagement')}
                  isActive={activeView === 'pumps'}
                  onClick={() => handleNav('pumps')}
                />
                <SubNavLink
                  icon={<UserGroupIcon className="w-5 h-5" />}
                  label={t('sidebar.userManagement')}
                  isActive={activeView === 'users'}
                  onClick={() => handleNav('users')}
                />
                <SubNavLink
                  icon={<CpuChipIcon className="w-5 h-5" />}
                  label={t('sidebar.mlTraining')}
                  isActive={activeView === 'ml'}
                  onClick={() => handleNav('ml')}
                />
                <SubNavLink
                  icon={<ClipboardListIcon className="w-5 h-5" />}
                  label={t('sidebar.systemLogs')}
                  isActive={activeView === 'logs'}
                  onClick={() => handleNav('logs')}
                />
              </div>
            )}
          </div>
        )}
      </nav>

      {/* ✅ Footer: Developer Credits (Redesigned) */}
      <div className="mt-auto border-t border-brand-border p-5 bg-brand-bg/30">
        
        {/* Team Section */}
        <div className="mb-4">
            <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-3 flex items-center gap-2 opacity-90">
                <span className="w-1 h-3 bg-brand-primary rounded-full"></span>
                Development Team
            </p>
            <ul className="space-y-2 pl-1">
                {DEVELOPERS.map((dev, index) => (
                    <li key={index} className="text-[11px] font-medium text-brand-text flex items-center gap-2 hover:text-brand-primary transition-colors duration-200 cursor-default">
                        {/* Subtle bullet point */}
                        <span className="w-1 h-1 rounded-full bg-brand-border group-hover:bg-brand-primary"></span>
                        {dev}
                    </li>
                ))}
            </ul>
        </div>

        {/* Copyright Section */}
        <div className="pt-3 border-t border-brand-border/50 text-center">
            <p className="text-[10px] text-brand-muted opacity-60">
                {t('sidebar.copyright')}
            </p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;