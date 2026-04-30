'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

export default function ViewUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [msg, setMsg] = useState('');

  const loadUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const d = await api.getUsers({ role: roleFilter, search: searchQuery, page });
      setUsers(d.users); setPagination(d.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [roleFilter, searchQuery]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this user?')) return;
    try { await api.deactivateUser(id); await loadUsers(pagination?.page || 1); setSelected(null); setMsg('User deactivated.'); } catch (e: any) { setMsg(e.message || 'Failed to deactivate user.'); }
  };

  const openUser = (u: any) => {
    setSelected(u);
    setEditMode(false);
    setEditForm({
      fullName: u.full_name || '',
      email: u.email || '',
      department: u.department || '',
      degreeCourse: u.degree_course || '',
      year: u.year || '',
      phone: u.phone || '',
      subjects: Array.isArray(u.subjects) ? u.subjects.join(', ') : '',
      isActive: !!u.is_active,
    });
  };

  const handleSave = async () => {
    if (!selected) return;
    try {
      const payload = {
        ...editForm,
        subjects: String(editForm.subjects || '').split(',').map((s: string) => s.trim()).filter(Boolean),
      };
      const data = await api.updateUser(selected.id, payload);
      setSelected(data.user);
      setEditMode(false);
      setMsg('User updated.');
      await loadUsers(pagination?.page || 1);
    } catch (e: any) {
      setMsg(e.message || 'Failed to update user.');
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      const data = await api.reactivateUser(id);
      setSelected(data.user);
      setMsg('User reactivated.');
      await loadUsers(pagination?.page || 1);
    } catch (e: any) {
      setMsg(e.message || 'Failed to reactivate user.');
    }
  };

  const statusBadge = (u: any) => {
    if (!u.is_active) return { text: 'Inactive', cls: 'ds-badge-red' };
    if (u.is_first_login) return { text: 'Pending', cls: 'ds-badge-amber' };
    return { text: 'Active', cls: 'ds-badge-green' };
  };

  return (
    <div>
      <div className="ds-page-header ds-fade-in">
        <h1 className="ds-page-title">Manage Users 👥</h1>
        <p className="ds-page-sub">View, search, and manage all registered users</p>
      </div>

      {msg && <div className={`ds-alert ${msg.includes('Failed') ? 'ds-alert-error' : 'ds-alert-success'}`}>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{msg}
      </div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }} className="ds-fade-in">
        <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
          <svg fill="none" viewBox="0 0 24 24" stroke="#9a7b6a" style={{ width: 15, height: 15, position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input className="ds-input" style={{ paddingLeft: '2.4rem' }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name, email, or ID..." />
        </div>
        <div className="ds-tabs" style={{ marginBottom: 0 }}>
          {['all','student','faculty','admin'].map(r => (
            <button key={r} className={`ds-tab ${roleFilter === r ? 'active' : ''}`} onClick={() => setRoleFilter(r)}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="ds-card ds-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[...Array(5)].map((_, i) => <div key={i} style={{ height: 52, background: 'rgba(249,115,22,0.04)', borderRadius: 10 }} />)}
          </div>
        ) : users.length === 0 ? (
          <div className="ds-empty" style={{ padding: '3rem' }}><div className="ds-empty-icon">👥</div><div className="ds-empty-title">No users found</div><div className="ds-empty-sub">Try adjusting your search or filters</div></div>
        ) : (
          <table className="ds-table">
            <thead><tr><th>User</th><th>ID</th><th>Role</th><th>Department</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{users.map((u: any) => {
              const s = statusBadge(u);
              return (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: u.role === 'admin' ? 'linear-gradient(135deg,#f97316,#ef4444)' : u.role === 'faculty' ? 'linear-gradient(135deg,#2563eb,#06b6d4)' : 'linear-gradient(135deg,#f97316,#eab308)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.78rem', flexShrink: 0 }}>{u.full_name?.charAt(0)}</div>
                      <div><div style={{ fontWeight: 600, color: '#1c0a00', fontSize: '0.83rem' }}>{u.full_name}</div><div style={{ fontSize: '0.72rem', color: '#9a7b6a' }}>{u.email}</div></div>
                    </div>
                  </td>
                  <td><span className="ds-badge ds-badge-orange">{u.user_id}</span></td>
                  <td><span className={`ds-badge ${u.role === 'admin' ? 'ds-badge-orange' : u.role === 'faculty' ? 'ds-badge-blue' : 'ds-badge-green'}`}>{u.role}</span></td>
                  <td style={{ fontSize: '0.82rem' }}>{u.department || '—'}</td>
                  <td><span className={`ds-badge ${s.cls}`}>{s.text}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="ds-btn ds-btn-ghost" style={{ padding: '0.3rem' }} onClick={() => openUser(u)} title="View">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </button>
                      {u.role !== 'admin' && u.is_active && <button className="ds-btn ds-btn-danger" style={{ padding: '0.3rem' }} onClick={() => handleDeactivate(u.id)} title="Deactivate">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                      </button>}
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
        {pagination && pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
            <span style={{ fontSize: '0.78rem', color: '#9a7b6a' }}>Showing {(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button className="ds-btn ds-btn-ghost" disabled={pagination.page === 1} onClick={() => loadUsers(pagination.page - 1)}>← Prev</button>
              <button className="ds-btn ds-btn-ghost" disabled={pagination.page === pagination.totalPages} onClick={() => loadUsers(pagination.page + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="ds-modal-overlay" onClick={() => setSelected(null)}>
          <div className="ds-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>{selected.full_name?.charAt(0)}</div>
                <div><div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00' }}>{selected.full_name}</div><div style={{ fontSize: '0.75rem', color: '#9a7b6a' }}>{selected.email}</div></div>
              </div>
              <button className="ds-btn ds-btn-ghost" style={{ padding: '0.3rem' }} onClick={() => setSelected(null)}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 18, height: 18 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {editMode ? (
              <div>
                <div className="ds-grid-2">
                  <div className="ds-form-group"><label className="ds-label">Full Name</label><input className="ds-input" value={editForm.fullName} onChange={e => setEditForm({ ...editForm, fullName: e.target.value })} /></div>
                  <div className="ds-form-group"><label className="ds-label">Email</label><input className="ds-input" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
                </div>
                <div className="ds-grid-2">
                  <div className="ds-form-group"><label className="ds-label">Department</label><input className="ds-input" value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} /></div>
                  {selected.role === 'student' && <div className="ds-form-group"><label className="ds-label">Year</label><input className="ds-input" value={editForm.year} onChange={e => setEditForm({ ...editForm, year: e.target.value })} /></div>}
                </div>
                {selected.role === 'student' && (
                  <div className="ds-grid-2">
                    <div className="ds-form-group"><label className="ds-label">Degree</label><input className="ds-input" value={editForm.degreeCourse} onChange={e => setEditForm({ ...editForm, degreeCourse: e.target.value })} /></div>
                    <div className="ds-form-group"><label className="ds-label">Phone</label><input className="ds-input" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
                  </div>
                )}
                {selected.role === 'faculty' && <div className="ds-form-group"><label className="ds-label">Subjects</label><input className="ds-input" value={editForm.subjects} onChange={e => setEditForm({ ...editForm, subjects: e.target.value })} placeholder="Comma separated" /></div>}
                {selected.role !== 'admin' && <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '1rem', fontSize: '0.82rem', color: '#1c0a00' }}><input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} /> Active account</label>}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="ds-btn ds-btn-primary" onClick={handleSave}>Save Changes</button>
                  <button className="ds-btn ds-btn-ghost" onClick={() => setEditMode(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                {[
                  { l: 'User ID', v: selected.user_id },
                  { l: 'Role', v: selected.role },
                  { l: 'Department', v: selected.department || '—' },
                  ...(selected.role === 'student' ? [{ l: 'Degree', v: selected.degree_course || '—' }, { l: 'Year', v: selected.year || '—' }, { l: 'Phone', v: selected.phone || '—' }] : []),
                  ...(selected.role === 'faculty' ? [{ l: 'Subjects', v: selected.subjects?.join(', ') || '—' }] : []),
                  { l: 'Status', v: selected.is_active ? 'Active' : 'Inactive' },
                  { l: 'First Login', v: selected.is_first_login ? 'Pending' : 'Done' },
                  { l: 'Created', v: new Date(selected.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
                ].map((r, i) => (
                  <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0', borderTop: i > 0 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                    <span style={{ fontSize: '0.82rem', color: '#9a7b6a' }}>{r.l}</span>
                    <span style={{ fontSize: '0.82rem', color: '#1c0a00', fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{r.v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="ds-btn ds-btn-primary" onClick={() => setEditMode(true)}>Edit User</button>
                  {selected.role !== 'admin' && !selected.is_active && <button className="ds-btn ds-btn-outline" onClick={() => handleReactivate(selected.id)}>Reactivate</button>}
                  {selected.role !== 'admin' && selected.is_active && <button className="ds-btn ds-btn-danger" onClick={() => handleDeactivate(selected.id)}>Deactivate</button>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
