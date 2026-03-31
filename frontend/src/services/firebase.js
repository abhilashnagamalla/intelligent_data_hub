import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDc80pcUJ4slydVZjGQPQkv4qV-tRCFlMo",
  authDomain: "intelligent-data-hub-db66a.firebaseapp.com",
  projectId: "intelligent-data-hub-db66a",
  storageBucket: "intelligent-data-hub-db66a.firebasestorage.app",
  messagingSenderId: "585948713062",
  appId: "1:585948713062:web:9e2dd1d2b98b39cd64dda7"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
