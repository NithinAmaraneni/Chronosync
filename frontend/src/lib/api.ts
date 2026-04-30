const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('chronosync_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: { ...this.getHeaders(), ...options.headers },
    };
    const response = await fetch(url, config);
    const data = await response.json();
    if (!response.ok) throw { status: response.status, ...data };
    return data;
  }

  async uploadFile(endpoint: string, file: File): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const formData = new FormData();
    formData.append('file', file);
    const headers: HeadersInit = {};
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('chronosync_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(url, { method: 'POST', headers, body: formData });
    const data = await response.json();
    if (!response.ok) throw { status: response.status, ...data };
    return data;
  }

  // ─── Auth ───
  async login(userId: string, password: string) {
    return this.request('/auth/login', { method: 'POST', body: JSON.stringify({ userId, password }) });
  }
  async setPassword(resetToken: string, newPassword: string) {
    return this.request('/auth/set-password', { method: 'POST', body: JSON.stringify({ resetToken, newPassword }) });
  }
  async forgotPassword(email: string) {
    return this.request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
  }
  async resetForgotPassword(token: string, newPassword: string) {
    return this.request('/auth/reset-forgot-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) });
  }
  async getProfile() {
    return this.request('/auth/profile');
  }

  // ─── Admin ───
  async getAnalytics() { return this.request('/admin/analytics'); }
  async createStudent(data: any) { return this.request('/admin/students', { method: 'POST', body: JSON.stringify(data) }); }
  async createFaculty(data: any) { return this.request('/admin/faculty', { method: 'POST', body: JSON.stringify(data) }); }
  async getUsers(params?: { role?: string; search?: string; page?: number }) {
    const sp = new URLSearchParams();
    if (params?.role) sp.set('role', params.role);
    if (params?.search) sp.set('search', params.search);
    if (params?.page) sp.set('page', params.page.toString());
    const q = sp.toString();
    return this.request(`/admin/users${q ? `?${q}` : ''}`);
  }
  async updateUser(id: string, data: any) { return this.request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async reactivateUser(id: string) { return this.request(`/admin/users/${id}/reactivate`, { method: 'PATCH' }); }
  async deactivateUser(id: string) { return this.request(`/admin/users/${id}`, { method: 'DELETE' }); }
  async getActivityLogs(page = 1) { return this.request(`/admin/activity-logs?page=${page}`); }
  // ─── CSV Bulk Import ───
  async importStudentsCSV(file: File) { return this.uploadFile('/admin/import/students', file); }
  async importFacultyCSV(file: File) { return this.uploadFile('/admin/import/faculty', file); }
  async importSubjectsCSV(file: File) { return this.uploadFile('/admin/import/subjects', file); }
  async importClassroomsCSV(file: File) { return this.uploadFile('/admin/import/classrooms', file); }
  async getSubjects() { return this.request('/admin/subjects'); }
  async createSubject(data: any) { return this.request('/admin/subjects', { method: 'POST', body: JSON.stringify(data) }); }
  async updateSubject(id: string, data: any) { return this.request(`/admin/subjects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteSubject(id: string) { return this.request(`/admin/subjects/${id}`, { method: 'DELETE' }); }
  async assignSubject(facultyId: string, subjectId: string) {
    return this.request('/admin/assign-subject', { method: 'POST', body: JSON.stringify({ faculty_id: facultyId, subject_id: subjectId }) });
  }
  async getLeaveRequests() { return this.request('/admin/leaves'); }
  async updateLeaveStatus(id: string, status: string, admin_note?: string) {
    return this.request(`/admin/leaves/${id}`, { method: 'PATCH', body: JSON.stringify({ status, admin_note }) });
  }
  async createTimetableSlot(data: any) {
    return this.request('/admin/timetable', { method: 'POST', body: JSON.stringify(data) });
  }
  async updateTimetableSlot(id: string, data: any) {
    return this.request(`/admin/timetable/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteTimetableSlot(id: string) {
    return this.request(`/admin/timetable/${id}`, { method: 'DELETE' });
  }
  async getTimetableSlots(department?: string) {
    const q = department ? `?department=${department}` : '';
    return this.request(`/admin/timetable${q}`);
  }

  // ─── Faculty ───
  async getFacultySubjects() { return this.request('/faculty/subjects'); }
  async getFacultyTimetable() { return this.request('/faculty/timetable'); }
  async getFacultyAvailability() { return this.request('/faculty/availability'); }
  async setFacultyAvailability(data: any) { return this.request('/faculty/availability', { method: 'POST', body: JSON.stringify(data) }); }
  async deleteFacultyAvailability(id: string) { return this.request(`/faculty/availability/${id}`, { method: 'DELETE' }); }
  async getFacultyLeaves() { return this.request('/faculty/leaves'); }
  async getLeaveImpact() { return this.request('/faculty/leave-impact'); }
  async applyFacultyLeave(data: any) { return this.request('/faculty/leaves', { method: 'POST', body: JSON.stringify(data) }); }
  async getFacultyBookings() { return this.request('/faculty/bookings'); }
  async updateBookingStatus(id: string, status: string) {
    return this.request(`/faculty/bookings/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  }

  // ─── Student ───
  async getStudentTimetable() { return this.request('/student/timetable'); }
  async getStudentFacultyList() { return this.request('/student/faculty'); }
  async getFacultySlots(faculty_id: string, date: string) {
    return this.request(`/student/faculty-slots?faculty_id=${faculty_id}&date=${date}`);
  }
  async getStudentBookings(status?: string) {
    const q = status && status !== 'all' ? `?status=${status}` : '';
    return this.request(`/student/bookings${q}`);
  }
  async bookSlot(data: any) { return this.request('/student/bookings', { method: 'POST', body: JSON.stringify(data) }); }
  async cancelBooking(id: string) { return this.request(`/student/bookings/${id}/cancel`, { method: 'PATCH' }); }

  // ─── Scheduling (Admin) ───
  async getClassrooms() { return this.request('/scheduling/classrooms'); }
  async createClassroom(data: any) { return this.request('/scheduling/classrooms', { method: 'POST', body: JSON.stringify(data) }); }
  async updateClassroom(id: string, data: any) { return this.request(`/scheduling/classrooms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteClassroom(id: string) { return this.request(`/scheduling/classrooms/${id}`, { method: 'DELETE' }); }
  async getTimeSlotTemplates() { return this.request('/scheduling/time-slots'); }
  async upsertTimeSlot(data: any) { return this.request('/scheduling/time-slots', { method: 'POST', body: JSON.stringify(data) }); }
  async deleteTimeSlot(id: string) { return this.request(`/scheduling/time-slots/${id}`, { method: 'DELETE' }); }
  async getSchedulingConstraints() { return this.request('/scheduling/constraints'); }
  async createSchedulingConstraint(data: any) { return this.request('/scheduling/constraints', { method: 'POST', body: JSON.stringify(data) }); }
  async updateSchedulingConstraint(id: string, data: any) { return this.request(`/scheduling/constraints/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteSchedulingConstraint(id: string) { return this.request(`/scheduling/constraints/${id}`, { method: 'DELETE' }); }
  async triggerTimetableGeneration(data: any) { return this.request('/scheduling/generate', { method: 'POST', body: JSON.stringify(data) }); }
  async getGenerationHistory() { return this.request('/scheduling/history'); }
  async getGenerationDetail(id: string) { return this.request(`/scheduling/history/${id}`); }
  async getAlgorithmConfig() { return this.request('/scheduling/config'); }

  // ─── Conflict Detection & Rescheduling ───
  async getConflicts(department?: string) {
    const q = department ? `?department=${department}` : '';
    return this.request(`/scheduling/conflicts${q}`);
  }
  async triggerAutoFix(department?: string) {
    return this.request('/scheduling/auto-fix', { method: 'POST', body: JSON.stringify({ department }) });
  }
  async triggerSmartReschedule(slotIds: string[]) {
    return this.request('/scheduling/reschedule', { method: 'POST', body: JSON.stringify({ slotIds }) });
  }
  async triggerLeaveEvent(faculty_id: string, leave_start: string, leave_end: string) {
    return this.request('/scheduling/event/leave', { method: 'POST', body: JSON.stringify({ faculty_id, leave_start, leave_end }) });
  }
  async triggerRoomEvent(room_id: string) {
    return this.request('/scheduling/event/room', { method: 'POST', body: JSON.stringify({ room_id }) });
  }
  async triggerSubjectEvent(faculty_id: string, subject_id: string) {
    return this.request('/scheduling/event/subject', { method: 'POST', body: JSON.stringify({ faculty_id, subject_id }) });
  }
}

export const api = new ApiClient(API_URL);
