import * as firebase from 'firebase/app';
import 'firebase/auth';
import { FIREBASE_DATABASE_URL, FIREBASE_PROJECT_ID } from './config/firebase';

const firebaseApiKey = process.env.REACT_APP_FIREBASE_API_KEY;

const app = firebase.initializeApp({
    apiKey: firebaseApiKey,
    authDomain: `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
    databaseURL: FIREBASE_DATABASE_URL,
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: `${FIREBASE_PROJECT_ID}.appspot.com`,
    messagingSenderId: '745183747844',
    appId: '1:745183747844:web:98e0e61d35478301f2ba51',
    measurementId: 'G-M391LLZTB1'
});

export default app;
