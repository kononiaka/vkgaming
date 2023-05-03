import * as firebase from 'firebase/app';
import 'firebase/auth';

const app = firebase.initializeApp({
    apiKey: "AIzaSyD0B7Cgft2m58MjUWhIzjykJwkvnXN1O2k",
    authDomain: "test-prod-app-81915.firebaseapp.com",
    databaseURL: "https://test-prod-app-81915-default-rtdb.firebaseio.com",
    projectId: "test-prod-app-81915",
    storageBucket: "test-prod-app-81915.appspot.com",
    messagingSenderId: "745183747844",
    appId: "1:745183747844:web:98e0e61d35478301f2ba51",
    measurementId: "G-M391LLZTB1"
});

export default app;