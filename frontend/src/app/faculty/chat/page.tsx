import ChatInterface from '@/components/ChatInterface';

export const metadata = { title: 'Chat - ChronoSync Faculty' };

export default function FacultyChatPage() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#111827', margin: 0 }}>Chat with Students</h1>
      </div>
      <ChatInterface />
    </div>
  );
}
