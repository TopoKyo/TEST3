import { auth, db } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  addDoc,
  onSnapshot
} from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const firestoreService = {
  async getAll<T>(collectionPath: string): Promise<T[]> {
    try {
      const snap = await getDocs(collection(db, collectionPath));
      return snap.docs.map(doc => doc.data() as T);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, collectionPath);
      return [];
    }
  },

  async getOne<T>(collectionPath: string, id: string): Promise<T | null> {
    try {
      const docRef = doc(db, collectionPath, id);
      const snap = await getDoc(docRef);
      return snap.exists() ? (snap.data() as T) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${collectionPath}/${id}`);
      return null;
    }
  },

  async add<T extends { id: string }>(collectionPath: string, data: T): Promise<T> {
    try {
      await setDoc(doc(db, collectionPath, data.id), data);
      return data;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, collectionPath);
      throw error;
    }
  },

  async update<T extends { id: string }>(collectionPath: string, id: string, data: Partial<T>): Promise<void> {
    try {
      const docRef = doc(db, collectionPath, id);
      await updateDoc(docRef, data as any);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${collectionPath}/${id}`);
      throw error;
    }
  },

  async delete(collectionPath: string, id: string): Promise<void> {
    try {
      await deleteDoc(doc(db, collectionPath, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${collectionPath}/${id}`);
      throw error;
    }
  }
};
