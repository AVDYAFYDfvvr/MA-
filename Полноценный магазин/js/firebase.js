import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCW04diM26GZKajAchRKN-A0Mu7b86tO_8",
    authDomain: "magazin-d478c.firebaseapp.com",
    projectId: "magazin-d478c",
    storageBucket: "magazin-d478c.firebasestorage.app",
    messagingSenderId: "579147801637",
    appId: "1:579147801637:web:71b5ae7777563fa5494bcc",
    measurementId: "G-2JP708LPHE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
export const timestamp = () => serverTimestamp();