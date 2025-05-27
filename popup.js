// Revised popup.js with DOMContentLoaded and proper tf loading

// Ensure DOM is loaded before accessing elements
document.addEventListener("DOMContentLoaded", () => {
  const sendButton = document.getElementById("send");
  const queryInput = document.getElementById("query");
  const responseDiv = document.getElementById("response");

  const uploadButton = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("fileInput");

  // File upload logic
  uploadButton?.addEventListener("click", async () => {
    const file = fileInput.files[0];
    if (!file) {
      alert("Please choose a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        alert("File uploaded successfully!");
      } else {
        alert("File upload failed.");
      }
    } catch (err) {
      console.error("Upload error:", err);
    }
  });

  // Query handling logic
  sendButton?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ getContext: true }, async (context) => {
      const query = queryInput.value;

      const res = await fetch("http://localhost:8000/contextual-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, context })
      });

      if (!res.ok) {
        responseDiv.textContent = "Error: " + (await res.text());
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let responseText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        responseText += decoder.decode(value, { stream: true });
        responseDiv.textContent = responseText;
      }
    });
  });
});

// popup.js (revised for real-time intent inference)

// Initialize variables
const API_URL = 'http://localhost:8000';
let chatMessages;
let userInput;
let sendButton;
let clearButton;

// Initialize the app
async function initializeApp() {
    try {
        // Get UI elements
        chatMessages = document.getElementById('chat-messages');
        userInput = document.getElementById('user-input');
        sendButton = document.getElementById('send-button');
        clearButton = document.getElementById('clear-button');

        // Load chat history from storage
        loadChatHistory();

        // Add event listeners
        sendButton.addEventListener('click', sendMessage);
        clearButton.addEventListener('click', clearChat);
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Auto-resize textarea
        userInput.addEventListener('input', () => {
            userInput.style.height = 'auto';
            userInput.style.height = Math.min(userInput.scrollHeight, 100) + 'px';
        });

    } catch (error) {
        showError('Failed to initialize. Please check if the backend service is running.');
    }
}

// Load chat history from storage
function loadChatHistory() {
    chrome.storage.local.get(['chatHistory'], (result) => {
        if (result.chatHistory) {
            chatMessages.innerHTML = ''; // Clear existing messages
            result.chatHistory.forEach(message => {
                addMessage(message.role, message.content, false);
            });
            scrollToBottom();
        }
    });
}

// Save chat history to storage
function saveChatHistory() {
    const messages = Array.from(chatMessages.children).map(msg => ({
        role: msg.classList.contains('user-message') ? 'user' : 'assistant',
        content: msg.textContent
    }));
    chrome.storage.local.set({ chatHistory: messages });
}

// Add a message to the chat
function addMessage(role, content, shouldSave = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    messageDiv.textContent = content;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    
    if (shouldSave) {
        saveChatHistory();
    }
}

// Clear chat display without removing history
function clearChat() {
    // Clear the display
    chatMessages.innerHTML = '';
    
    // Don't reload from storage - this ensures the display stays clear
    // while preserving the history in storage
}

// Scroll chat to bottom
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send message to backend
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Clear input
    userInput.value = '';
    userInput.style.height = 'auto';

    // Add user message to chat
    addMessage('user', message);

    try {
        // Get the current page context
        const context = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ getContext: true }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                resolve(response);
            });
        });

        // Create a temporary message div for streaming
        const tempMessageDiv = document.createElement('div');
        tempMessageDiv.className = 'message assistant-message';
        chatMessages.appendChild(tempMessageDiv);

        // Get contextual response
        const response = await fetch(`${API_URL}/contextual-ask`, {
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

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let responseText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            responseText += decoder.decode(value, { stream: true });
            tempMessageDiv.textContent = responseText;
            scrollToBottom();
        }

        // Save the final message to chat history
        saveChatHistory();

    } catch (error) {
        let errorMessage = 'Sorry, I encountered an error. Please try again.';
        addMessage('assistant', errorMessage);
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);


