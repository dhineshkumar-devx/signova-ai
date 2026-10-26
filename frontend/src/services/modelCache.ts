/**
 * ModelCacheManager: Client-Side Persistent Cache for 3D Rig Assets & ISL Sign Library
 * 
 * Uses browser IndexedDB with localStorage fallback to cache 3D keyframe definitions
 * and catalog metadata locally. Provides instant sub-second startup on subsequent loads.
 */

const DB_NAME = 'signova_ai_model_cache';
const DB_VERSION = 1;
const STORE_NAME = 'avatar_models';

export interface CachedModelData {
  id: string;
  timestamp: number;
  catalog: any;
  keyframes: Record<string, any>;
  version: string;
}

class ModelCacheManager {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event: any) => {
        resolve(event.target.result);
      };

      request.onerror = (event: any) => {
        console.warn('IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Check if the model & sign library is already stored in client cache
   */
  public async isCached(modelId: string = 'isl_avatar_catalog_v1'): Promise<boolean> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.get(modelId);
        req.onsuccess = () => {
          resolve(!!req.result);
        };
        req.onerror = () => {
          resolve(false);
        };
      });
    } catch {
      // Fallback check
      return !!localStorage.getItem(`signova_${modelId}`);
    }
  }

  /**
   * Save model data to local IndexedDB with animated percentage progress callback
   */
  public async cacheModel(
    modelId: string = 'isl_avatar_catalog_v1',
    catalog: any,
    keyframes: Record<string, any>,
    onProgress?: (progress: number, statusText: string) => void
  ): Promise<void> {
    const totalSteps = 10;
    for (let step = 1; step <= totalSteps; step++) {
      await new Promise((r) => setTimeout(r, 80));
      const pct = (step / totalSteps) * 100;
      if (onProgress) {
        const text = step < 6 ? 'Saving model weights & 3D bone hierarchy...' : 'Caching sign gesture keyframes...';
        onProgress(pct, text);
      }
    }

    const payload: CachedModelData = {
      id: modelId,
      timestamp: Date.now(),
      catalog,
      keyframes,
      version: '1.0.0',
    };

    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.put(payload);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IndexedDB write failed, falling back to localStorage cache:', err);
      try {
        localStorage.setItem(`signova_${modelId}`, JSON.stringify(payload));
      } catch (lsErr) {
        console.warn('localStorage write failed:', lsErr);
      }
    }

    if (onProgress) {
      onProgress(100.0, 'Almost ready to translate...');
    }
  }

  /**
   * Retrieve cached data if present
   */
  public async getCachedModel(modelId: string = 'isl_avatar_catalog_v1'): Promise<CachedModelData | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const req = store.get(modelId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      const raw = localStorage.getItem(`signova_${modelId}`);
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}

export const modelCache = new ModelCacheManager();
