// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD8zReB4NvFBgd5WRmNS3aN0g4Z5InEsaE",
  authDomain: "editora-lt-65cd6.firebaseapp.com",
  projectId: "editora-lt-65cd6",
  storageBucket: "editora-lt-65cd6.firebasestorage.app",
  messagingSenderId: "1061643794269",
  appId: "1:1061643794269:web:e7a14060a3c9ec3b825ab4",
  measurementId: "G-KJ13TS306C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
