import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, ShieldCheck, ExternalLink } from 'lucide-react';
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

  // Format signed time (with seconds for accuracy)
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

  // Verification URL for scan redirection
  const verificationUrl = typeof window !== 'undefined' && signature?.verification_code
    ? `${window.location.origin}${window.location.pathname}?verify=${encodeURIComponent(signature.verification_code)}&meeting=${signature.meeting_id}`
    : '';

  // Generate QR Code data that directly directs scanner to the dedicated verification page
  useEffect(() => {
    if (isSigned && signature?.verification_code) {
      const targetUrl = typeof window !== 'undefined'
        ? `${window.location.origin}${window.location.pathname}?verify=${encodeURIComponent(signature.verification_code)}&meeting=${signature.meeting_id}`
        : `https://depresent.verify/?code=${signature.verification_code}`;

      QRCode.toDataURL(targetUrl, {
        width: 140,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.warn('QR Code generation error:', err));
    }
  }, [isSigned, signature]);

  // JIKA SUDAH TTD (DISAHKAN SECARA ELEKTRONIK):
  // Cukup QR Code verifikasi otentik untuk semua penandatangan (Stempel ditiadakan)
  if (isSigned) {
    return (
      <div className="flex flex-col items-center justify-between text-center select-none py-1 text-slate-900">
        <p className="text-xs font-bold text-slate-900 print:text-black mb-1">
          {roleTitle}
        </p>

        {/* CONTAINER TTD DIGITAL: CUKUP QR CODE VERIFIKASI RESMI */}
        <div className="h-28 flex flex-col items-center justify-center my-1">
          <a
            href={verificationUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            title="Klik untuk membuka Halaman Verifikasi Keabsahan Dokumen"
            className="group relative flex flex-col items-center cursor-pointer transition-transform hover:scale-105"
          >
            {qrDataUrl ? (
              <div className="relative">
                <img
                  src={qrDataUrl}
                  alt="QR Verifikasi TTD"
                  className="w-18 h-18 object-contain border border-slate-300 p-1 bg-white rounded-md shadow-xs"
                />
                <span className="no-print opacity-0 group-hover:opacity-100 absolute inset-0 bg-slate-900/80 text-white rounded-md text-[8.5px] font-bold flex items-center justify-center gap-0.5 transition-opacity">
                  <ExternalLink className="w-2.5 h-2.5" /> Verifikasi
                </span>
              </div>
            ) : (
              <div className="w-18 h-18 border border-slate-300 rounded-md flex items-center justify-center bg-white">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
            )}
            <span className="text-[9px] font-mono font-bold text-slate-800 print:text-black mt-1 tracking-tight">
              {signature?.verification_code || 'DEP-VERIFIED'}
            </span>
          </a>
        </div>

        {/* NAMA PEJABAT & NIY */}
        <div className="mt-1">
          <p className="font-bold underline text-xs text-slate-950 print:text-black">
            {signerName}
          </p>
          <p className="text-[10px] text-slate-700 font-mono font-medium print:text-black">
            NIY. {signerNiy || '-'}
          </p>
          <p className="text-[8.5px] text-emerald-800 font-bold uppercase tracking-wider print:text-black flex items-center justify-center gap-1 mt-0.5">
            <ShieldCheck className="w-2.5 h-2.5 inline text-emerald-700" />
            <span>Tanda Tangan Elektronik Sah</span>
          </p>
          <p className="text-[8px] text-slate-600 font-mono print:text-slate-600 mt-0.5">
            {signedDateStr} {signedTimeStr} WIB
          </p>
        </div>
      </div>
    );
  }

  // JIKA BELUM TTD (PENDING / DOKUMEN CETAK BELUM DISAHKAN):
  return (
    <div className="flex flex-col justify-between h-36 text-center text-xs py-1 text-slate-900">
      <p className="font-bold text-slate-900 print:text-black">
        {roleTitle}
      </p>

      {/* Kolom kosong untuk tanda tangan basah konvensional */}
      <div className="h-20 flex items-center justify-center text-slate-400 text-[10px] italic print:hidden">
        (Menunggu Persetujuan & Pengesahan)
      </div>

      <div className="mt-auto">
        <p className="font-bold underline text-slate-950 print:text-black">
          {signerName ? signerName : '( ............................................ )'}
        </p>
        <p className="text-[10px] text-slate-700 font-mono font-medium print:text-black">
          NIY. {signerNiy || '-'}
        </p>
      </div>
    </div>
  );
};
