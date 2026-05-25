import { app } from "./firebase_conf.js";
import { apiService } from "./adminApiService.js";
import { notificationService } from "./notificationService.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const auth = getAuth(app);
const chatBox = document.getElementById("chatBox");
const badge = document.getElementById("authBadge");
const badgeText = document.getElementById("badgeText");
const loginLink = document.getElementById("loginLink");
const sidebar = document.getElementById("sidebar");
const sessionsList = document.getElementById("sessionsList");
const usersList = document.getElementById("usersList");
const sidebarToggle = document.getElementById("sidebarToggle");
const toggleSidebarBtn = document.getElementById("toggleSidebar");

let currentUser = null;

let selectedUser = null;
let currentSessionId = null;

function addMessage(text, sender) {
    const message = document.createElement("div");
    message.classList.add("message", sender);
    message.textContent = text;
    chatBox.appendChild(message);
    window.scrollTo(0, document.body.scrollHeight);
    return message;
}
function clearChat() {
    chatBox.innerHTML = "";
}

async function loadUsers() {
    if (!currentUser) return;

    try {
        const token = await currentUser.getIdToken();
        const data = await apiService.getUsers(token);

        usersList.innerHTML = "";
        if (data.users && data.users.length > 0) {
            data.users.forEach(user => {
                const item = document.createElement("div");
                item.className = "session-item";
                if (user.uid === selectedUser) item.classList.add("active");

                const nameSpan = document.createElement("span");
                nameSpan.className = "session-name";
                nameSpan.textContent = user.email;

                item.appendChild(nameSpan);
                item.addEventListener("click", () => openUser(user.uid));

                usersList.appendChild(item);
            });
        }
    } catch (err) {
        const message = err instanceof apiService.ApiError
            ? err.message
            : 'Failed to load users';
        console.error('Error loading users:', err);
        if (err.status !== 0) {
            notificationService.error(message);
        }
    }
}

async function loadSessions() {
    if (!currentUser || !selectedUser) return;

    try {
        const token = await currentUser.getIdToken();
        const data = await apiService.loadSessions(token,selectedUser);

        sessionsList.innerHTML = "";
        if (data.sessions && data.sessions.length > 0) {
            data.sessions.forEach(session => {
                const item = document.createElement("div");
                item.className = "session-item";
                if (session.id === currentSessionId) item.classList.add("active");

                const nameSpan = document.createElement("span");
                nameSpan.className = "session-name";
                nameSpan.textContent = session.name;

                item.appendChild(nameSpan);
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
    await loadChatHistory(sessionId);
    await loadSessions();
}

async function openUser(firebase_uid) {
    selectedUser = firebase_uid;
    clearChat();
    await loadSessions();
    await loadUsers();
}

async function loadChatHistory(sessionId) {
    if (!currentUser || !selectedUser) return;

    try {
        const token = await currentUser.getIdToken();
        const data = await apiService.loadChatHistory(token, sessionId, selectedUser);

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

sidebarToggle.addEventListener("click", toggleSidebar);
toggleSidebarBtn.addEventListener("click", closeSidebar);

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    updateBadge();

    if (user) {
        await loadUsers();
    } else {
        sessionsList.innerHTML = "";
        usersList.innerHTML = "";
        currentSessionId = null;
        selectedUser = null;
        clearChat();
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
notificationService.init();
