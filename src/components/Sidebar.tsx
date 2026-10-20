import React from 'react';
import {
  LayoutDashboard,
  QrCode,
  Tv,
  Calendar,
  Users,
  FileText,
  Settings,
  Database,
  Rocket,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  X,
  School,
} from 'lucide-react';
import { SchoolProfile } from '../types';

export type ActiveTab = 'dashboard' | 'scanner' | 'projector' | 'meetings' | 'teachers' | 'reports' | 'profile';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isSupabaseConnected: boolean;
  schoolProfile: SchoolProfile;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenSupabaseModal: () => void;
  onOpenVercelModal: () => void;
  onOpenWahaModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isSupabaseConnected,
  schoolProfile,
  isOpenMobile,
  onCloseMobile,
  onOpenSupabaseModal,
  onOpenVercelModal,
  onOpenWahaModal,
}) => {
  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'scanner', label: 'Scan Panitia', icon: <QrCode className="w-4 h-4" /> },
    { id: 'projector', label: 'Layar Proyektor', icon: <Tv className="w-4 h-4" /> },
    { id: 'meetings', label: 'Agenda Rapat', icon: <Calendar className="w-4 h-4" /> },
    { id: 'teachers', label: 'Data Guru & ID Card', icon: <Users className="w-4 h-4" /> },
    { id: 'reports', label: 'Laporan Resmi', icon: <FileText className="w-4 h-4" /> },
    { id: 'profile', label: 'Profil Sekolah', icon: <Settings className="w-4 h-4" /> },
  ];

  const handleNavClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } no-print`}
      >
        {/* Brand Lockup */}
        <div className="h-18 px-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <button
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center gap-3 text-left hover:opacity-90 transition-opacity"
          >
            {schoolProfile.logo_url ? (
              <img
                src={schoolProfile.logo_url}
                alt="Logo App"
                className="w-10 h-10 rounded-xl object-contain bg-white p-1 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0 tracking-tight">
                dP
              </div>
            )}
            <div className="min-w-0">
              <span className="text-lg font-black tracking-tight text-white block leading-none">
                dePresent
              </span>
              <span className="text-[11px] font-medium text-slate-400 block leading-tight mt-1 truncate">
                Sistem Presensi Kegiatan
              </span>
            </div>
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Menu Utama
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-slate-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Integrations & Status Bottom Card */}
        <div className="p-3 border-t border-slate-800 space-y-2 bg-slate-950/40 shrink-0 text-xs">
          <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Koneksi & Integrasi
          </div>

          {/* Supabase Status Button */}
          <button
            onClick={onOpenSupabaseModal}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors ${
              isSupabaseConnected
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-950/60'
                : 'bg-amber-950/40 border-amber-800/60 text-amber-300 hover:bg-amber-950/60'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{isSupabaseConnected ? 'Supabase Konek' : 'Koneksi Supabase'}</span>
            </div>
            {isSupabaseConnected ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            )}
          </button>

          {/* WAHA Trigger Button */}
          <button
            onClick={onOpenWahaModal}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>WAHA WhatsApp</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">Aktif</span>
          </button>

          {/* Vercel Deploy Button */}
          <button
            onClick={onOpenVercelModal}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Rocket className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Deploy Vercel</span>
            </div>
            <span className="text-[10px] text-slate-500">GitHub</span>
          </button>
        </div>
      </aside>
    </>
  );
};
