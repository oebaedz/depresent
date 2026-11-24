import React from 'react';
import { BellRing, X } from 'lucide-react';
import { Attendance, Invitation, Meeting, SchoolProfile, Teacher } from '../types';
import { AutoReminderPanel } from './AutoReminderPanel';

interface AutoReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetings: Meeting[];
  teachers: Teacher[];
  attendances: Attendance[];
  invitations: Invitation[];
  schoolProfile: SchoolProfile;
  selectedMeetingId?: string;
}

export const AutoReminderModal: React.FC<AutoReminderModalProps> = ({
  isOpen,
  onClose,
  meetings,
  teachers,
  attendances,
  invitations,
  schoolProfile,
  selectedMeetingId,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#072b2f] rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-[#0f4950]">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#0f4950] flex items-center justify-between bg-teal-950 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Pengaturan Auto Reminder WAHA</h3>
              <p className="text-[11px] text-teal-200/80">
                Jadwal otomatis pengingat rapat & konfirmasi RSVP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-teal-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          <AutoReminderPanel
            meetings={meetings}
            teachers={teachers}
            attendances={attendances}
            invitations={invitations}
            schoolProfile={schoolProfile}
            selectedMeetingId={selectedMeetingId}
          />
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-[#0f4950] bg-slate-50 dark:bg-[#031e21] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-[#0b383d] hover:bg-slate-300 dark:hover:bg-[#0f4950] text-slate-700 dark:text-teal-100 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
