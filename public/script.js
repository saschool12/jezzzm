// ---------- Helpers ----------
const API = window.location.origin + '/api';
let token = localStorage.getItem('token');
let currentUser = null;
let currentConversationId = null;
let isProcessing = false;
let editingMessageId = null;

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
  if (!token) {
    window.location.href = '/login.html';
  }

  // ---------- Load user ----------
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
  // ---------- Load conversations ----------
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
      div.querySelector('.title').addEventListener('click', () => {
        openConversation(conv.id);
        document.getElementById('sidebar').classList.remove('open');
      });
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

// ---------- Open conversation ----------
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
    const convo = document.querySelector(`.convo-item[data-id="${id}"]`);
    if (convo) document.getElementById('chatTitle').textContent = convo.querySelector('.title').textContent;
    else document.getElementById('chatTitle').textContent = 'Chat';
    document.getElementById('chatTitle').style.cursor = 'pointer';
    loadConversations();
    scrollToBottom();
  } catch (err) {
    console.error('Failed to load messages:', err);
  }
}

// ---------- Delete conversation ----------
async function deleteConversation(id) {
  if (!confirm('Delete this conversation?')) return;
  try {
    await fetch(`${API}/conversations/${id}`, { method: 'DELETE', headers: setAuthHeader() });
    if (currentConversationId === id) {
      currentConversationId = null;
      document.getElementById('messages').querySelectorAll('.message').forEach(el => el.remove());
      document.getElementById('emptyState').style.display = 'flex';
      document.getElementById('chatTitle').textContent = 'New Chat';
      document.getElementById('chatTitle').style.cursor = 'default';
    }
    loadConversations();
  } catch (err) {
    console.error('Failed to delete:', err);
  }
}// ---------- Render markdown + code blocks ----------
function renderMarkdown(text) {
  const codeBlocks = [];
  let processed = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang, code });
    return `{{CODE_BLOCK_${idx}}}`;
  });
  let html = marked.parse(processed);
  html = html.replace(/\{\{CODE_BLOCK_(\d+)\}\}/g, (match, idx) => {
    const block = codeBlocks[parseInt(idx)];
    const escapedCode = block.code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `
      <div class="code-block-wrapper">
        <button class="copy-btn" onclick="copyCode(this)" data-code="${encodeURIComponent(escapedCode)}">Copy</button>
        <pre><code class="language-${block.lang || 'plaintext'}">${escapedCode}</code></pre>
      </div>
    `;
  });
  return html;
}

// ---------- Global copy function ----------
window.copyCode = function(btn) {
  const code = decodeURIComponent(btn.getAttribute('data-code'));
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
  }).catch(() => {
    const textarea = document.createElement('textarea');
    textarea.value = code;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 2000);
  });
};

// ---------- Append message with edit/delete for user ----------
let messageCounter = 0;

function appendMessage(role, content, isTemp = false) {
  const container = document.getElementById('messages');
  const empty = document.getElementById('emptyState');
  if (empty) empty.style.display = 'none';
  const div = document.createElement('div');
  const msgId = `msg-${messageCounter++}`;
  div.className = `message ${role}`;
  div.dataset.msgId = msgId;

  let formattedContent = content;
  if (role === 'assistant') {
    formattedContent = renderMarkdown(content);
  } else {
    formattedContent = content.replace(/\n/g, '<br>');
  }

  let actionsHtml = '';
  if (role === 'user' && !isTemp) {
    actionsHtml = `
      <div class="msg-actions">
        <button class="edit-msg-btn" data-msgid="${msgId}" title="Edit">✏️</button>
        <button class="delete-msg-btn" data-msgid="${msgId}" title="Delete">🗑️</button>
      </div>
    `;
  }

  div.innerHTML = `
    <div class="role">${role}</div>
    <div class="content">${formattedContent}</div>
    ${actionsHtml}
  `;
  container.appendChild(div);
  requestAnimationFrame(() => scrollToBottom());

  if (role === 'user') {
    const editBtn = div.querySelector('.edit-msg-btn');
    const deleteBtn = div.querySelector('.delete-msg-btn');
    if (editBtn) editBtn.addEventListener('click', () => editUserMessage(div));
    if (deleteBtn) deleteBtn.addEventListener('click', () => deleteUserMessage(div));
  }
  return div;
}
  // ---------- Edit user message ----------
function editUserMessage(msgDiv) {
  if (isProcessing) return;
  const contentDiv = msgDiv.querySelector('.content');
  const originalText = contentDiv.textContent.trim();
  const textarea = document.createElement('textarea');
  textarea.className = 'edit-textarea';
  textarea.value = originalText;
  textarea.rows = 3;
  const saveBtn = document.createElement('button');
  saveBtn.className = 'edit-save-btn';
  saveBtn.textContent = 'Save';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'edit-cancel-btn';
  cancelBtn.textContent = 'Cancel';
  const btnWrap = document.createElement('div');
  btnWrap.className = 'edit-buttons';
  btnWrap.appendChild(saveBtn);
  btnWrap.appendChild(cancelBtn);
  contentDiv.innerHTML = '';
  contentDiv.appendChild(textarea);
  contentDiv.appendChild(btnWrap);

  const cancelEdit = () => {
    contentDiv.textContent = originalText;
    const actions = msgDiv.querySelector('.msg-actions');
    if (actions) actions.style.display = 'flex';
  };

  cancelBtn.addEventListener('click', cancelEdit);

  saveBtn.addEventListener('click', async () => {
    const newText = textarea.value.trim();
    if (!newText) return;
    const nextSibling = msgDiv.nextElementSibling;
    if (nextSibling && nextSibling.classList.contains('message') && nextSibling.classList.contains('assistant')) {
      nextSibling.remove();
    }
    contentDiv.textContent = newText;
    const actions = msgDiv.querySelector('.msg-actions');
    if (actions) actions.style.display = 'flex';
    await sendMessageText(newText, true);
  });

  const actions = msgDiv.querySelector('.msg-actions');
  if (actions) actions.style.display = 'none';
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
}

// ---------- Delete user message (and following assistant) ----------
function deleteUserMessage(msgDiv) {
  if (isProcessing) return;
  if (!confirm('Delete this message and the AI response?')) return;
  const nextSibling = msgDiv.nextElementSibling;
  if (nextSibling && nextSibling.classList.contains('message') && nextSibling.classList.contains('assistant')) {
    nextSibling.remove();
  }
  msgDiv.remove();
  const container = document.getElementById('messages');
  if (container.querySelectorAll('.message').length === 0) {
    document.getElementById('emptyState').style.display = 'flex';
  }
}
  // ---------- Send message (internal) ----------
async function sendMessageText(text, isEdit = false) {
  if (isProcessing) return;
  isProcessing = true;
  document.getElementById('sendBtn').disabled = true;
  document.getElementById('messageInput').disabled = true;

  let userMsgDiv;
  if (!isEdit) {
    userMsgDiv = appendMessage('user', text, false);
  }

  document.getElementById('typingIndicator').style.display = 'flex';

  try {
    const res = await fetch(`${API}/chat`, {
      method: 'POST',
      headers: setAuthHeader(),
      body: JSON.stringify({ conversationId: currentConversationId, message: text }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to get response');

    if (!currentConversationId) {
      currentConversationId = data.conversationId;
      document.getElementById('chatTitle').textContent = text.length > 50 ? text.slice(0, 50) + '...' : text;
      document.getElementById('chatTitle').style.cursor = 'pointer';
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
    document.getElementById('messageInput').disabled = false;
    document.getElementById('messageInput').focus();
  }
}

// ---------- Public send (from input) ----------
async function sendMessage() {
  if (isProcessing) return;
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await sendMessageText(text, false);
}

// ---------- Scroll ----------
function scrollToBottom() {
  const container = document.getElementById('messages');
  container.scrollTop = container.scrollHeight;
}

// ---------- Rename conversation ----------
document.getElementById('chatTitle').addEventListener('click', async function() {
  if (!currentConversationId) return;
  const currentName = this.textContent;
  const newName = prompt('Rename conversation:', currentName);
  if (!newName || newName === currentName) return;
  try {
    const res = await fetch(`${API}/conversations/${currentConversationId}`, {
      method: 'PATCH',
      headers: setAuthHeader(),
      body: JSON.stringify({ title: newName }),
    });
    if (res.ok) {
      this.textContent = newName;
      loadConversations();
    } else {
      this.textContent = newName;
      const convoItem = document.querySelector(`.convo-item[data-id="${currentConversationId}"]`);
      if (convoItem) convoItem.querySelector('.title').textContent = newName;
    }
  } catch (err) {
    this.textContent = newName;
    const convoItem = document.querySelector(`.convo-item[data-id="${currentConversationId}"]`);
    if (convoItem) convoItem.querySelector('.title').textContent = newName;
  }
});
    // ---------- Event listeners ----------
  document.getElementById('newChatBtn').addEventListener('click', () => {
    currentConversationId = null;
    document.getElementById('messages').querySelectorAll('.message').forEach(el => el.remove());
    document.getElementById('emptyState').style.display = 'flex';
    document.getElementById('chatTitle').textContent = 'New Chat';
    document.getElementById('chatTitle').style.cursor = 'default';
    loadConversations();
    document.getElementById('sidebar').classList.remove('open');
  });

  document.getElementById('sendBtn').addEventListener('click', sendMessage);

  document.getElementById('messageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById('messageInput').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
  });

  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.getElementById('sidebarOverlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
  });

  document.querySelectorAll('.suggestion').forEach(btn => {
    btn.addEventListener('click', function() {
      const prompt = this.dataset.prompt;
      document.getElementById('messageInput').value = prompt;
      document.getElementById('messageInput').dispatchEvent(new Event('input'));
      sendMessage();
      document.getElementById('sidebar').classList.remove('open');
    });
  });

  // Init
  loadUser();
  loadConversations();
}
  
  
