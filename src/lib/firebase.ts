import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

/**
 * A safe version of JSON.stringify that aggressively prunes circular references
 * and complex internal SDK objects that might leak during serialization.
 */
function safeStringify(obj: any): string {
  const cache = new WeakSet();
  
  // Create a deep copy using the replacer to catch circulars and prune services
  const replacer = (key: string, value: any) => {
    // 1. Handle circular references immediately using WeakSet
    if (typeof value === 'object' && value !== null) {
      if (cache.has(value)) {
        return '[Circular Reference Pruned]';
      }
      cache.add(value);
    }

    // 2. Identify and prune internal service instances by key or constructor name
    // These keys are common in minified Firestore/Firebase SDKs (e.g., Y2, Ka)
    if (key === '_db' || key === 'firestore' || key === 'auth' || key === 'app' || key === '_delegate') {
      return '[Internal Service Instance Pruned]';
    }

    // 3. Heuristic: If constructor name looks minified or is a service class
    if (value?.constructor?.name) {
      const ctor = value.constructor.name;
      if (['Firestore', 'Auth', 'FirebaseApp', 'Y2', 'Ka', 'Ia'].includes(ctor) || ctor.length <= 2) {
         // Aggressively prune anything that looks like a minified SDK internal
         return `[SDK Object: ${ctor}]`;
      }
    }

    return value;
  };

  try {
    return JSON.stringify(obj, replacer);
  } catch (err) {
    // Ultimate fallback if even the replacer logic fails
    return '{"error":"CRITICAL_SERIALIZATION_FAILURE"}';
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  // Capture the error message as a primitive string immediately.
  // We MUST NOT pass the raw error object around after this point to avoid circular ref leaks.
  const rawErrorMessage = error instanceof Error ? error.message : String(error);
  const cleanPath = path ? String(path) : 'unknown_path';

  const user = auth.currentUser;
  const authInfo = user ? {
    userId: String(user.uid),
    email: user.email ? String(user.email) : undefined,
    emailVerified: Boolean(user.emailVerified),
    isAnonymous: Boolean(user.isAnonymous)
  } : { userId: 'unauthenticated' };

  // Construct a completely flat diagnostic object
  const diagnostic = {
    error: String(rawErrorMessage),
    operationType: String(operationType),
    path: cleanPath,
    timestamp: new Date().toISOString(),
    authInfo
  };

  const serializedDetail = safeStringify(diagnostic);
  
  // Use isolated logging to prevent environment interception of the raw error
  console.error(`[FIRESTORE_DATA_FAULT] ${serializedDetail}`);
  
  // Throw a standard Error with the stringified context
  const fault = new Error(serializedDetail);
  fault.name = 'FirestoreDataFault';
  throw fault;
}
