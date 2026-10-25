import React, { useState } from 'react';
import { Lock, Shield, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';
import { SchoolProfile } from '../types';

interface AdminPinModalProps {
  schoolProfile: SchoolProfile;
  correctPin: string;
  onSuccess: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  schoolProfile,
  correctPin,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleDigitClick = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);
      if (nextPin === correctPin) {
        setTimeout(onSuccess, 150);
      } else if (nextPin.length >= correctPin.length) {
        setError(true);
        setErrorMessage('PIN salah. Silakan coba lagi.');
        setTimeout(() => setPin(''), 600);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === correctPin) {
      onSuccess();
    } else {
      setError(true);
      setErrorMessage('PIN salah. Silakan coba lagi.');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 dark:bg-black/85 backdrop-blur-md">
      <div className="bg-white dark:bg-[#072b2f] rounded-3xl shadow-2xl max-w-sm w-full p-6 sm:p-7 border border-slate-100 dark:border-[#0f4950] space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* App & School Branding */}
        <div className="space-y-2">
          {schoolProfile.logo_url ? (
            <img
              src={schoolProfile.logo_url}
              alt="Logo"
              className="w-16 h-16 object-contain rounded-2xl mx-auto p-1.5 bg-slate-50 dark:bg-[#031e21] border border-slate-200 dark:border-[#0f4950] shadow-xs"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-teal-800 text-white font-black flex items-center justify-center text-xl mx-auto shadow-md">
              dP
            </div>
          )}

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">
              dePresent Sistem Presensi Kegiatan
            </p>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
              {schoolProfile.school_name || 'SMP Harapan Bangsa'}
            </h2>
            <div className="flex items-center justify-center gap-1.5 mt-1 text-slate-500 dark:text-teal-200/80 text-xs">
              <Shield className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
              <span className="font-medium">Akses Panel Admin & Operator</span>
            </div>
          </div>
        </div>

        {/* PIN Input Display */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="flex items-center justify-center gap-3 py-2">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full transition-all duration-150 ${
                    error
                      ? 'bg-rose-500 scale-110 animate-shake'
                      : isFilled
                      ? 'bg-teal-700 dark:bg-teal-400 scale-110 shadow-xs'
                      : 'bg-slate-200 dark:bg-[#031e21]'
                  }`}
                />
              );
            })}
          </div>

          {error && (
            <div className="flex items-center justify-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Quick Digit Keypad */}
          <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto pt-1">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigitClick(num)}
                className="h-12 rounded-xl bg-slate-50 dark:bg-[#031e21] hover:bg-slate-100 dark:hover:bg-[#0b383d] active:bg-slate-200 dark:active:bg-[#0f4950] font-bold text-base text-slate-800 dark:text-white transition-colors border border-slate-200/80 dark:border-[#0f4950] shadow-xs cursor-pointer"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPin('')}
              className="h-12 rounded-xl text-xs font-bold text-slate-400 dark:text-teal-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#031e21] transition-colors cursor-pointer"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleDigitClick('0')}
              className="h-12 rounded-xl bg-slate-50 dark:bg-[#031e21] hover:bg-slate-100 dark:hover:bg-[#0b383d] active:bg-slate-200 dark:active:bg-[#0f4950] font-bold text-base text-slate-800 dark:text-white transition-colors border border-slate-200/80 dark:border-[#0f4950] shadow-xs cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-12 rounded-xl text-xs font-bold text-slate-500 dark:text-teal-300 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#031e21] transition-colors cursor-pointer"
            >
              ⌫
            </button>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={pin.length < 4}
              className="w-full py-2.5 px-4 bg-teal-800 hover:bg-teal-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>Masuk Panel Admin</span>
            </button>
          </div>
        </form>

        <div className="text-[11px] text-slate-400 dark:text-teal-200/70 pt-1 border-t border-slate-100 dark:border-[#0f4950]">
          <p>Masukkan 4 digit PIN keamanan untuk verifikasi akses administrator.</p>
        </div>
      </div>
    </div>
  );
};
