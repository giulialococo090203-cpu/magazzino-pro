// ============================================================
// FIREBASECLIENT.JS - Firebase client app/auth/firestore
// ============================================================

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

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

/*
 * Firestore serve solo al login (lettura del profilo) ed e' una libreria
 * pesante: la carichiamo solo in quel momento invece che all'apertura.
 */
let firestorePromise = null;

export function caricaFirestore() {
  if (!firestorePromise) {
    firestorePromise = import('firebase/firestore')
      .then((modulo) => ({
        db: modulo.getFirestore(firebaseApp),
        doc: modulo.doc,
        getDoc: modulo.getDoc,
      }))
      .catch((errore) => {
        firestorePromise = null;
        throw errore;
      });
  }

  return firestorePromise;
}