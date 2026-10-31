import { Meeting, SchoolProfile, Teacher, Attendance, Invitation } from '../types';

export const INITIAL_SCHOOL_PROFILE: SchoolProfile = {
  id: '00000000-0000-0000-0000-000000000001',
  foundation_name: '',
  school_name: '',
  npsn: '',
  address: '',
  city: '',
  province: '',
  postal_code: '',
  phone: '',
  email: '',
  website: '',
  headmaster_name: '',
  headmaster_niy: '',
  headmaster_rank: '',
  headmaster_phone: '',
  admin_staff_name: '',
  admin_staff_niy: '',
  admin_staff_phone: '',
  waha_group_id: '',
  logo_url: '',
  admin_pin: '1234',
};

export const INITIAL_TEACHERS: Teacher[] = [];
export const INITIAL_MEETINGS: Meeting[] = [];
export const INITIAL_ATTENDANCES: Attendance[] = [];
export const INITIAL_INVITATIONS: Invitation[] = [];
