// Firebase configuration – bulletin board (read-only public)
const firebaseConfig = {
  apiKey: "AIzaSyDJk3o9KTrgpO5zb33oEBlmzDg_7YOZOIU",
  authDomain: "dictbulletin-30f00.firebaseapp.com",
  projectId: "dictbulletin-30f00",
  storageBucket: "dictbulletin-30f00.firebasestorage.app",
  messagingSenderId: "610920742264",
  appId: "1:610920742264:web:66a1f8a354f7c7e1229c8d",
  measurementId: "G-0LB8KEC0M5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
