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

    output.textContent = "Signed up:\n" + JSON.stringify(result.user, null, 2);

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

    output.textContent = "Logged in:\n" + result.user.email;

  } catch (err) {
    output.textContent = err.message;
  }
});
document.getElementById("googleBtn").addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();

    const result = await signInWithPopup(auth, provider);

    output.textContent = "Google login:\n" + result.user.email;

  } catch (err) {
    output.textContent = err.message;
  }
});

document.getElementById("logoutBtn").addEventListener('click', async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    output.textContent = "Currently logged in:\n" + user.email;
  } else {
    output.textContent = "Logged out";
  }
});