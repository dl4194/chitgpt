import { app } from "./firebase_conf.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const auth = getAuth(app);

const output = document.getElementById("output");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

document.getElementById("signupBtn").addEventListener('click', async () => {
  try {
    const result = await createUserWithEmailAndPassword(
      auth,
      emailInput.value,
      passwordInput.value
    );
  } catch (err) {
    output.textContent = err.message;
  }
});

document.getElementById("loginBtn").addEventListener('click',async () => {
  try {
    const result = await signInWithEmailAndPassword(
      auth,
      emailInput.value,
      passwordInput.value
    );
  } catch (err) {
    output.textContent = err.message;
  }
});
document.getElementById("googleBtn").addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
  } catch (err) {
    output.textContent = err.message;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    location.href = './index.html';
  }
});