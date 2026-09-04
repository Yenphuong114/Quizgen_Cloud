import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Thay thế đoạn config bên dưới bằng mã của bạn từ Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyC91CwfskpC_Tht4P0ibBNisXjk8Xazl0s",
  authDomain: "quizgencloud.firebaseapp.com",
  projectId: "quizgencloud",
  storageBucket: "quizgencloud.firebasestorage.app",
  messagingSenderId: "971177667287",
  appId: "1:971177667287:web:577fc061224b394f3f1e92",
  measurementId: "G-GDPKLZ0DY8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();