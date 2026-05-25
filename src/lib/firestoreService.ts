import { auth, db } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  getDocsFromCache,
  getDocFromCache,
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

function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)) as any;
  }
  if (typeof obj === 'object') {
    const proto = Object.getPrototypeOf(obj);
    if (proto !== null && proto !== Object.prototype) {
      return obj;
    }
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        cleaned[key] = cleanUndefined(val);
      }
    }
    return cleaned;
  }
  return obj;
}

export const firestoreService = {
  async getAll<T>(collectionPath: string, retries = 3): Promise<T[]> {
    try {
      const snap = await getDocs(collection(db, collectionPath));
      return snap.docs.map(doc => doc.data() as T);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('offline') || error.message.includes('network'))) {
        // Fallback to cache since we are offline
        try {
          const cacheSnap = await getDocsFromCache(collection(db, collectionPath));
          if (!cacheSnap.empty) {
            console.log(`[Firestore] Returning ${cacheSnap.size} items from cache for ${collectionPath}`);
            return cacheSnap.docs.map(doc => doc.data() as T);
          }
        } catch (cacheError) {
          console.error("[Firestore] Cache read failed:", cacheError);
        }

        if (retries > 0) {
          console.warn(`[Firestore] getAll failed (offline), retrying... (${retries} left)`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          return firestoreService.getAll<T>(collectionPath, retries - 1);
        }
      }
      handleFirestoreError(error, OperationType.LIST, collectionPath);
      return [];
    }
  },

  async getOne<T>(collectionPath: string, id: string, retries = 3): Promise<T | null> {
    try {
      const docRef = doc(db, collectionPath, id);
      const snap = await getDoc(docRef);
      return snap.exists() ? (snap.data() as T) : null;
    } catch (error) {
      if (error instanceof Error && (error.message.includes('offline') || error.message.includes('network'))) {
        // Fallback to cache
        try {
          const cacheSnap = await getDocFromCache(doc(db, collectionPath, id));
          if (cacheSnap.exists()) {
            console.log(`[Firestore] Returning item from cache for ${collectionPath}/${id}`);
            return cacheSnap.data() as T;
          }
        } catch (cacheError) {
          console.error("[Firestore] Cache read failed:", cacheError);
        }

        if (retries > 0) {
          console.warn(`[Firestore] getOne failed (offline), retrying... (${retries} left)`);
          await new Promise(resolve => setTimeout(resolve, 1500));
          return firestoreService.getOne<T>(collectionPath, id, retries - 1);
        }
      }
      handleFirestoreError(error, OperationType.GET, `${collectionPath}/${id}`);
      return null;
    }
  },

  async add<T extends { id: string }>(collectionPath: string, data: T): Promise<T> {
    try {
      const cleaned = cleanUndefined(data);
      await setDoc(doc(db, collectionPath, cleaned.id), cleaned);
      return cleaned;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, collectionPath);
      throw error;
    }
  },

  async update<T extends { id: string }>(collectionPath: string, id: string, data: Partial<T>): Promise<void> {
    try {
      const cleaned = cleanUndefined(data);
      const docRef = doc(db, collectionPath, id);
      await updateDoc(docRef, cleaned as any);
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
  },

  async getProjectContext(): Promise<any | null> {
    const context = await firestoreService.getOne<any>('settings', 'projectContext');
    return context;
  },

  async saveProjectContext(data: any): Promise<void> {
    await this.add('settings', { ...data, id: 'projectContext', updatedAt: new Date().toISOString() });
  }
};
