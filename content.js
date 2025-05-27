// Log that the content script has loaded
console.log('[Engenium] Content script loaded');

// Inject required styles and fonts
const style = document.createElement('link');
style.rel = 'stylesheet';
style.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
document.head.appendChild(style);

const avatarStyle = document.createElement('link');
avatarStyle.rel = 'stylesheet';
avatarStyle.href = chrome.runtime.getURL('avatar.css');
document.head.appendChild(avatarStyle);

// Create and inject avatar
const avatar = document.createElement('div');
avatar.className = 'engenium-avatar';
avatar.innerHTML = '<span class="material-icons">smart_toy</span>';
document.body.appendChild(avatar);

// Create chat window
const chatWindow = document.createElement('div');
chatWindow.className = 'engenium-chat-window';
chatWindow.innerHTML = `
  <div class="engenium-chat-header">
    <h2>Engenium AI</h2>
    <span class="material-icons close-btn">close</span>
  </div>
  <div class="engenium-chat-messages"></div>
  <div class="engenium-input-container">
    <textarea class="engenium-input" placeholder="Type your message..." rows="1"></textarea>
  </div>
`;
document.body.appendChild(chatWindow);

// Get elements
const chatMessages = chatWindow.querySelector('.engenium-chat-messages');
const input = chatWindow.querySelector('.engenium-input');
const closeBtn = chatWindow.querySelector('.close-btn');

// Toggle chat window
avatar.addEventListener('click', () => {
  chatWindow.classList.toggle('active');
  if (chatWindow.classList.contains('active')) {
    input.focus();
  }
});

// Close chat window
closeBtn.addEventListener('click', () => {
  chatWindow.classList.remove('active');
});

// Handle input
input.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;

    // Add user message
    addMessage('user', message);
    input.value = '';
    input.style.height = 'auto';

    // Show typing indicator
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'engenium-typing-indicator';
    typingIndicator.innerHTML = `
      <div class="engenium-typing-dot"></div>
      <div class="engenium-typing-dot"></div>
      <div class="engenium-typing-dot"></div>
    `;
    chatMessages.appendChild(typingIndicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      // Get context from the current page
      const context = {
        domain: window.location.hostname,
        title: document.title,
        activeInput: document.activeElement?.value || '',
        currentSection: getCurrentSection()
      };

      // Send message to backend
      const response = await fetch('http://localhost:8000/contextual-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: message,
          context: context
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // Remove typing indicator
      typingIndicator.remove();

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let responseText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        responseText += decoder.decode(value, { stream: true });
        addMessage('assistant', responseText, true);
      }

    } catch (error) {
      typingIndicator.remove();
      addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
    }
  }
});

// Auto-resize textarea
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});

// Helper function to add messages
function addMessage(role, content, update = false) {
  if (update && chatMessages.lastElementChild?.classList.contains('engenium-assistant-message')) {
    chatMessages.lastElementChild.textContent = content;
  } else {
    const messageDiv = document.createElement('div');
    messageDiv.className = `engenium-message engenium-${role}-message`;
    messageDiv.textContent = content;
    chatMessages.appendChild(messageDiv);
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Helper function to get current section
function getCurrentSection() {
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let currentSection = '';
  
  for (const heading of headings) {
    const rect = heading.getBoundingClientRect();
    if (rect.top > 0 && rect.top < window.innerHeight) {
      currentSection = heading.textContent;
      break;
    }
  }
  
  return currentSection;
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.getContext) {
    const context = {
      domain: window.location.hostname,
      title: document.title,
      activeInput: document.activeElement?.value || '',
      currentSection: getCurrentSection()
    };
    sendResponse(context);
  }
});
