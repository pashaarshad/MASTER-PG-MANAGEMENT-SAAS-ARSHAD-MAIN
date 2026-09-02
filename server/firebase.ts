import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirestore } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

console.log('Firebase Config:', firebaseConfig);

const app = initializeApp(firebaseConfig);
export const storage = getStorage(app);
export const db = getFirestore(app);

export async function uploadBase64ToStorage(base64String: string, path: string): Promise<string> {
  if (!base64String || !base64String.startsWith('data:')) {
    return base64String; // Already a URL or empty
  }
  const storageRef = ref(storage, path);
  await uploadString(storageRef, base64String, 'data_url');
  const downloadUrl = await getDownloadURL(storageRef);
  return downloadUrl;
}

export async function deleteFromStorage(fileUrl: string): Promise<void> {
  if (!fileUrl || !fileUrl.includes('firebasestorage.googleapis.com')) return;
  try {
    const storageRef = ref(storage, fileUrl);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file from Firebase Storage:', error);
  }
}