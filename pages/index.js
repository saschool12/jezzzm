// Add after the message display
// Message reactions component

function MessageReactions({ messageId, reactions }) {
  const [showPicker, setShowPicker] = useState(false);
  const emojis = ['👍', '❤️', '😂', '🎉', '😮', '😢'];

  const addReaction = (emoji) => {
    // In a real app, save to database
    console.log('Added reaction:', emoji, 'to message:', messageId);
    setShowPicker(false);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', marginTop: '4px' }}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        style={{ background: 'none', border: 'none', color: '#8899bb', cursor: 'pointer', fontSize: '0.9rem' }}
      >
        {Object.values(reactions || {}).length > 0 ? Object.values(reactions).join(' ') : '➕'}
      </button>
      {showPicker && (
        <div style={{ position: 'absolute', bottom: '100%', left: 0, background: '#1e2f42', padding: '8px', borderRadius: '8px', display: 'flex', gap: '6px', border: '1px solid #ffd70044', zIndex: 1000 }}>
          {emojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => addReaction(emoji)}
              style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '2px 6px' }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
// Add this component
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: '4px', padding: '8px', color: '#8899bb' }}>
      <span>Jhonny is typing</span>
      <span style={{ animation: 'dot 1.4s infinite' }}>.</span>
      <span style={{ animation: 'dot 1.4s infinite 0.2s' }}>.</span>
      <span style={{ animation: 'dot 1.4s infinite 0.4s' }}>.</span>
      <style>{`
        @keyframes dot {
          0%, 60%, 100% { opacity: 0; }
          30% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
// Add this to your sidebar component
// Conversation search input

<input
  type="text"
  placeholder="🔍 Search conversations..."
  onChange={(e) => {
    const searchTerm = e.target.value.toLowerCase();
    // Filter conversations list
    const filtered = conversations.filter(c => 
      c.title.toLowerCase().includes(searchTerm) ||
      c.messages?.some(m => m.content.toLowerCase().includes(searchTerm))
    );
    setFilteredConversations(filtered);
  }}
  style={{ width: '100%', padding: '10px', margin: '10px 0', background: '#1e2f42', color: '#fff', border: 'none', borderRadius: '8px' }}
/>
