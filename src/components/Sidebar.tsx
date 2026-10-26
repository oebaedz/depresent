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
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  Mail,
} from 'lucide-react';
import { SchoolProfile } from '../types';

export type ActiveTab = 'dashboard' | 'scanner' | 'projector' | 'meetings' | 'invitations' | 'teachers' | 'reports' | 'profile';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  isSupabaseConnected: boolean;
  supabaseStatus: 'local' | 'tables_missing' | 'connected' | 'demo';
  isAdminUnlocked: boolean;
  onAdminLock: () => void;
  onAdminUnlockRequest: () => void;
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
  supabaseStatus,
  isAdminUnlocked,
  onAdminLock,
  onAdminUnlockRequest,
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
    { id: 'invitations', label: 'Surat & Ekspedisi', icon: <Mail className="w-4 h-4" /> },
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

        {/* Sidebar Container - Fixed viewport screen height (h-screen sticky top-0) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-screen max-h-screen bg-teal-950 dark:bg-slate-950 text-slate-100 flex flex-col border-r border-teal-900/70 dark:border-slate-800 transition-transform duration-200 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:max-h-screen lg:shrink-0 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        } no-print`}
      >
        {/* Brand Lockup */}
        <div className="h-18 px-5 border-b border-teal-900/70 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center gap-3 text-left hover:opacity-95 transition-opacity cursor-pointer"
          >
            {schoolProfile.logo_url ? (
              <img
                src={schoolProfile.logo_url}
                alt="Logo App"
                className="w-10 h-10 rounded-xl object-contain bg-white p-1 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0 tracking-tight">
                dP
              </div>
            )}
            <div className="min-w-0">
              <span className="text-lg font-black tracking-tight text-white block leading-none">
                dePresent
              </span>
              <span className="text-[11px] font-semibold text-teal-200 block leading-tight mt-1 truncate">
                Sistem Presensi Kegiatan
              </span>
            </div>
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-teal-900/80 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto min-h-0">
          <div className="px-3 pb-2 text-[10px] font-extrabold uppercase tracking-wider text-teal-300">
            Menu Utama
          </div>

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'text-slate-200 hover:text-white hover:bg-teal-900/70'
                }`}
              >
                <span className={isActive ? 'text-teal-200' : 'text-teal-400/80'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Admin Security & Database Card */}
        <div className="p-3 border-t border-teal-900/60 dark:border-[#0f4950] space-y-2 bg-teal-950/80 dark:bg-[#031d20] shrink-0 text-xs">
          <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-teal-400/80">
            Akses & Sistem
          </div>

          {/* Admin Lock / Unlock Button */}
          {isAdminUnlocked ? (
            <button
              onClick={onAdminLock}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-teal-700/60 bg-teal-900/50 hover:bg-teal-900/80 text-teal-100 transition-colors text-left group"
              title="Klik untuk mengunci panel admin"
            >
              <div className="flex items-center gap-2 truncate">
                <Unlock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate font-semibold text-[11px]">Admin Terbuka</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-950/80 text-teal-300 font-mono flex items-center gap-1 group-hover:bg-rose-900/60 group-hover:text-rose-200 transition-colors">
                <Lock className="w-2.5 h-2.5" />
                Kunci
              </span>
            </button>
          ) : (
            <button
              onClick={onAdminUnlockRequest}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-amber-800/60 bg-amber-950/40 hover:bg-amber-950/70 text-amber-200 transition-colors text-left"
              title="Klik untuk membuka kunci panel admin"
            >
              <div className="flex items-center gap-2 truncate">
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate font-semibold text-[11px]">Admin Terkunci</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-200 font-mono">
                Buka
              </span>
            </button>
          )}

          {/* Supabase / Cloud Database Status Button */}
          <button
            onClick={onOpenSupabaseModal}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
              supabaseStatus === 'connected'
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-950/60'
                : supabaseStatus === 'tables_missing'
                ? 'bg-rose-950/40 border-rose-800/60 text-rose-300 hover:bg-rose-950/60'
                : 'bg-teal-900/30 border-teal-800/60 text-teal-200 hover:bg-teal-900/60'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate text-[11px] font-medium">
                {supabaseStatus === 'connected'
                  ? 'Supabase Terhubung'
                  : supabaseStatus === 'tables_missing'
                  ? 'Tabel SQL Kurang'
                  : 'Penyimpanan Lokal'}
              </span>
            </div>
            {supabaseStatus === 'connected' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : supabaseStatus === 'tables_missing' ? (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 font-mono">
                Lokal
              </span>
            )}
          </button>

          {/* WAHA Trigger Button */}
          <button
            onClick={onOpenWahaModal}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-teal-900/50 bg-teal-900/40 hover:bg-teal-900/80 text-teal-200 hover:text-white transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[11px]">WAHA WhatsApp</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400">Aktif</span>
          </button>

          {/* Vercel Deploy Button */}
          <button
            onClick={onOpenVercelModal}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-teal-900/50 bg-teal-900/40 hover:bg-teal-900/80 text-teal-200 hover:text-white transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Rocket className="w-3.5 h-3.5 text-teal-300 shrink-0" />
              <span className="text-[11px]">Deploy Vercel</span>
            </div>
            <span className="text-[10px] text-teal-400/70 font-mono">Git</span>
          </button>
        </div>
      </aside>
    </>
  );
};
