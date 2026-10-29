import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { DocumentSignature, SchoolProfile, SignerRole } from '../types';

interface DigitalSignatureBadgeProps {
  signature?: DocumentSignature;
  role: SignerRole;
  roleTitle: string;
  signerName: string;
  signerNiy?: string;
  schoolProfile: SchoolProfile;
  meetingDate?: string;
  isPrintView?: boolean;
}

export const DigitalSignatureBadge: React.FC<DigitalSignatureBadgeProps> = ({
  signature,
  role,
  roleTitle,
  signerName,
  signerNiy,
  schoolProfile,
  isPrintView = false,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const isSigned = signature?.status === 'signed';
  const isHeadmaster = role === 'headmaster';

  // Format signed time (with seconds as requested by the user for timestamps)
  const signedDateStr = signature?.signed_at
    ? new Date(signature.signed_at).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

  const signedTimeStr = signature?.signed_at
    ? new Date(signature.signed_at).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '';

  // Generate QR Code data
  useEffect(() => {
    if (isSigned && signature?.verification_code) {
      const verifyPayload = JSON.stringify({
        app: 'dePresent',
        code: signature.verification_code,
        role: signature.signer_role,
        name: signature.signer_name,
        niy: signature.signer_niy,
        meetingId: signature.meeting_id,
        signedAt: signature.signed_at,
        doc: signature.document_type,
      });

      QRCode.toDataURL(verifyPayload, {
        width: 140,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.warn('QR Code generation error:', err));
    }
  }, [isSigned, signature]);

  // JIKA SUDAH TTD:
  if (isSigned) {
    return (
      <div className="flex flex-col items-center justify-between text-center select-none py-1">
        <p className="text-xs font-semibold text-slate-800 dark:text-white print:text-black mb-1">
          {roleTitle}
        </p>

        {/* CONTAINER TTD DIGITAL:
            - Kepala Sekolah: Stempel Digital Resmi Sekolah + QR Code
            - Selain Kepala Sekolah (Notulis & Pimpinan): CUKUP QR Code saja */}
        <div className="h-28 flex items-center justify-center gap-3 my-1">
          {/* 1. STEMPEL RESMI KEDINASAN (KHUSUS KEPALA SEKOLAH) */}
          {isHeadmaster && (
            <div className="relative w-24 h-24 rounded-full border-2 border-double border-blue-800 flex items-center justify-center p-1 text-blue-900 font-sans tracking-tight shrink-0 shadow-xs bg-blue-50/40 print:bg-transparent">
              {/* Lingkaran dalam */}
              <div className="w-full h-full rounded-full border border-blue-700/80 flex flex-col items-center justify-center text-center p-1 relative">
                {/* Teks Atas Sekolah */}
                <span className="text-[7px] font-black uppercase tracking-tighter leading-tight max-w-[76px] truncate text-blue-950">
                  {schoolProfile.school_name?.replace('SMP ', '') || 'SMP MUH 1'}
                </span>

                {/* Garis pemisah tengah stempel */}
                <div className="w-14 h-[1px] bg-blue-800 my-0.5" />

                {/* Teks Status Tengah Stempel */}
                <div className="flex flex-col items-center justify-center">
                  <span className="text-[7.5px] font-black uppercase text-blue-900 tracking-wider leading-none">
                    TERSAHKAN
                  </span>
                  <span className="text-[6.5px] font-bold text-blue-800 leading-tight">
                    ELEKTRONIK
                  </span>
                </div>

                <div className="w-14 h-[1px] bg-blue-800 my-0.5" />

                {/* Tanggal & Jam dengan detik */}
                <span className="text-[6px] font-mono font-bold text-blue-950 leading-none">
                  {signedDateStr} {signedTimeStr}
                </span>

                {/* Bintang Ornamen */}
                <span className="text-[6px] text-blue-800 absolute left-1 top-1/2 -translate-y-1/2">★</span>
                <span className="text-[6px] text-blue-800 absolute right-1 top-1/2 -translate-y-1/2">★</span>
              </div>
            </div>
          )}

          {/* 2. QR CODE VERIFIKASI RESMI (UNTUK SEMUA PEJABAT: NOTULIS, PIMPINAN, DAN KEPALA SEKOLAH) */}
          <div className="flex flex-col items-center shrink-0">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Verifikasi TTD"
                className="w-16 h-16 object-contain border border-slate-300 p-0.5 bg-white shadow-2xs"
              />
            ) : (
              <div className="w-16 h-16 border border-slate-300 flex items-center justify-center bg-white">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
            )}
            <span className="text-[8px] font-mono font-bold text-slate-700 dark:text-teal-300 print:text-black mt-0.5">
              {signature?.verification_code || 'DEP-VERIFIED'}
            </span>
          </div>
        </div>

        {/* NAMA PEJABAT & NIY */}
        <div className="mt-1">
          <p className="font-bold underline text-xs text-slate-900 dark:text-white print:text-black">
            {signerName}
          </p>
          <p className="text-[10px] text-slate-700 dark:text-teal-300/80 font-mono print:text-black">
            NIY. {signerNiy || '-'}
          </p>
          <p className="text-[8px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider print:text-black flex items-center justify-center gap-1 mt-0.5">
            <ShieldCheck className="w-2.5 h-2.5 inline" />
            <span>Tanda Tangan Elektronik Sah</span>
          </p>
        </div>
      </div>
    );
  }

  // JIKA BELUM TTD (PENDING / DOKUMEN CETAK BELUM DISAHKAN):
  return (
    <div className="flex flex-col justify-between h-36 text-center text-xs py-1">
      <p className="font-semibold text-slate-800 dark:text-teal-100 print:text-black">
        {roleTitle}
      </p>

      {/* Kolom kosong untuk tanda tangan basah konvensional */}
      <div className="h-20 flex items-center justify-center text-slate-400 dark:text-teal-300/40 text-[10px] italic print:hidden">
        (Menunggu Persetujuan & Pengesahan)
      </div>

      <div className="mt-auto">
        <p className="font-bold underline text-slate-900 dark:text-white print:text-black">
          {signerName ? signerName : '( ............................................ )'}
        </p>
        <p className="text-[10px] text-slate-700 dark:text-teal-300/80 font-mono print:text-black">
          NIY. {signerNiy || '-'}
        </p>
      </div>
    </div>
  );
};
