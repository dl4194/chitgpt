import { app } from "./firebase_conf.js";
import { apiService } from "./apiService.js";
import { notificationService } from "./notificationService.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";
import md from "./render.js";

const auth = getAuth(app);
const input = document.getElementById("messageInput");
const button = document.getElementById("sendBtn");
const chatBox = document.getElementById("chatBox");
const badge = document.getElementById("authBadge");
const badgeText = document.getElementById("badgeText");
const loginLink = document.getElementById("loginLink");
const sidebar = document.getElementById("sidebar");
const sessionsList = document.getElementById("sessionsList");
const newChatBtn = document.getElementById("newChatBtn");
const sidebarToggle = document.getElementById("sidebarToggle");
const toggleSidebarBtn = document.getElementById("toggleSidebar");

let currentUser = null;
let currentSessionId = null;
let isGenerating = false;
let abortController = null;

function addMessage(text, sender) {
    const message = document.createElement("div");
    message.classList.add("message", sender);
    message.innerHTML = md.render(text);
    chatBox.appendChild(message);
    window.scrollTo(0, document.body.scrollHeight);
    return message;
}

function clearChat() {
    chatBox.innerHTML = "";
}

async function createSession() {
    if (!currentUser) return null;
    const sessionName = prompt("Enter a name for this chat:");
    if (!sessionName || !sessionName.trim()) return null;

    try {
        const token = await currentUser.getIdToken();
        const data = await apiService.createSession(token, sessionName.trim());
        notificationService.success('Chat created successfully');
        return data.sessionId;
    } catch (err) {
        const message = err instanceof apiService.ApiError
            ? err.message
            : 'Failed to create chat. Please try again.';
        notificationService.error(message);
        return null;
    }
}

async function loadSessions() {
    if (!currentUser) return;

    try {
        const token = await currentUser.getIdToken();
        const data = await apiService.loadSessions(token);

        sessionsList.innerHTML = "";
        if (data.sessions && data.sessions.length > 0) {
            data.sessions.forEach(session => {
                const item = document.createElement("div");
                item.className = "session-item";
                if (session.id === currentSessionId) item.classList.add("active");

                const nameSpan = document.createElement("span");
                nameSpan.className = "session-name";
                nameSpan.textContent = session.name;

                const deleteBtn = document.createElement("button");
                deleteBtn.className = "delete-session";
                deleteBtn.textContent = "delete";
                deleteBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    deleteSession(session.id);
                });

                item.appendChild(nameSpan);
                item.appendChild(deleteBtn);
                item.addEventListener("click", () => openSession(session.id));

                sessionsList.appendChild(item);
            });
        }
    } catch (err) {
        const message = err instanceof apiService.ApiError
            ? err.message
            : 'Failed to load chats';
        console.error('Error loading sessions:', err);
        if (err.status !== 0) {
            notificationService.error(message);
        }
    }
}

async function openSession(sessionId) {
    currentSessionId = sessionId;
    clearChat();
    closeSidebar();

    await loadChatHistory(sessionId);
    await loadSessions();
}

async function loadChatHistory(sessionId) {
    if (!currentUser) return;

    try {
        const token = await currentUser.getIdToken();
        const data = await apiService.loadChatHistory(token, sessionId);

        if (data.messages && data.messages.length > 0) {
            data.messages.forEach(msg => {
                addMessage(msg.content, msg.role);
            });
        }
    } catch (err) {
        const message = err instanceof apiService.ApiError
            ? err.message
            : 'Failed to load chat history';
        console.error('Error loading chat history:', err);
        notificationService.error(message);
    }
}

async function deleteSession(sessionId) {
    if (!currentUser) return;
    if (!confirm("Delete this chat?")) return;

    try {
        const token = await currentUser.getIdToken();
        await apiService.deleteSession(token, sessionId);
        notificationService.success('Chat deleted');

        if (currentSessionId === sessionId) {
            currentSessionId = null;
            clearChat();
        }

        await loadSessions();
    } catch (err) {
        const message = err instanceof apiService.ApiError
            ? err.message
            : 'Failed to delete chat';
        notificationService.error(message);
    }
}

async function streamChat(prompt, element, signal) {
    if (!currentUser || !currentSessionId) {
        throw new Error('Not authenticated');
    }

    const token = await currentUser.getIdToken();
    let textBuffer = "";
    let queued = false;

    await apiService.streamChat(
        token,
        currentSessionId,
        prompt,
        (data) => {
            if (data.done || data.stopped) {
                return;
            }
            if (data.token) {
                textBuffer += data.token;
                if (!queued) {
                    queued = true;

                    requestAnimationFrame(() => {
                        element.innerHTML = md.render(textBuffer);
                        window.scrollTo(0, document.body.scrollHeight);
                        queued = false;
                    });
                }
            }
        },
        signal
    );
}

async function sendMessage() {
    if (!currentUser) {
        notificationService.error('Please log in first');
        return;
    }

    if (!currentSessionId) {
        notificationService.error('Please create or select a chat first');
        return;
    }

    const text = input.value.trim();
    if (!text) return;

    if (text.length > 2000) {
        notificationService.error('Message must be under 2000 characters');
        return;
    }

    addMessage(text, "user");
    input.value = "";

    const botMessage = addMessage("", "assistant");

    isGenerating = true;
    input.disabled = true;
    button.textContent = "stop";
    button.classList.add("stop-mode");
    abortController = new AbortController();

    try {
        await streamChat(text, botMessage, abortController.signal);
    } catch (err) {
        if (err.name === 'AbortError') {
            botMessage.textContent = '[Response stopped]';
        } else if (err instanceof apiService.ApiError) {
            botMessage.textContent = `Error: ${err.message}`;
            notificationService.error(`Chat failed: ${err.message}`);
        } else {
            botMessage.textContent = `Error: ${err.message}`;
            notificationService.error('Failed to send message');
        }
    } finally {
        isGenerating = false;
        input.disabled = false;
        button.textContent = "send";
        button.classList.remove("stop-mode");
        abortController = null;
    }
}

function updateBadge() {
    if (currentUser) {
        const displayName = currentUser.displayName || currentUser.email.split('@')[0];
        badgeText.textContent = `logged in as ${displayName}`;
        loginLink.textContent = 'Log Out';
    } else {
        badgeText.textContent = 'Not logged in';
        loginLink.textContent = 'Log In';
    }
}

function closeSidebar() {
    sidebar.classList.remove("open");
}

function toggleSidebar() {
    sidebar.classList.toggle("open");
}

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateBadge();

    if (user) {
        await loadSessions();
    } else {
        sessionsList.innerHTML = "";
        currentSessionId = null;
        clearChat();
    }
});

newChatBtn.addEventListener("click", async () => {
    try {
        const sessionId = await createSession();
        if (sessionId) {
            await openSession(sessionId);
        }
    } catch (err) {
        const message = err instanceof apiService.ApiError
            ? err.message
            : 'Failed to create chat';
        notificationService.error(message);
    }
});

loginLink.addEventListener('click', async (e) => {
    e.preventDefault();
    if (currentUser) {
        await signOut(auth);
    } else {
        window.location.href = './auth.html';
    }
});

sidebarToggle.addEventListener("click", toggleSidebar);
toggleSidebarBtn.addEventListener("click", closeSidebar);

button.addEventListener("click", () => {
    if (isGenerating && abortController) {
        abortController.abort();
    } else {
        sendMessage();
    }
});

input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !isGenerating) {
        sendMessage();
    }
});

notificationService.init();
