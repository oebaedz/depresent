import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Printer, Download, FileSpreadsheet, FileText, CheckCircle2, Calendar, MapPin, User, Check, Building2 } from 'lucide-react';
import { Attendance, Meeting, SchoolProfile, Teacher } from '../types';

interface ReportsViewProps {
  meetings: Meeting[];
  teachers: Teacher[];
  attendances: Attendance[];
  schoolProfile: SchoolProfile;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  meetings,
  teachers,
  attendances,
  schoolProfile,
}) => {
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(meetings[0]?.id || '');
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const currentMeeting = meetings.find((m) => m.id === selectedMeetingId) || meetings[0];

  const meetingAttendances = currentMeeting
    ? attendances.filter((a) => a.meeting_id === currentMeeting.id)
    : [];

  const attendanceMap = new Map<string, Attendance>();
  meetingAttendances.forEach((a) => attendanceMap.set(a.teacher_id, a));

  // Metrics
  const activeTeachers = teachers.filter((t) => t.is_active);
  const total = activeTeachers.length;
  const hadir = meetingAttendances.filter((a) => a.status === 'hadir').length;
  const terlambat = meetingAttendances.filter((a) => a.status === 'terlambat').length;
  const izin = meetingAttendances.filter((a) => a.status === 'izin').length;
  const sakit = meetingAttendances.filter((a) => a.status === 'sakit').length;
  const belum = Math.max(0, total - (hadir + terlambat + izin + sakit));
  const rate = total > 0 ? Math.round(((hadir + terlambat) / total) * 100) : 0;

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Export to Excel XLSX using SheetJS
  const handleExportXLSX = () => {
    if (!currentMeeting) return;

    // 1. Sheet Rekap
    const rekapData = [
      ['DAFTAR HADIR PESERTA KEGIATAN'],
      [schoolProfile.foundation_name || 'YAYASAN PENDIDIKAN HARAPAN BANGSA'],
      [schoolProfile.school_name || 'SMP HARAPAN BANGSA'],
      ['NPSN: ' + (schoolProfile.npsn || '-'), 'Alamat: ' + (schoolProfile.address || '-')],
      [],
      ['INFORMASI AGENDA RAPAT'],
      ['Nama Agenda:', currentMeeting.title],
      ['Kategori:', currentMeeting.category],
      ['Hari / Tanggal:', currentMeeting.meeting_date],
      ['Waktu Pelaksanaan:', `${currentMeeting.start_time} - ${currentMeeting.end_time} WIB`],
      ['Tempat / Ruang:', currentMeeting.room],
      ['Pimpinan Rapat:', currentMeeting.leader_name + (currentMeeting.leader_niy ? ` (NIY. ${currentMeeting.leader_niy})` : '')],
      ['Notulis Rapat:', (currentMeeting.secretary_name || '-') + (currentMeeting.secretary_niy ? ` (NIY. ${currentMeeting.secretary_niy})` : '')],
      [],
      ['RINGKASAN KEHADIRAN'],
      ['Total Guru Terdaftar:', total],
      ['Hadir Tepat Waktu:', hadir],
      ['Hadir Terlambat:', terlambat],
      ['Izin Dinas:', izin],
      ['Sakit:', sakit],
      ['Tidak Hadir (Alpa):', meetingAttendances.filter((a) => a.status === 'alpa').length + (currentMeeting.status === 'completed' ? belum : 0)],
      ['Persentase Kehadiran:', `${rate}%`],
      [],
      ['Mengetahui,', 'Pimpinan Rapat,', 'Notulis Rapat,'],
      ['Kepala Sekolah,', '', ''],
      [],
      [],
      [
        schoolProfile.headmaster_name,
        currentMeeting.leader_name,
        currentMeeting.secretary_name || '-',
      ],
      [
        'NIY. ' + (schoolProfile.headmaster_niy || '-'),
        'NIY. ' + (currentMeeting.leader_niy || '-'),
        'NIY. ' + (currentMeeting.secretary_niy || '-'),
      ],
    ];

    // 2. Sheet Rincian Peserta
    const detailHeaders = [
      'No',
      'NIY / NUPTK',
      'Nama Guru',
      'Pangkat / Status',
      'Jabatan / Mata Pelajaran',
      'Status Kehadiran',
      'Waktu Presensi',
      'Verifikasi',
      'Catatan / Keterangan',
    ];

    const detailRows = activeTeachers.map((t, idx) => {
      const att = attendanceMap.get(t.id);
      const isPresent = att && (att.status === 'hadir' || att.status === 'terlambat');
      const statusText = att
        ? att.status === 'alpa'
          ? 'TIDAK HADIR'
          : att.status.toUpperCase()
        : currentMeeting.status === 'completed'
        ? 'TIDAK HADIR'
        : 'BELUM HADIR';

      return [
        idx + 1,
        t.niy || t.nip || '-',
        t.name,
        t.rank_group,
        t.role_title,
        statusText,
        att ? new Date(att.check_in_time).toLocaleTimeString('id-ID') : '-',
        isPresent ? 'Verified' : '-',
        att?.notes || '-',
      ];
    });

    const detailSheetData = [detailHeaders, ...detailRows];

    // Build workbook
    const wb = XLSX.utils.book_new();
    const wsRekap = XLSX.utils.aoa_to_sheet(rekapData);
    const wsDetail = XLSX.utils.aoa_to_sheet(detailSheetData);

    XLSX.utils.book_append_sheet(wb, wsRekap, 'Ringkasan Rapat');
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Daftar Hadir Rinci');

    const cleanTitle = currentMeeting.title.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Presensi_${cleanTitle}_${currentMeeting.meeting_date}.xlsx`;

    XLSX.writeFile(wb, filename);

    setExportSuccess(`File Excel "${filename}" berhasil diunduh!`);
    setTimeout(() => setExportSuccess(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Laporan Resmi & Berkas Presensi Kedinasan</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Format resmi ber-Kop Surat Yayasan, daftar hadir ber-NIY, tanda tangan pimpinan rapat & notulis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Select Meeting */}
          <select
            value={selectedMeetingId}
            onChange={(e) => setSelectedMeetingId(e.target.value)}
            className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:ring-2 focus:ring-blue-600 focus:outline-hidden max-w-xs truncate"
          >
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title} ({m.meeting_date})
              </option>
            ))}
          </select>

          {/* Export XLSX Button */}
          <button
            onClick={handleExportXLSX}
            className="px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Ekspor File Excel (.xlsx)</span>
          </button>

          {/* Print PDF Button */}
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak Dokumen Resmi (PDF)</span>
          </button>
        </div>
      </div>

      {exportSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-medium flex items-center gap-2 no-print">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{exportSuccess}</span>
        </div>
      )}

      {/* Official Printable Report Document */}
      <div className="bg-white p-8 md:p-12 rounded-xl border border-slate-300 shadow-sm max-w-4xl mx-auto print:border-none print:shadow-none print:p-0">
        {/* 1. Official Foundation & School Letterhead (Kop Surat) */}
        <div className="border-b-4 border-double border-slate-900 pb-3 mb-6 text-center relative font-serif">
          {/* Logo */}
          <div className="absolute left-2 top-1 w-16 h-16 rounded-full border border-slate-400 bg-slate-50 flex items-center justify-center font-bold text-xs text-blue-950 font-sans print:border-slate-800 overflow-hidden">
            {schoolProfile.logo_url ? (
              <img
                src={schoolProfile.logo_url}
                alt="Logo"
                className="w-full h-full object-contain p-1"
              />
            ) : (
              'LOGO'
            )}
          </div>

          <div className="px-16">
            {/* BARIS 1: NAMA YAYASAN */}
            <h2 className="text-sm md:text-base font-black uppercase tracking-wider text-blue-950 leading-tight">
              {schoolProfile.foundation_name || 'YAYASAN PENDIDIKAN HARAPAN BANGSA'}
            </h2>

            {/* BARIS 2: NAMA SEKOLAH */}
            <h1 className="text-lg md:text-xl font-black uppercase tracking-tight text-slate-900 leading-tight mt-0.5">
              {schoolProfile.school_name || 'SMP HARAPAN BANGSA'}
            </h1>

            <p className="text-[11px] text-slate-600 font-sans mt-1">
              {schoolProfile.address || 'Jl. Ki Hajar Dewantara No. 45, Kompleks Yayasan'} · NPSN: {schoolProfile.npsn || '20104567'}
            </p>
            <p className="text-[10px] text-slate-500 font-sans">
              Telepon: {schoolProfile.phone || '-'} · Email: {schoolProfile.email || '-'} · Website: {schoolProfile.website || '-'}
            </p>
          </div>
        </div>

        {/* 2. Document Title & Metadata */}
        <div className="text-center space-y-1 mb-6 font-sans">
          <h2 className="text-sm md:text-base font-black uppercase underline tracking-wider text-slate-900">
            DAFTAR HADIR PESERTA KEGIATAN
          </h2>
          <p className="text-xs font-bold text-slate-800">
            {currentMeeting?.title}
          </p>
        </div>

        {/* 3. Meeting Schedule Info Table */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 font-sans text-xs space-y-2 print:bg-white print:border-slate-400">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <span className="text-slate-500 block text-[10px]">Hari / Tanggal</span>
              <span className="font-bold text-slate-900">{currentMeeting?.meeting_date}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Waktu</span>
              <span className="font-bold text-slate-900 font-mono">{currentMeeting?.start_time} - {currentMeeting?.end_time} WIB</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Tempat</span>
              <span className="font-bold text-slate-900">{currentMeeting?.room}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px]">Pimpinan Rapat</span>
              <span className="font-bold text-slate-900">{currentMeeting?.leader_name}</span>
            </div>
          </div>
        </div>

        {/* 4. Tabular Attendance Grid with NIY & Signature Columns */}
        <div className="mb-6 overflow-x-auto">
          <table className="w-full text-left border-collapse border border-slate-400 text-xs font-sans">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400 text-slate-900 font-bold uppercase text-[10px] tracking-wider text-center">
                <th className="py-2 px-2 border-r border-slate-400 w-10">No</th>
                <th className="py-2 px-3 border-r border-slate-400 text-left">Nama Guru & Pegawai</th>
                <th className="py-2 px-3 border-r border-slate-400 text-left">NIY / Status</th>
                <th className="py-2 px-3 border-r border-slate-400 text-left">Jabatan</th>
                <th className="py-2 px-2 border-r border-slate-400 w-20">Jam Hadir</th>
                <th className="py-2 px-2 border-r border-slate-400 w-24">Status</th>
                <th className="py-2 px-3 border-slate-400 w-28 text-center">Verifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300">
              {activeTeachers.map((t, index) => {
                const att = attendanceMap.get(t.id);
                const isPresent = att && (att.status === 'hadir' || att.status === 'terlambat');
                const isAbsent = (att && att.status === 'alpa') || (!att && currentMeeting?.status === 'completed');

                return (
                  <tr key={t.id} className="hover:bg-slate-50/50 print:hover:bg-white page-break-inside-avoid">
                    <td className="py-2 px-2 text-center border-r border-slate-300 font-mono tabular-nums">
                      {index + 1}
                    </td>

                    <td className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-900">
                      {t.name}
                    </td>

                    <td className="py-2 px-3 border-r border-slate-300 text-slate-700">
                      <div className="font-mono text-[11px]">{t.niy || t.nip || '-'}</div>
                      <div className="text-[10px] text-slate-500">{t.rank_group}</div>
                    </td>

                    <td className="py-2 px-3 border-r border-slate-300 text-slate-700 text-[11px]">
                      {t.role_title}
                    </td>

                    <td className="py-2 px-2 border-r border-slate-300 text-center font-mono text-[11px] tabular-nums">
                      {att ? new Date(att.check_in_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>

                    <td className="py-2 px-2 border-r border-slate-300 text-center text-[10px] font-bold">
                      {att ? (
                        <span
                          className={
                            att.status === 'hadir'
                              ? 'text-emerald-800'
                              : att.status === 'terlambat'
                              ? 'text-amber-800'
                              : att.status === 'alpa'
                              ? 'text-red-700'
                              : 'text-blue-800'
                          }
                        >
                          {att.status === 'alpa' ? 'TIDAK HADIR' : att.status.toUpperCase()}
                        </span>
                      ) : isAbsent ? (
                        <span className="text-red-700 font-bold">TIDAK HADIR</span>
                      ) : (
                        <span className="text-slate-400 font-normal">BELUM HADIR</span>
                      )}
                    </td>

                    {/* Verification Column: Verified if present, - if not present */}
                    <td className="py-1 px-3 border-slate-300 text-xs text-center">
                      {isPresent ? (
                        <div className="flex items-center justify-center gap-1.5 text-emerald-800 text-[10px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-mono font-bold">Verified</span>
                        </div>
                      ) : (
                        <span className="font-mono text-slate-400 font-bold text-xs">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 5. Attendance Recapitulation Box */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-300 mb-8 font-sans text-xs print:bg-white print:border-slate-400 page-break-inside-avoid">
          <h4 className="font-bold text-slate-900 mb-2 uppercase text-[11px] tracking-wide">
            Rekapitulasi Kehadiran Peserta:
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-slate-700">
            <div>
              Total Guru: <strong className="font-mono">{total}</strong> orang
            </div>
            <div>
              Hadir Tepat: <strong className="font-mono text-emerald-700">{hadir}</strong> orang
            </div>
            <div>
              Terlambat: <strong className="font-mono text-amber-700">{terlambat}</strong> orang
            </div>
            <div>
              Izin / Sakit: <strong className="font-mono text-blue-700">{izin + sakit}</strong> orang
            </div>
            <div>
              Persentase: <strong className="font-mono text-slate-900">{rate}%</strong>
            </div>
          </div>
        </div>

        {/* 6. Formal Closing Signatures (Headmaster, Meeting Leader, and Meeting Secretary) */}
        <div className="pt-4 grid grid-cols-3 text-center text-xs font-sans page-break-inside-avoid gap-4">
          {/* Kepala Sekolah */}
          <div>
            <p className="text-slate-600">Mengetahui,</p>
            <p className="font-bold text-slate-900">Kepala Sekolah</p>
            <div className="h-16" />
            <p className="font-bold underline text-slate-900">{schoolProfile.headmaster_name}</p>
            <p className="text-slate-600 font-mono text-[11px]">NIY. {schoolProfile.headmaster_niy}</p>
          </div>

          {/* Pimpinan Rapat Tertentu */}
          <div>
            <p className="text-slate-600">&nbsp;</p>
            <p className="font-bold text-slate-900">Pimpinan Rapat</p>
            <div className="h-16" />
            <p className="font-bold underline text-slate-900">{currentMeeting?.leader_name}</p>
            <p className="text-slate-600 font-mono text-[11px]">
              {currentMeeting?.leader_niy ? `NIY. ${currentMeeting.leader_niy}` : 'Pimpinan Agenda'}
            </p>
          </div>

          {/* Notulis Rapat Tertentu */}
          <div>
            <p className="text-slate-600">
              {schoolProfile.city || 'Kota'}, {currentMeeting?.meeting_date ? new Date(currentMeeting.meeting_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('id-ID')}
            </p>
            <p className="font-bold text-slate-900">Notulis Rapat</p>
            <div className="h-16" />
            <p className="font-bold underline text-slate-900">{currentMeeting?.secretary_name || '-'}</p>
            <p className="text-slate-600 font-mono text-[11px]">
              {currentMeeting?.secretary_niy ? `NIY. ${currentMeeting.secretary_niy}` : 'Notulis'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
