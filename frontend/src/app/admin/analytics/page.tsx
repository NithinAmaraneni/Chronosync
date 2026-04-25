'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Dynamic import Recharts (SSR-safe)
const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => m.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import('recharts').then(m => m.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(m => m.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(m => m.Cell), { ssr: false });
const RadialBarChart = dynamic(() => import('recharts').then(m => m.RadialBarChart), { ssr: false });
const RadialBar = dynamic(() => import('recharts').then(m => m.RadialBar), { ssr: false });
const Legend = dynamic(() => import('recharts').then(m => m.Legend), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then(m => m.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(m => m.Area), { ssr: false });

const PIE_COLORS = ['#f97316', '#ea580c', '#d97706', '#16a34a', '#2563eb', '#7c3aed', '#ec4899', '#14b8a6'];
const HEATMAP_COLORS = ['#f0fdf4', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534'];

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    api.getAnalytics()
      .then(d => { setData(d.analytics); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #f97316', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ color: '#9a7b6a', fontSize: '0.85rem' }}>Loading analytics…</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="ds-card"><div className="ds-empty"><div className="ds-empty-icon">📊</div><div className="ds-empty-title">No data</div></div></div>
  );

  const e = data.energy || {};

  // Heatmap color helper
  const getHeatColor = (intensity: number) => {
    if (intensity === 0) return '#fef9f5';
    if (intensity <= 15) return '#fed7aa';
    if (intensity <= 30) return '#fdba74';
    if (intensity <= 50) return '#fb923c';
    if (intensity <= 70) return '#f97316';
    if (intensity <= 85) return '#ea580c';
    return '#c2410c';
  };

  // Gauge component
  const Gauge = ({ value, label, color, max = 100 }: { value: number; label: string; color: string; max?: number }) => {
    const pct = Math.min((value / max) * 100, 100);
    const r = 54;
    const c = 2 * Math.PI * r;
    const offset = c - (pct / 100) * c * 0.75; // 270° arc
    return (
      <div style={{ textAlign: 'center' }}>
        <svg width="130" height="100" viewBox="0 0 130 100">
          <path d="M 15 85 A 54 54 0 1 1 115 85" fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="10" strokeLinecap="round" />
          <path d="M 15 85 A 54 54 0 1 1 115 85" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 254} 254`}
            style={{ transition: 'stroke-dasharray 1s ease' }} />
          <text x="65" y="62" textAnchor="middle" fontFamily="'Syne',sans-serif" fontWeight="800" fontSize="22" fill="#1c0a00">{value}%</text>
          <text x="65" y="80" textAnchor="middle" fontFamily="'DM Sans',sans-serif" fontSize="9" fill="#9a7b6a" fontWeight="600">{label}</text>
        </svg>
      </div>
    );
  };

  const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const periods = [...new Set((data.heatmap || []).map((h: any) => h.period))];

  return (
    <div>
      <div className="ds-page-header ds-fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg, #f97316, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', boxShadow: '0 4px 14px rgba(249,115,22,0.3)' }}>📊</div>
          <div>
            <h1 className="ds-page-title" style={{ marginBottom: 2 }}>Analytics Dashboard</h1>
            <p className="ds-page-sub">Classroom utilization • Faculty workload • Energy efficiency</p>
          </div>
        </div>
        <button className="ds-btn ds-btn-outline" onClick={() => { setLoading(true); api.getAnalytics().then(d => { setData(d.analytics); setLoading(false); }); }}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="ds-tabs ds-fade-in" style={{ marginBottom: '1.5rem' }}>
        {[
          { id: 'overview', label: '📊 Overview' },
          { id: 'rooms', label: '🏠 Room Utilization' },
          { id: 'workload', label: '👩‍🏫 Faculty Workload' },
          { id: 'energy', label: '⚡ Energy & Idle Time' },
        ].map(t => (
          <button key={t.id} className={`ds-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ════════════════════════════════════ */}
      {/* OVERVIEW TAB                        */}
      {/* ════════════════════════════════════ */}
      {tab === 'overview' && (
        <div className="ds-fade-in">
          {/* KPI Cards */}
          <div className="ds-grid-4 ds-stagger" style={{ marginBottom: '1.5rem' }}>
            {[
              { label: 'Students', value: data.totalStudents, icon: '🎓', color: '#f97316', bg: 'rgba(249,115,22,0.08)' },
              { label: 'Faculty', value: data.totalFaculty, icon: '👩‍🏫', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
              { label: 'Subjects', value: data.totalSubjects, icon: '📚', color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
              { label: 'Active Rooms', value: data.totalRooms, icon: '🏠', color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
            ].map((kpi, i) => (
              <div key={i} className="ds-stat-card">
                <div className="ds-stat-icon" style={{ background: kpi.bg }}>{kpi.icon}</div>
                <div className="ds-stat-value" style={{ color: kpi.color }}>{kpi.value}</div>
                <div className="ds-stat-label">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Gauge Row */}
          <div className="ds-grid-3" style={{ marginBottom: '1.5rem' }}>
            <div className="ds-card" style={{ textAlign: 'center' }}>
              <Gauge value={data.avgRoomUsage || 0} label="AVG ROOM USAGE" color="#f97316" />
            </div>
            <div className="ds-card" style={{ textAlign: 'center' }}>
              <Gauge value={e.efficiency || 0} label="ENERGY SAVED" color="#16a34a" />
            </div>
            <div className="ds-card" style={{ textAlign: 'center' }}>
              <Gauge value={data.workloadData?.length > 0 ? Math.round(100 - (data.overloadedFaculty / data.workloadData.length) * 100) : 100} label="WORKLOAD BALANCE" color="#7c3aed" />
            </div>
          </div>

          <div className="ds-grid-2" style={{ marginBottom: '1.5rem' }}>
            {/* Day Distribution Bar */}
            <div className="ds-card">
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem', fontSize: '0.95rem' }}>📅 Classes per Day</h3>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.dayDistribution || []} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9a7b6a' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9a7b6a' }} width={30} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(249,115,22,0.15)', fontSize: 13 }} />
                    <Bar dataKey="classes" fill="#f97316" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Department Pie */}
            <div className="ds-card">
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem', fontSize: '0.95rem' }}>🏢 Department Distribution</h3>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.departmentBreakdown || []} dataKey="classes" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 10 }}>
                      {(data.departmentBreakdown || []).map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Heatmap */}
          <div className="ds-card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '0.5rem', fontSize: '0.95rem' }}>🗓️ Schedule Density Heatmap</h3>
            <p style={{ fontSize: '0.75rem', color: '#9a7b6a', marginBottom: '1rem' }}>Darker = more classes scheduled at that time slot</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'separate', borderSpacing: 3, width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ fontSize: '0.68rem', color: '#9a7b6a', fontWeight: 700, textAlign: 'left', padding: '0.3rem 0.5rem', width: 50 }}>Day</th>
                    {periods.map((p: string) => (
                      <th key={p} style={{ fontSize: '0.65rem', color: '#9a7b6a', fontWeight: 700, textAlign: 'center', padding: '0.3rem' }}>{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS_SHORT.map((day, di) => (
                    <tr key={day}>
                      <td style={{ fontSize: '0.72rem', fontWeight: 600, color: '#7c5a4a', padding: '0.3rem 0.5rem' }}>{day}</td>
                      {periods.map((p: string, pi: number) => {
                        const cell = (data.heatmap || []).find((h: any) => h.dayIndex === di && h.periodIndex === pi);
                        return (
                          <td key={p} title={`${cell?.count || 0} classes • ${cell?.time || ''}`}
                            style={{ width: 44, height: 36, borderRadius: 6, background: getHeatColor(cell?.intensity || 0), textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: (cell?.intensity || 0) > 50 ? '#fff' : '#7c5a4a', cursor: 'help', transition: 'all 0.2s' }}>
                            {cell?.count || 0}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: '0.6rem', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: '0.62rem', color: '#9a7b6a' }}>Low</span>
              {['#fef9f5', '#fed7aa', '#fb923c', '#f97316', '#ea580c', '#c2410c'].map((c, i) => (
                <div key={i} style={{ width: 16, height: 10, borderRadius: 2, background: c }} />
              ))}
              <span style={{ fontSize: '0.62rem', color: '#9a7b6a' }}>High</span>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════ */}
      {/* ROOM UTILIZATION TAB                */}
      {/* ════════════════════════════════════ */}
      {tab === 'rooms' && (
        <div className="ds-fade-in">
          {/* KPI row */}
          <div className="ds-grid-4 ds-stagger" style={{ marginBottom: '1.5rem' }}>
            <div className="ds-stat-card">
              <div className="ds-stat-icon" style={{ background: 'rgba(249,115,22,0.08)' }}>🏠</div>
              <div className="ds-stat-value">{data.totalRooms}</div>
              <div className="ds-stat-label">Active Rooms</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-icon" style={{ background: 'rgba(22,163,74,0.08)' }}>📈</div>
              <div className="ds-stat-value" style={{ color: '#16a34a' }}>{data.avgRoomUsage}%</div>
              <div className="ds-stat-label">Avg Utilization</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-icon" style={{ background: 'rgba(220,38,38,0.08)' }}>🚫</div>
              <div className="ds-stat-value" style={{ color: '#dc2626' }}>{data.unusedRooms}</div>
              <div className="ds-stat-label">Unused Rooms</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-icon" style={{ background: 'rgba(37,99,235,0.08)' }}>📊</div>
              <div className="ds-stat-value">{data.totalSlots}</div>
              <div className="ds-stat-label">Total Slots</div>
            </div>
          </div>

          {/* Room utilization bar chart */}
          <div className="ds-card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem', fontSize: '0.95rem' }}>🏠 Room Utilization (%)</h3>
            <div style={{ width: '100%', height: Math.max(200, (data.roomUtilization?.length || 0) * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.roomUtilization || []} layout="vertical" barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#9a7b6a' }} tickFormatter={(v: number) => `${v}%`} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: '#7c5a4a' }} />
                  <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 12, fontSize: 13 }} />
                  <Bar dataKey="usage" radius={[0, 6, 6, 0]} fill="#f97316">
                    {(data.roomUtilization || []).map((r: any, i: number) => (
                      <Cell key={i} fill={r.usage > 70 ? '#16a34a' : r.usage > 30 ? '#f97316' : r.usage > 0 ? '#d97706' : '#dc2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Room detail cards */}
          <div className="ds-grid-3">
            {(data.roomUtilization || []).map((room: any) => (
              <div key={room.id} className="ds-card" style={{ borderLeft: `3px solid ${room.usage > 70 ? '#16a34a' : room.usage > 30 ? '#f97316' : room.usage > 0 ? '#d97706' : '#dc2626'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', fontSize: '0.9rem' }}>{room.name}</span>
                  <span className={`ds-badge ${room.usage > 70 ? 'ds-badge-green' : room.usage > 30 ? 'ds-badge-orange' : room.usage > 0 ? 'ds-badge-amber' : 'ds-badge-red'}`}>{room.usage}%</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9a7b6a', marginBottom: '0.3rem' }}>
                  {room.capacity > 0 && `Capacity: ${room.capacity} • `}Type: {room.type?.replace('_', ' ')}
                </div>
                {/* Mini utilization bar */}
                <div style={{ height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: '0.4rem' }}>
                  <div style={{ height: '100%', width: `${room.usage}%`, background: room.usage > 70 ? '#16a34a' : room.usage > 30 ? '#f97316' : '#d97706', borderRadius: 3, transition: 'width 1s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#b89070' }}>
                  <span>{room.usedSlots} used</span>
                  <span>{room.idleSlots} idle</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════ */}
      {/* FACULTY WORKLOAD TAB                */}
      {/* ════════════════════════════════════ */}
      {tab === 'workload' && (
        <div className="ds-fade-in">
          {/* KPI row */}
          <div className="ds-grid-4 ds-stagger" style={{ marginBottom: '1.5rem' }}>
            <div className="ds-stat-card">
              <div className="ds-stat-icon" style={{ background: 'rgba(124,58,237,0.08)' }}>👩‍🏫</div>
              <div className="ds-stat-value">{data.workloadData?.length || 0}</div>
              <div className="ds-stat-label">Faculty with Load</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-icon" style={{ background: 'rgba(249,115,22,0.08)' }}>📊</div>
              <div className="ds-stat-value">{data.avgWorkload}</div>
              <div className="ds-stat-label">Avg Classes/Faculty</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-icon" style={{ background: 'rgba(220,38,38,0.08)' }}>⚠️</div>
              <div className="ds-stat-value" style={{ color: '#dc2626' }}>{data.overloadedFaculty}</div>
              <div className="ds-stat-label">Overloaded</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-icon" style={{ background: 'rgba(37,99,235,0.08)' }}>📉</div>
              <div className="ds-stat-value" style={{ color: '#2563eb' }}>{data.underloadedFaculty}</div>
              <div className="ds-stat-label">Underloaded</div>
            </div>
          </div>

          {/* Workload bar chart */}
          <div className="ds-card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem', fontSize: '0.95rem' }}>👩‍🏫 Faculty Workload Distribution</h3>
            <div style={{ width: '100%', height: Math.max(220, (data.workloadData?.length || 0) * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.workloadData || []} layout="vertical" barCategoryGap="15%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#9a7b6a' }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11, fill: '#7c5a4a' }} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 13 }} formatter={(v: number) => `${v} classes`} />
                  <Bar dataKey="totalClasses" radius={[0, 6, 6, 0]}>
                    {(data.workloadData || []).map((f: any, i: number) => (
                      <Cell key={i} fill={f.totalClasses > data.avgWorkload * 1.5 ? '#dc2626' : f.totalClasses < data.avgWorkload * 0.5 ? '#2563eb' : '#7c3aed'} />
                    ))}
                  </Bar>
                  {/* Average line */}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: '#9a7b6a' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#dc2626' }} /> Overloaded</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: '#9a7b6a' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#7c3aed' }} /> Normal</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: '#9a7b6a' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: '#2563eb' }} /> Underloaded</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: '#9a7b6a' }}>— Avg: {data.avgWorkload} classes</span>
            </div>
          </div>

          {/* Faculty detail cards */}
          <div className="ds-grid-2">
            {(data.workloadData || []).map((f: any) => {
              const isOver = f.totalClasses > data.avgWorkload * 1.5;
              const isUnder = f.totalClasses < data.avgWorkload * 0.5;
              return (
                <div key={f.id} className="ds-card" style={{ borderLeft: `3px solid ${isOver ? '#dc2626' : isUnder ? '#2563eb' : '#7c3aed'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', fontSize: '0.88rem' }}>{f.name}</span>
                    <div style={{ display: 'flex', gap: '0.2rem' }}>
                      <span className="ds-badge ds-badge-slate">{f.department}</span>
                      {isOver && <span className="ds-badge ds-badge-red">Overloaded</span>}
                      {isUnder && <span className="ds-badge ds-badge-blue">Underloaded</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#7c5a4a', marginBottom: '0.4rem' }}>
                    <span>📋 {f.totalClasses} classes</span>
                    <span>📚 {f.uniqueSubjects} subjects</span>
                    <span>📅 ~{f.avgPerDay}/day</span>
                  </div>
                  {/* Day breakdown mini bars */}
                  <div style={{ display: 'flex', gap: 3, alignItems: 'end', height: 28 }}>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => {
                      const count = f.dayBreakdown?.[day] || 0;
                      const maxCount = Math.max(...Object.values(f.dayBreakdown || {}).map(Number), 1);
                      return (
                        <div key={day} title={`${day}: ${count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ width: '100%', height: count > 0 ? Math.max(4, (count / maxCount) * 24) : 2, background: count > 0 ? '#7c3aed' : 'rgba(0,0,0,0.06)', borderRadius: 2, transition: 'height 0.5s' }} />
                          <span style={{ fontSize: '0.55rem', color: '#b89070', marginTop: 2 }}>{day.slice(0, 2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════ */}
      {/* ENERGY & IDLE TIME TAB              */}
      {/* ════════════════════════════════════ */}
      {tab === 'energy' && (
        <div className="ds-fade-in">
          {/* Energy KPIs */}
          <div className="ds-grid-4 ds-stagger" style={{ marginBottom: '1.5rem' }}>
            <div className="ds-stat-card">
              <div className="ds-stat-icon" style={{ background: 'rgba(22,163,74,0.08)' }}>⚡</div>
              <div className="ds-stat-value" style={{ color: '#16a34a' }}>{e.efficiency}%</div>
              <div className="ds-stat-label">Energy Efficiency</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-icon" style={{ background: 'rgba(249,115,22,0.08)' }}>🔌</div>
              <div className="ds-stat-value">{e.usedKWh}</div>
              <div className="ds-stat-label">kWh Used/Week</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-icon" style={{ background: 'rgba(22,163,74,0.08)' }}>💡</div>
              <div className="ds-stat-value" style={{ color: '#16a34a' }}>{e.savedKWh}</div>
              <div className="ds-stat-label">kWh Saved/Week</div>
            </div>
            <div className="ds-stat-card">
              <div className="ds-stat-icon" style={{ background: 'rgba(220,38,38,0.08)' }}>😴</div>
              <div className="ds-stat-value" style={{ color: '#dc2626' }}>{e.totalIdleSlots}</div>
              <div className="ds-stat-label">Fully Idle Periods</div>
            </div>
          </div>

          <div className="ds-grid-2" style={{ marginBottom: '1.5rem' }}>
            {/* Energy gauge */}
            <div className="ds-card" style={{ textAlign: 'center' }}>
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem', fontSize: '0.95rem' }}>⚡ Energy Savings</h3>
              <Gauge value={e.efficiency || 0} label="ENERGY EFFICIENCY" color="#16a34a" />
              <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '0.8rem' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', color: '#9a7b6a', textTransform: 'uppercase', fontWeight: 700 }}>Room Hours Used</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.1rem', color: '#ea580c' }}>{e.roomHoursUsed}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.6rem', color: '#9a7b6a', textTransform: 'uppercase', fontWeight: 700 }}>Total Available</div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: '1.1rem', color: '#16a34a' }}>{e.roomHoursAvailable}</div>
                </div>
              </div>
              {e.peakPeriod && (
                <div style={{ marginTop: '0.8rem', padding: '0.5rem 0.8rem', background: 'rgba(249,115,22,0.04)', borderRadius: 10, fontSize: '0.78rem', color: '#7c5a4a' }}>
                  🔥 Peak hour: <strong style={{ color: '#ea580c' }}>{e.peakPeriod.time}</strong> with {e.peakPeriod.classes} classes
                </div>
              )}
            </div>

            {/* Energy bar */}
            <div className="ds-card">
              <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '1rem', fontSize: '0.95rem' }}>🔋 Energy Breakdown</h3>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Used', value: e.usedKWh, fill: '#f97316' },
                    { name: 'Saved', value: e.savedKWh, fill: '#16a34a' },
                    { name: 'Max Possible', value: e.maxKWh, fill: '#e5e7eb' },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9a7b6a' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#9a7b6a' }} width={45} tickFormatter={(v: number) => `${v}`} />
                    <Tooltip formatter={(v: number) => `${v} kWh`} contentStyle={{ borderRadius: 12, fontSize: 13 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      <Cell fill="#f97316" />
                      <Cell fill="#16a34a" />
                      <Cell fill="#d4d4d8" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Idle time */}
          <div className="ds-card">
            <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', marginBottom: '0.5rem', fontSize: '0.95rem' }}>😴 Idle Time Detection</h3>
            <p style={{ fontSize: '0.75rem', color: '#9a7b6a', marginBottom: '1rem' }}>Time periods where ALL rooms are idle — potential savings from shutting down HVAC/lighting</p>
            {(e.idleTimePeriods || []).length === 0 ? (
              <div className="ds-alert ds-alert-success" style={{ margin: 0 }}>
                <span>✅ No fully idle time periods detected! All periods have at least one class scheduled.</span>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.4rem' }}>
                {(e.idleTimePeriods || []).map((idle: any, i: number) => (
                  <div key={i} style={{ padding: '0.5rem 0.7rem', background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.9rem' }}>😴</span>
                    <div>
                      <div style={{ fontWeight: 600, color: '#1c0a00', fontSize: '0.78rem' }}>{idle.day}</div>
                      <div style={{ fontSize: '0.68rem', color: '#dc2626' }}>{idle.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
