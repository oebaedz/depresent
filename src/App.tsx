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
import { InvitationsView } from './components/InvitationsView';
import { RsvpConfirmationView } from './components/RsvpConfirmationView';
import { SignatureApprovalView } from './components/SignatureApprovalView';
import { SignatureVerificationView } from './components/SignatureVerificationView';
import { AdminPinModal } from './components/AdminPinModal';
import { SupabaseModal } from './components/SupabaseModal';
import { VercelDeployModal } from './components/VercelDeployModal';
import { WahaModal } from './components/WahaModal';
import { Attendance, Invitation, Meeting, SchoolProfile, Teacher, DocumentType, SignerRole } from './types';
import {
  fetchAttendances,
  fetchInvitations,
  fetchMeetings,
  fetchSchoolProfile,
  fetchSingleMeeting,
  fetchTeachers,
  getCachedAttendances,
  getCachedInvitations,
  getCachedMeetings,
  getCachedProfile,
  getCachedTeachers,
  initLocalStorage,
  updateAdminPinInDb,
} from './lib/storage';
import { getSupabase } from './lib/supabase';
import { Menu, Database, AlertTriangle, CheckCircle2, Lock, Sun, Moon } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Theme Management (Dark Mode & Dark Teal theme toggle)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('smp_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
        document.body.classList.remove('dark');
      }
      localStorage.setItem('smp_theme', theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Check if current URL is a teacher RSVP link (e.g. ?rsvp=<meetingId>&t=<teacherId>)
  const [rsvpParams] = useState<{ meetingId: string; teacherId: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const meetingId = params.get('rsvp');
      const teacherId = params.get('t') || params.get('teacher');
      if (meetingId && teacherId) {
        return { meetingId, teacherId };
      }
    }
    return null;
  });

  // Check if current URL is a digital signature approval link (e.g. ?sign=<meetingId>&role=<role>&doc=<doc>)
  const [signParams] = useState<{ meetingId: string; role?: SignerRole; doc?: DocumentType } | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const meetingId = params.get('sign');
      if (meetingId) {
        return {
          meetingId,
          role: (params.get('role') as SignerRole) || 'secretary',
          doc: (params.get('doc') as DocumentType) || 'attendance_report',
        };
      }
    }
    return null;
  });

  // Check if current URL is a QR code document verification link (e.g. ?verify=<code> or ?code=<code>)
  const [verifyParams] = useState<{ code: string; meetingId?: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('verify') || params.get('code') || params.get('cert');
      if (code) {
        return {
          code,
          meetingId: params.get('meeting') || params.get('meetingId') || undefined,
        };
      }
    }
    return null;
  });


  // Check if current URL is a teacher mobile checkin link (e.g. ?checkin=<meetingId>)
  const [mobileCheckinMeetingId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('checkin');
    }
    return null;
  });


  // Local-First Synchronous State Initialization (0ms startup latency)
  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile>(() => getCachedProfile());
  const [teachers, setTeachers] = useState<Teacher[]>(() => getCachedTeachers());
  const [meetings, setMeetings] = useState<Meeting[]>(() => getCachedMeetings());
  const [attendances, setAttendances] = useState<Attendance[]>(() => getCachedAttendances());
  const [invitations, setInvitations] = useState<Invitation[]>(() => getCachedInvitations());

  // Connection & Modals
  const [supabaseStatus, setSupabaseStatus] = useState<'local' | 'tables_missing' | 'connected' | 'demo'>('local');
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isVercelModalOpen, setIsVercelModalOpen] = useState(false);
  const [isWahaModalOpen, setIsWahaModalOpen] = useState(false);

  // Admin PIN Protection Gate
  const [adminPin, setAdminPin] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('smp_admin_pin') || '1234';
    }
    return '1234';
  });

  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('smp_admin_unlocked') === 'true';
    }
    return false;
  });

  const handleAdminUnlock = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('smp_admin_unlocked', 'true');
    }
    setIsAdminUnlocked(true);
  };

  const handleAdminLock = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('smp_admin_unlocked');
    }
    setIsAdminUnlocked(false);
  };

  const handleUpdateAdminPin = async (newPin: string) => {
    setAdminPin(newPin);
    await updateAdminPinInDb(newPin);
  };

  // Selected meeting for projector or scanner
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(() => {
    const initialMeetings = getCachedMeetings();
    const active = initialMeetings.find((m) => m.status === 'active') || initialMeetings[0];
    return active?.id || '';
  });

  // Fast Mobile Meeting Resolver
  const [mobileMeeting, setMobileMeeting] = useState<Meeting | undefined>(() => {
    if (mobileCheckinMeetingId) {
      return getCachedMeetings().find((m) => m.id === mobileCheckinMeetingId);
    }
    return undefined;
  });
  const [isLoadingMobileMeeting, setIsLoadingMobileMeeting] = useState<boolean>(
    Boolean(mobileCheckinMeetingId && !mobileMeeting)
  );

  useEffect(() => {
    if (!mobileCheckinMeetingId) return;

    const existing = meetings.find((m) => m.id === mobileCheckinMeetingId);
    if (existing) {
      setMobileMeeting(existing);
      setIsLoadingMobileMeeting(false);
      return;
    }

    let isMounted = true;
    fetchSingleMeeting(mobileCheckinMeetingId).then((found) => {
      if (isMounted) {
        if (found) {
          setMobileMeeting(found);
        }
        setIsLoadingMobileMeeting(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [mobileCheckinMeetingId, meetings]);

  // Fast Background Stale-While-Revalidate without blocking render
  const loadAllData = useCallback(async () => {
    try {
      initLocalStorage();
      const client = getSupabase();

      if (!client) {
        setSupabaseStatus('local');
      } else {
        setSupabaseStatus('connected');
      }

      const [profileData, teacherData, meetingData, attendanceData, invitationData] = await Promise.all([
        fetchSchoolProfile(),
        fetchTeachers(),
        fetchMeetings(),
        fetchAttendances(),
        fetchInvitations(),
      ]);

      setSchoolProfile(profileData);
      setTeachers(teacherData);
      setMeetings(meetingData);
      setAttendances(attendanceData);
      setInvitations(invitationData);

      if (profileData.admin_pin) {
        setAdminPin(profileData.admin_pin);
        localStorage.setItem('smp_admin_pin', profileData.admin_pin);
      }

      if (meetingData.length > 0 && !selectedMeetingId) {
        const active = meetingData.find((m) => m.status === 'active') || meetingData[0];
        setSelectedMeetingId(active.id);
      }
    } catch (err) {
      console.error('Error syncing dePresent data:', err);
    } finally {
      setIsInitialLoading(false);
    }
  }, [selectedMeetingId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // -------------------------------------------------------------------------
  // REAL-TIME SYNC: Otomatis sinkronisasi kehadiran tanpa perlu reload manual
  // -------------------------------------------------------------------------
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;

    // Supabase Postgres Changes Channel
    const channel = client
      .channel('depresent_realtime_channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'smp_attendances' },
        async () => {
          const fresh = await fetchAttendances();
          setAttendances(fresh);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'smp_meetings' },
        async () => {
          const fresh = await fetchMeetings();
          setMeetings(fresh);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'smp_school_profile' },
        async () => {
          const fresh = await fetchSchoolProfile();
          setSchoolProfile(fresh);
          if (fresh.admin_pin) {
            setAdminPin(fresh.admin_pin);
            localStorage.setItem('smp_admin_pin', fresh.admin_pin);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'smp_teachers' },
        async () => {
          const fresh = await fetchTeachers();
          setTeachers(fresh);
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  // Sinkronisasi logo tab browser dengan logo sekolah yayasan jika ada
  useEffect(() => {
    if (typeof document !== 'undefined' && schoolProfile.logo_url) {
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
      if (link) {
        link.href = schoolProfile.logo_url;
      }
    }
  }, [schoolProfile.logo_url]);

  // Listener event lokal & multi-tab browser
  useEffect(() => {
    const handleLocalAttendance = () => {
      setAttendances(getCachedAttendances());
    };

    const handlePinUpdated = (e: Event) => {
      const custom = e as CustomEvent<string>;
      if (custom.detail) {
        setAdminPin(custom.detail);
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'smp_attendances_v3') {
        setAttendances(getCachedAttendances());
      } else if (e.key === 'smp_meetings_v3') {
        setMeetings(getCachedMeetings());
      } else if (e.key === 'smp_admin_pin' && e.newValue) {
        setAdminPin(e.newValue);
      } else if (e.key === 'smp_school_profile_v3') {
        setSchoolProfile(getCachedProfile());
      }
    };

    window.addEventListener('smp_attendance_recorded', handleLocalAttendance);
    window.addEventListener('smp_pin_updated', handlePinUpdated);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener('smp_attendance_recorded', handleLocalAttendance);
      window.removeEventListener('smp_pin_updated', handlePinUpdated);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  const currentMeeting = meetings.find((m) => m.id === selectedMeetingId) || meetings[0];
  const targetCheckinMeeting = mobileMeeting || meetings.find((m) => m.id === mobileCheckinMeetingId);

  // -------------------------------------------------------------------------
  // PUBLIC DOCUMENT & SIGNATURE VERIFICATION MODE (via QR Code Scan)
  // -------------------------------------------------------------------------
  if (verifyParams) {
    return (
      <SignatureVerificationView
        verificationCode={verifyParams.code}
        meetingId={verifyParams.meetingId}
        meetings={meetings}
        teachers={teachers}
        attendances={attendances}
        schoolProfile={schoolProfile}
        onDone={() => {
          if (typeof window !== 'undefined') window.location.href = window.location.pathname;
        }}
      />
    );
  }

  // -------------------------------------------------------------------------
  // DIGITAL SIGNATURE APPROVAL MODE (Isolated View for Signers via WhatsApp Link)
  // -------------------------------------------------------------------------
  if (signParams) {
    return (
      <SignatureApprovalView
        meetingId={signParams.meetingId}
        roleParam={signParams.role}
        docParam={signParams.doc}
        meetings={meetings}
        teachers={teachers}
        attendances={attendances}
        invitations={invitations}
        schoolProfile={schoolProfile}
        onRefresh={loadAllData}
      />
    );
  }


  // -------------------------------------------------------------------------
  // RSVP CONFIRMATION MODE (Isolated View for Teachers via WhatsApp Link)
  // -------------------------------------------------------------------------
  if (rsvpParams) {
    return (
      <RsvpConfirmationView
        meetingId={rsvpParams.meetingId}
        teacherId={rsvpParams.teacherId}
        meetings={meetings}
        teachers={teachers}
        schoolProfile={schoolProfile}
        onDone={() => {
          if (typeof window !== 'undefined') window.location.href = window.location.pathname;
        }}
      />
    );
  }


  // -------------------------------------------------------------------------
  // MOBILE CHECKIN MODE (Isolated Sandboxed View for Teachers via QR Scan)
  // -------------------------------------------------------------------------
  if (mobileCheckinMeetingId) {
    if (isLoadingMobileMeeting) {
      return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-md max-w-sm w-full space-y-4">
            <div className="w-12 h-12 rounded-xl bg-teal-800 text-white font-black flex items-center justify-center text-lg mx-auto animate-pulse">
              dP
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">Menghubungkan ke Presensi...</h3>
              <p className="text-xs text-slate-500">Memuat data agenda rapat & daftar guru</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <MobileCheckinView
        meeting={targetCheckinMeeting}
        teachers={teachers}
        schoolProfile={schoolProfile}
        onSuccess={loadAllData}
      />
    );
  }

  // -------------------------------------------------------------------------
  // ADMIN PIN GATE: If not unlocked, display the PIN lock screen
  // -------------------------------------------------------------------------
  if (!isAdminUnlocked) {
    return (
      <AdminPinModal
        schoolProfile={schoolProfile}
        correctPin={adminPin}
        onSuccess={handleAdminUnlock}
      />
    );
  }

  const pageTitles: Record<ActiveTab, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard Presensi', subtitle: 'Pantau kehadiran kegiatan dan statistik real-time' },
    scanner: { title: 'Scan Panitia', subtitle: 'Pindai ID Card fisik guru menggunakan kamera pemindai' },
    projector: { title: 'Layar Proyektor Rapat', subtitle: 'Tampilan layar lebar panggung rapat & presensi mandiri' },
    meetings: { title: 'Agenda Rapat & Kegiatan', subtitle: 'Kelola jadwal rapat kedinasan, pimpinan & notulis' },
    invitations: { title: 'Surat Undangan & Buku Ekspedisi', subtitle: 'Penerbitan surat dinas, pengiriman RSVP WhatsApp WAHA, dan cetak buku ekspedisi resmi' },
    teachers: { title: 'Data Guru & ID Card Portrait', subtitle: 'Manajemen PTK ber-NIY dan cetak ID Card format tegak' },
    reports: { title: 'Laporan Resmi Kedinasan', subtitle: 'Format siap cetak Kop Surat Yayasan dan ekspor spreadsheet XLSX' },
    profile: { title: 'Profil Yayasan & Sekolah', subtitle: 'Konfigurasi identitas yayasan, sekolah, logo & PIN admin' },
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#031e21] flex text-slate-800 dark:text-teal-50 antialiased selection:bg-teal-700 selection:text-white transition-colors duration-150">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSupabaseConnected={supabaseStatus === 'connected'}
        supabaseStatus={supabaseStatus}
        isAdminUnlocked={isAdminUnlocked}
        onAdminLock={handleAdminLock}
        onAdminUnlockRequest={() => setIsAdminUnlocked(false)}
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
        <header className="sticky top-0 z-30 bg-white dark:bg-[#072b2f] border-b border-slate-200 dark:border-[#0f4950] h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between no-print transition-colors duration-150 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-teal-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#0b383d] cursor-pointer"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb / Current View Title */}
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 dark:text-white truncate leading-none">
                {pageTitles[activeTab].title}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-teal-300/80 mt-1 truncate">
                {pageTitles[activeTab].subtitle}
              </p>
            </div>
          </div>

          {/* Quick Header Badges / Status */}
          <div className="flex items-center gap-2.5 shrink-0">
            {schoolProfile.school_name && (
              <span className="hidden sm:inline-block text-xs font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-[#0b383d] border border-teal-200 dark:border-teal-700/60 px-2.5 py-1 rounded-md truncate max-w-[200px]">
                {schoolProfile.school_name}
              </span>
            )}

            {/* Dark Mode Toggle Button */}
            <button
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-teal-100 bg-slate-100 dark:bg-[#0b383d] hover:bg-slate-200 dark:hover:bg-[#0f4950] border border-slate-300 dark:border-teal-700/60 rounded-lg transition-all shadow-xs cursor-pointer"
              title={theme === 'dark' ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap (Dark Teal)'}
              aria-label="Toggle Mode Gelap dan Terang"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-300" />
                  <span className="font-medium">Mode Terang</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-teal-700" />
                  <span className="font-medium">Mode Gelap</span>
                </>
              )}
            </button>
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
                className="px-3 py-1 bg-slate-950 text-white rounded-md text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                Buka SQL Schema
              </button>
            </div>
          </aside>
        )}

        {/* 3. Dynamic Active View Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {isInitialLoading && getSupabase() ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-16 bg-slate-200 dark:bg-[#072b2f] rounded-2xl border border-slate-300 dark:border-[#0f4950]" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-24 bg-slate-200 dark:bg-[#072b2f] rounded-xl border border-slate-300 dark:border-[#0f4950]" />
                ))}
              </div>
              <div className="h-96 bg-slate-200 dark:bg-[#072b2f] rounded-2xl border border-slate-300 dark:border-[#0f4950]" />
            </div>
          ) : (
            <div className="transition-all duration-150">
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
                onOpenMobileCheckin={(meetingId) => {
                  window.open(`?checkin=${meetingId}`, '_blank');
                }}
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

            {activeTab === 'invitations' && (
              <InvitationsView
                meetings={meetings}
                teachers={teachers}
                invitations={invitations}
                onRefreshInvitations={loadAllData}
                schoolProfile={schoolProfile}
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
                adminPin={adminPin}
                onUpdateAdminPin={handleUpdateAdminPin}
              />
            )}
          </div>
        )}
      </main>
      </div>

      {/* 4. Global Modals */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConnectionSuccess={loadAllData}
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
