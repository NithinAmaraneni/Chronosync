'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { io, Socket } from 'socket.io-client';
import { api } from '@/lib/api';

interface UserInfo {
  id: string;
  full_name: string;
  department?: string;
  role?: string;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
}

export default function ChatInterface() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedUserRef = useRef<UserInfo | null>(null);

  // Keep ref in sync
  useEffect(() => {
    selectedUserRef.current = selectedUser;
    if (selectedUser) {
      // Clear unread counts for this user — key on user_id (short ID) to match socket senderId
      const selectedShortId = (selectedUser as any).user_id || selectedUser.id;
      setUnreadCounts(prev => ({ ...prev, [selectedShortId]: 0 }));
    }
  }, [selectedUser]);

  useEffect(() => {
    // Fetch users to chat with
    const fetchUsers = async () => {
      try {
        if (user?.role === 'student') {
          const data = await api.getStudentFacultyList();
          if (data.success) {
            setUsers(data.faculty || []);
          }
        } else if (user?.role === 'faculty') {
          const data = await api.request('/faculty/students');
          if (data.success) {
            setUsers(data.students || []);
          }
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };
    if (user) fetchUsers();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const newSocket = io('http://localhost:5001', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    const currentId = (user as any)?.userId || user?.id;
    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('register', currentId);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('history', (history: Message[]) => {
      setMessages(history);

      // Calculate initial unread counts (simplistic approach: all messages where we are receiver are unread unless we select them)
      // For a robust system, we would need a 'read_status' in the database.
      // Here, we'll just start with 0 unread since it's an ephemeral array on backend.
    });

    newSocket.on('new_message', (message: Message) => {
      console.log('Received new_message from socket:', message);
      setMessages(prev => {
        // Prevent duplicates (handles both optimistic and server echo)
        if (prev.some(m => m.id === message.id)) return prev;
        // Replace optimistic placeholder if it matches (same senderId + receiverId + text)
        const optimisticIdx = prev.findIndex(
          m => m.id.startsWith('optimistic_') &&
            m.senderId === message.senderId &&
            m.receiverId === message.receiverId &&
            m.text === message.text
        );
        if (optimisticIdx !== -1) {
          const updated = [...prev];
          updated[optimisticIdx] = message;
          return updated;
        }
        return [...prev, message];
      });

      // Handle unread counts — key on senderId (short user_id) to match sidebar keys
      const currentlySelected = selectedUserRef.current;
      const currentId = (user as any)?.userId || user?.id;
      if (message.senderId !== currentId) {
        const selectedShortId = currentlySelected
          ? ((currentlySelected as any).user_id || currentlySelected.id)
          : null;
        if (!selectedShortId || selectedShortId !== message.senderId) {
          setUnreadCounts(prev => ({
            ...prev,
            [message.senderId]: (prev[message.senderId] || 0) + 1
          }));
        }
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedUser]);

  const clearConversation = async () => {
    if (!selectedUser || !user) return;
    const otherUserId = (selectedUser as any).user_id || selectedUser.id;
    const currentUserId = (user as any)?.userId || user?.id;

    // ── 1. Clear local state immediately (instant UI feedback) ──
    setMessages(prev => prev.filter(
      m => !((m.senderId === currentUserId && m.receiverId === otherUserId) ||
        (m.senderId === otherUserId && m.receiverId === currentUserId))
    ));
    setShowClearConfirm(false);

    // ── 2. Persist clear timestamp to DB (best-effort, in background) ──
    try {
      const result = await api.request('/chat/clear', {
        method: 'POST',
        body: JSON.stringify({ other_user_id: otherUserId }),
      });
      console.log('[Chat] Conversation cleared in DB:', result);
    } catch (err) {
      console.error('[Chat] Failed to persist clear to DB (table may not exist yet):', err);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedUser || !socket) {
      console.log('Cannot send:', { inputText: inputText.trim(), selectedUser, hasSocket: !!socket });
      return;
    }

    // Fallback to userId if id is missing in older localStorage sessions
    const senderId = (user as any)?.userId || user?.id;

    if (!senderId) {
      console.error('Cannot send: User ID is missing from AuthContext');
      return;
    }

    const receiverId = (selectedUser as any).user_id || selectedUser.id;
    const text = inputText.trim();

    // ── Optimistic update: show message immediately without waiting for server echo ──
    const optimisticMsg: Message = {
      id: `optimistic_${Date.now()}`,
      senderId,
      receiverId,
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setInputText('');

    // Emit to server — server will persist & broadcast back with real DB id
    socket.emit('send_message', { senderId, receiverId, text });
  };

  const currentUserId = (user as any)?.userId || user?.id;

  const filteredMessages = messages.filter(
    m => (m.senderId === currentUserId && m.receiverId === ((selectedUser as any)?.user_id || selectedUser?.id)) ||
      (m.senderId === ((selectedUser as any)?.user_id || selectedUser?.id) && m.receiverId === currentUserId)
  );

  return (
    <>
      <style>{`
      @keyframes pulse-badge {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
      }
    `}</style>
      <div className="ds-card" style={{ display: 'flex', height: 'calc(100vh - 120px)', padding: 0, overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', borderRadius: '16px' }}>
        {/* Users List Sidebar */}
        <div style={{ width: '320px', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: 'white' }}>
          <div style={{ padding: '24px 20px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1f2937', fontWeight: 700 }}>
              {user?.role === 'student' ? 'Faculty Members' : 'Students'}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: isConnected ? '#10b981' : '#ef4444' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: isConnected ? '#10b981' : '#ef4444' }}></span>
              {isConnected ? 'Online' : 'Connecting...'}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {users.map(u => {
              const isSelected = selectedUser?.id === u.id;
              // Key on user_id (short ID like FAC20263368) — this matches socket senderId
              const shortId = (u as any).user_id || u.id;
              const unreadCount = unreadCounts[shortId] || 0;
              return (
                <div
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f3f4f6',
                    background: isSelected ? '#fff7ed' : unreadCount > 0 ? '#fffbf5' : 'white',
                    borderLeft: isSelected ? '4px solid #f97316' : unreadCount > 0 ? '4px solid #fbbf24' : '4px solid transparent',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: isSelected ? 'linear-gradient(135deg, #f97316, #ef4444)' : '#f3f4f6',
                    color: isSelected ? 'white' : '#6b7280',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', fontSize: '1.1rem', flexShrink: 0
                  }}>
                    {u.full_name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: unreadCount > 0 ? 700 : 600, color: isSelected ? '#1f2937' : '#4b5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.full_name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: unreadCount > 0 ? '#f97316' : '#9ca3af', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: unreadCount > 0 ? 600 : 400 }}>
                      {unreadCount > 0 ? `${unreadCount} new message${unreadCount > 1 ? 's' : ''}` : (u.department || 'No Dept')}
                    </div>
                  </div>
                </div>
              );
            })}
            {users.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 48, height: 48, opacity: 0.5 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                No users found in your department.
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f9fafb', position: 'relative' }}>
          {selectedUser ? (
            <>
              {/* Chat Header */}
              <div style={{ padding: '16px 30px', borderBottom: '1px solid #e5e7eb', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #f97316, #ef4444)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', marginRight: 15, boxShadow: '0 4px 10px rgba(249, 115, 22, 0.2)' }}>
                    {selectedUser.full_name.charAt(0)}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1f2937', fontWeight: 700 }}>{selectedUser.full_name}</h3>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f97316', marginBottom: '2px' }}>
                      {(selectedUser as any).user_id || selectedUser.id}
                    </div>
                    <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{selectedUser.department}</span>
                  </div>
                </div>

                {/* Clear Conversation Button */}
                {!showClearConfirm ? (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: 'none', border: '1px solid #e5e7eb',
                      borderRadius: '8px', padding: '8px 14px', cursor: 'pointer',
                      color: '#6b7280', fontSize: '0.85rem', fontWeight: 500,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#ef4444'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
                  >
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 16, height: 16 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clear Chat
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 14px' }}>
                    <span style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 500 }}>Clear for you only?</span>
                    <button
                      onClick={clearConversation}
                      style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}
                    >
                      Yes, Clear
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      style={{ background: 'none', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.82rem' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Messages Container */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px', backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                {filteredMessages.length === 0 ? (
                  <div style={{ margin: 'auto', color: '#9ca3af', textAlign: 'center', background: 'white', padding: '30px 40px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 64, height: 64, margin: '0 auto 15px', color: '#f97316', opacity: 0.8 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p style={{ fontSize: '1.1rem', fontWeight: 500, color: '#374151' }}>Start a conversation with {selectedUser.full_name}</p>
                    <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Send a message to break the ice!</p>
                  </div>
                ) : (
                  filteredMessages.map((m, index) => {
                    const isMe = m.senderId === currentUserId;
                    const showAvatar = index === filteredMessages.length - 1 || filteredMessages[index + 1].senderId !== m.senderId;

                    return (
                      <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%', display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '8px' }}>
                        {!isMe && showAvatar ? (
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#e5e7eb', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {selectedUser.full_name.charAt(0)}
                          </div>
                        ) : (
                          <div style={{ width: 28 }} />
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                          <div style={{
                            background: isMe ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'white',
                            color: isMe ? 'white' : '#1f2937',
                            padding: '12px 18px',
                            borderRadius: '18px',
                            borderBottomRightRadius: isMe && showAvatar ? '4px' : '18px',
                            borderBottomLeftRadius: !isMe && showAvatar ? '4px' : '18px',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                            border: isMe ? 'none' : '1px solid #f3f4f6',
                            fontSize: '0.95rem',
                            lineHeight: '1.5'
                          }}>
                            {m.text}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '4px', padding: '0 4px' }}>
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div style={{ padding: '20px 30px', background: 'white', borderTop: '1px solid #e5e7eb', zIndex: 10 }}>
                <form onSubmit={sendMessage} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="text"
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      placeholder="Type your message here..."
                      style={{
                        width: '100%',
                        padding: '14px 20px',
                        paddingRight: '50px',
                        borderRadius: '99px',
                        border: '1px solid #d1d5db',
                        outline: 'none',
                        fontSize: '0.95rem',
                        color: '#000000',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#f97316'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                    <div style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 20, height: 20 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    style={{
                      background: inputText.trim() ? 'linear-gradient(135deg, #f97316, #ef4444)' : '#e5e7eb',
                      color: inputText.trim() ? 'white' : '#9ca3af',
                      border: 'none',
                      borderRadius: '50%',
                      width: '48px',
                      height: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s',
                      boxShadow: inputText.trim() ? '0 4px 10px rgba(249, 115, 22, 0.3)' : 'none'
                    }}
                  >
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 20, height: 20, transform: 'rotate(90deg) translateX(2px)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div style={{ margin: 'auto', color: '#9ca3af', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 50, height: 50, color: '#f97316', opacity: 0.8 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <h2 style={{ fontSize: '1.5rem', color: '#374151', margin: '0 0 10px 0' }}>Your Messages</h2>
              <p style={{ fontSize: '1.05rem', margin: 0 }}>Select a user from the sidebar to start chatting</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
