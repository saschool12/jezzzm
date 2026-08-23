// ---------- Helpers ----------
const API = window.location.origin + '/api';
let token = localStorage.getItem('token');
let currentUser = null;
let currentConversationId = null;
let isProcessing = false;

function setAuthHeader() {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function showError(msg) {
  const el = document.getElementById('error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function showSuccess(msg) {
  const el = document.getElementById('success');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function hideMessages() {
  document.querySelectorAll('.error, .success').forEach(el => el.style.display = 'none');
}

// ---------- Auth Pages ----------
if (document.getElementById('loginForm')) {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
      const res = await fetch(`${API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('token', data.token);
      window.location.href = '/';
    } catch (err) {
      showError(err.message);
    }
  });
}

if (document.getElementById('registerForm')) {
  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirmPassword').value;
    if (password !== confirm) return showError('Passwords do not match');
    try {
      const res = await fetch(`${API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      localStorage.setItem('token', data.token);
      window.location.href = '/';
    } catch (err) {
      showError(err.message);
    }
  });
}

if (document.getElementById('forgotForm')) {
  document.getElementById('forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();
    const email = document.getElementById('email').value;
    try {
      const res = await fetch(`${API}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send reset link');
      showSuccess('Reset link sent! Check your email.');
    } catch (err) {
      showError(err.message);
    }
  });
}

if (document.getElementById('resetForm')) {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  if (!token) document.getElementById('error').textContent = 'Missing reset token.';

  document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessages();
    const newPassword = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    if (newPassword !== confirm) return showError('Passwords do not match');
    if (newPassword.length < 8) return showError('Password must be at least 8 characters');
    try {
      const res = await fetch(`${API}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      showSuccess('Password reset! You can now <a href="/login.html">sign in</a>.');
    } catch (err) {
      showError(err.message);
    }
  });
}

// ---------- Chat App ----------
if (document.getElementById('messages')) {
  // Check auth
  if (!token) {
    window.location.href = '/login.html';
  }

  // Load user
  async function loadUser() {
    try {
      const res = await fetch(`${API}/me`, { headers: setAuthHeader() });
      if (!res.ok) throw new Error('Session expired');
      const data = await res.json();
      currentUser = data.user;
      document.getElementById('userName').textContent = currentUser.name;
      document.getElementById('userEmail').textContent = currentUser.email;
      document.getElementById('messageInput').disabled = false;
      document.getElementById('sendBtn').disabled = false;
    } catch (err) {
      localStorage.removeItem('token');
      window.location.href = '/login.html';
    }
  }

  // Load conversations
  async function loadConversations() {
    try {
      const res = await fetch(`${API}/conversations`, { headers: setAuthHeader() });
      const data = await res.json();
      const list = document.getElementById('convoList');
      list.innerHTML = '';
      data.conversations.forEach(conv => {
        const div = document.createElement('div');
        div.className = 'convo-item' + (conv.id === currentConversationId ? ' active' : '');
        div.innerHTML = `
          <span class="title">${conv.title}</span>
          <button class="delete-btn" data-id="${conv.id}">✕</button>
        `;
        div.querySelector('.title').addEventListener('click', () => openConversation(conv.id));
        div.querySelector('.delete-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          deleteConversation(conv.id);
        });
        list.appendChild(div);
      });
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }

  // Open conversation
  async function openConversation(id) {
    currentConversationId = id;
    document.getElementById('chatTitle').textContent = 'Loading...';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('messages').querySelectorAll('.message').forEach(el => el.remove());
    try {
      const res = await fetch(`${API}/conversations/${id}/messages`, { headers: setAuthHeader() });
      const data = await res.json();
      data.messages.forEach(msg => {
        appendMessage(msg.role, msg.content);
      });
      // Update title
      const convo = document.querySelector(`.convo-item[data-id="${id}"]`);
      if (convo) document.getElementById('chatTitle').textContent = convo.querySelector('.title').textContent;
      else document.getElementById('chatTitle').textContent = 'Chat';
      loadConversations();
      scrollToBottom();
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }

  // Delete conversation
  async function deleteConversation(id) {
    if (!confirm('Delete this conversation?')) return;
    try {
      await fetch(`${API}/conversations/${id}`, { method: 'DELETE', headers: setAuthHeader() });
      if (currentConversationId === id) {
        currentConversationId = null;
        document.getElementById('messages').querySelectorAll('.message').forEach(el => el.remove());
        document.getElementById('emptyState').style.display = 'flex';
        document.getElementById('chatTitle').textContent = 'New Chat';
      }
      loadConversations();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  }

  // Append message
  function appendMessage(role, content) {
    const container = document.getElementById('messages');
    const empty = document.getElementById('emptyState');
    if (empty) empty.style.display = 'none';
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerHTML = `<div class="role">${role}</div><div>${content}</div>`;
    container.appendChild(div);
    scrollToBottom();
  }

  function scrollToBottom() {
    const container = document.getElementById('messages');
    container.scrollTop = container.scrollHeight;
  }

  // Send message
  async function sendMessage() {
    if (isProcessing) return;
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) return;

    isProcessing = true;
    document.getElementById('sendBtn').disabled = true;
    input.disabled = true;

    // Show user message
    appendMessage('user', text);
    input.value = '';

    // Show typing
    document.getElementById('typingIndicator').style.display = 'flex';

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: setAuthHeader(),
        body: JSON.stringify({ conversationId: currentConversationId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get response');

      // Update conversation
      if (!currentConversationId) {
        currentConversationId = data.conversationId;
        document.getElementById('chatTitle').textContent = text.length > 50 ? text.slice(0, 50) + '...' : text;
      }
      document.getElementById('typingIndicator').style.display = 'none';
      appendMessage('assistant', data.response);
      loadConversations();
    } catch (err) {
      document.getElementById('typingIndicator').style.display = 'none';
      appendMessage('assistant', '⚠️ Error: ' + err.message);
    } finally {
      isProcessing = false;
      document.getElementById('sendBtn').disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  // New chat
  document.getElementById('newChatBtn').addEventListener('click', () => {
    currentConversationId = null;
    document.getElementById('messages').querySelectorAll('.message').forEach(el => el.remove());
    document.getElementById('emptyState').style.display = 'flex';
    document.getElementById('chatTitle').textContent = 'New Chat';
    loadConversations();
  });

  // Send button
  document.getElementById('sendBtn').addEventListener('click', sendMessage);

  // Enter key
  document.getElementById('messageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  document.getElementById('messageInput').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
  });

  // Sidebar toggle (mobile)
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Init
  loadUser();
  loadConversations();
}
