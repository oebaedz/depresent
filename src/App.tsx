import React, { useEffect, useState, useCallback } from 'react';
import { ActiveTab, Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ScannerView } from './components/ScannerView';
import { ProjectorView } from './components/ProjectorView';
import { MeetingsView } from './components/MeetingsView';
import { TeachersView } from './components/TeachersView';
import { ReportsView } from './components/ReportsView';
import { SchoolProfileView } from './components/SchoolProfileView';
import { MobileCheckinView } from './components/MobileCheckinView';
import { SupabaseModal } from './components/SupabaseModal';
import { VercelDeployModal } from './components/VercelDeployModal';
import { WahaModal } from './components/WahaModal';
import { Attendance, Meeting, SchoolProfile, Teacher } from './types';
import {
  fetchAttendances,
  fetchMeetings,
  fetchSchoolProfile,
  fetchTeachers,
  initLocalStorage,
} from './lib/storage';
import { getSupabase, testSupabaseConnection } from './lib/supabase';
import { INITIAL_SCHOOL_PROFILE } from './lib/demoData';
import { Menu, Database, AlertTriangle, ArrowRight, CheckCircle2, Copy } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Check if current URL is a teacher mobile checkin link (e.g. ?checkin=<meetingId>)
  const [mobileCheckinMeetingId, setMobileCheckinMeetingId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('checkin');
    }
    return null;
  });

  // Core Data State
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile>(INITIAL_SCHOOL_PROFILE);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Connection & Modals
  const [supabaseStatus, setSupabaseStatus] = useState<'demo' | 'tables_missing' | 'connected'>('demo');
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isVercelModalOpen, setIsVercelModalOpen] = useState(false);
  const [isWahaModalOpen, setIsWahaModalOpen] = useState(false);

  // Selected meeting for projector or scanner
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('');

  const loadAllData = useCallback(async () => {
    try {
      initLocalStorage();
      const client = getSupabase();

      if (!client) {
        setSupabaseStatus('demo');
      } else {
        // Test health of Supabase & check tables
        const health = await testSupabaseConnection();
        if (health.success && health.tablesExist) {
          setSupabaseStatus('connected');
        } else if (health.success && !health.tablesExist) {
          setSupabaseStatus('tables_missing');
        } else {
          setSupabaseStatus('demo');
        }
      }

      const [profileData, teacherData, meetingData, attendanceData] = await Promise.all([
        fetchSchoolProfile(),
        fetchTeachers(),
        fetchMeetings(),
        fetchAttendances(),
      ]);

      setSchoolProfile(profileData);
      setTeachers(teacherData);
      setMeetings(meetingData);
      setAttendances(attendanceData);

      if (meetingData.length > 0 && !selectedMeetingId) {
        const active = meetingData.find((m) => m.status === 'active') || meetingData[0];
        setSelectedMeetingId(active.id);
      }
    } catch (err) {
      console.error('Error loading dePresent data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMeetingId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const currentMeeting = meetings.find((m) => m.id === selectedMeetingId) || meetings[0];
  const targetCheckinMeeting = mobileCheckinMeetingId
    ? meetings.find((m) => m.id === mobileCheckinMeetingId) || currentMeeting
    : currentMeeting;

  // If in direct mobile checkin mode (from scanning the projector QR with a smartphone camera)
  if (mobileCheckinMeetingId) {
    return (
      <MobileCheckinView
        meeting={targetCheckinMeeting}
        teachers={teachers}
        schoolProfile={schoolProfile}
        onSuccess={loadAllData}
        onExitToCheckin={() => {
          setMobileCheckinMeetingId(null);
          if (typeof window !== 'undefined' && window.history.replaceState) {
            window.history.replaceState({}, '', window.location.pathname);
          }
        }}
      />
    );
  }

  const pageTitles: Record<ActiveTab, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard Presensi', subtitle: 'Pantau kehadiran kegiatan dan statistik real-time' },
    scanner: { title: 'Scan Panitia', subtitle: 'Pindai ID Card fisik guru menggunakan kamera pemindai' },
    projector: { title: 'Layar Proyektor Rapat', subtitle: 'Tampilan layar lebar panggung rapat & presensi mandiri' },
    meetings: { title: 'Agenda Rapat & Kegiatan', subtitle: 'Kelola jadwal rapat kedinasan, pimpinan & notulis' },
    teachers: { title: 'Data Guru & ID Card Portrait', subtitle: 'Manajemen PTK ber-NIY dan cetak ID Card format tegak' },
    reports: { title: 'Laporan Resmi Kedinasan', subtitle: 'Format siap cetak Kop Surat Yayasan dan ekspor spreadsheet XLSX' },
    profile: { title: 'Profil Yayasan & Sekolah', subtitle: 'Konfigurasi identitas yayasan, sekolah dan upload logo dePresent' },
  };

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800 antialiased selection:bg-blue-900 selection:text-white">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSupabaseConnected={supabaseStatus === 'connected'}
        schoolProfile={schoolProfile}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onOpenVercelModal={() => setIsVercelModalOpen(true)}
        onOpenWahaModal={() => setIsWahaModalOpen(true)}
      />

      {/* 2. Right Main Viewport Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Top Contextual Header Bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between no-print">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb / Current View Title */}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 truncate leading-none">
                {pageTitles[activeTab].title}
              </h1>
              <p className="text-[11px] text-slate-500 mt-1 truncate">
                {pageTitles[activeTab].subtitle}
              </p>
            </div>
          </div>

          {/* Quick Header Badges / Status */}
          <div className="flex items-center gap-2 shrink-0">
            {schoolProfile.school_name && (
              <span className="hidden sm:inline-block text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md truncate max-w-[200px]">
                {schoolProfile.school_name}
              </span>
            )}

            {supabaseStatus === 'connected' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Supabase Aktif</span>
              </span>
            )}

            {supabaseStatus === 'tables_missing' && (
              <button
                onClick={() => setIsSupabaseModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors animate-pulse"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>Tabel Belum Dibuat</span>
              </button>
            )}

            {supabaseStatus === 'demo' && (
              <button
                onClick={() => setIsSupabaseModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
              >
                <Database className="w-3.5 h-3.5 text-slate-500" />
                <span>Mode Demo</span>
              </button>
            )}
          </div>
        </header>

        {/* Database Notice Banner */}
        {supabaseStatus === 'tables_missing' && activeTab !== 'projector' && (
          <aside aria-label="Status database" className="no-print bg-amber-500 text-slate-950 px-4 py-2.5 text-xs font-medium border-b border-amber-600">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-slate-950 shrink-0" />
                <span>
                  <strong>Perhatian:</strong> Kredensial Supabase terhubung, namun tabel <code>smp_*</code> belum dibuat di SQL Editor Supabase! Data masih menggunakan penyimpanan lokal browser.
                </span>
              </div>
              <button
                onClick={() => setIsSupabaseModalOpen(true)}
                className="px-3 py-1 bg-slate-950 text-white rounded font-bold hover:bg-slate-900 transition-colors shrink-0"
              >
                Salin & Buat Tabel Sekarang
              </button>
            </div>
          </aside>
        )}

        {supabaseStatus === 'demo' && activeTab !== 'projector' && (
          <aside aria-label="Status database" className="no-print bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="truncate">
                  <strong>Penyimpanan Demo:</strong> Hubungkan Supabase untuk menyimpan data rapat secara permanen & sinkronisasi multi-perangkat.
                </span>
              </div>
              <button
                onClick={() => setIsSupabaseModalOpen(true)}
                className="text-xs font-bold text-amber-900 underline hover:text-amber-950 flex items-center gap-1 shrink-0"
              >
                <span>Hubungkan Supabase</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </aside>
        )}

        {/* Main Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {isLoading ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-medium text-slate-500">Memuat data dePresent...</p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  meetings={meetings}
                  teachers={teachers}
                  attendances={attendances}
                  schoolProfile={schoolProfile}
                  onRefresh={loadAllData}
                  onNavigateToReports={() => setActiveTab('reports')}
                  onNavigateToScanner={() => setActiveTab('scanner')}
                />
              )}

              {activeTab === 'scanner' && (
                <ScannerView
                  meetings={meetings}
                  teachers={teachers}
                  onAttendanceRecorded={loadAllData}
                />
              )}

              {activeTab === 'projector' && (
                <ProjectorView
                  meeting={currentMeeting}
                  teachers={teachers}
                  attendances={attendances}
                  schoolProfile={schoolProfile}
                  onAttendanceRecorded={loadAllData}
                  onOpenMobileCheckin={(meetingId) => setMobileCheckinMeetingId(meetingId)}
                />
              )}

              {activeTab === 'meetings' && (
                <MeetingsView
                  meetings={meetings}
                  teachers={teachers}
                  onRefresh={loadAllData}
                  onSelectActiveMeeting={(id) => setSelectedMeetingId(id)}
                />
              )}

              {activeTab === 'teachers' && (
                <TeachersView
                  teachers={teachers}
                  schoolProfile={schoolProfile}
                  onRefresh={loadAllData}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsView
                  meetings={meetings}
                  teachers={teachers}
                  attendances={attendances}
                  schoolProfile={schoolProfile}
                />
              )}

              {activeTab === 'profile' && (
                <SchoolProfileView
                  profile={schoolProfile}
                  onRefresh={loadAllData}
                />
              )}
            </>
          )}
        </main>

        {/* 3. Simple & Clean Footer */}
        <footer className="no-print border-t border-slate-200 bg-white py-3 px-6 text-center text-xs text-slate-500">
          <p>
            <strong>dePresent</strong> · Sistem Presensi Kegiatan &copy; {new Date().getFullYear()}
          </p>
        </footer>
      </div>

      {/* Global Modals */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConnectionSuccess={() => {
          loadAllData();
        }}
      />

      <VercelDeployModal
        isOpen={isVercelModalOpen}
        onClose={() => setIsVercelModalOpen(false)}
      />

      <WahaModal
        isOpen={isWahaModalOpen}
        onClose={() => setIsWahaModalOpen(false)}
      />
    </div>
  );
}
