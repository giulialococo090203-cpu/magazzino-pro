// ============================================================
// FIREBASECLIENT.JS - Firebase client app/auth/firestore
// ============================================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBDmq1YC4RdYja7SFBw_sJrr0-MP2stdmU',
  authDomain: 'magazzino-pro-d3c08.firebaseapp.com',
  projectId: 'magazzino-pro-d3c08',
  storageBucket: 'magazzino-pro-d3c08.firebasestorage.app',
  messagingSenderId: '577122205532',
  appId: '1:577122205532:web:523dc9429bdbccfeb64b99',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseDb = getFirestore(firebaseApp);