import { db } from './firebase.js';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

function matchQuery(item: any, q: any): boolean {
  if (!q) return true;
  for (const k of Object.keys(q)) {
    if (k.includes('.')) {
      const parts = k.split('.');
      if (Array.isArray(item[parts[0]])) {
        const found = item[parts[0]].some((x: any) => x[parts[1]] === q[k]);
        if (!found) return false;
      } else {
        if (item[parts[0]]?.[parts[1]] !== q[k]) return false;
      }
    } else if (q[k] && typeof q[k] === 'object' && '$regex' in q[k]) {
      if (!new RegExp(q[k].$regex, q[k].$options || 'i').test(item[k])) return false;
    } else {
      if (item[k] !== q[k]) return false;
    }
  }
  return true;
}

class QueryChain {
  private sorts: any = {};
  private lim?: number;
  constructor(private executor: () => Promise<any>) {}
  lean() { return this; }
  sort(s: any) { this.sorts = s; return this; }
  select(s: string) { return this; }
  limit(n: number) { this.lim = n; return this; }
  
  then(resolve: any, reject: any) {
    return this.executor()
      .then((data: any) => {
        if (Array.isArray(data)) {
          if (Object.keys(this.sorts).length > 0) {
            const key = Object.keys(this.sorts)[0];
            const order = this.sorts[key] === -1 ? -1 : 1;
            data.sort((a, b) => {
              if (a[key] < b[key]) return -1 * order;
              if (a[key] > b[key]) return 1 * order;
              return 0;
            });
          }
          if (this.lim) {
            data = data.slice(0, this.lim);
          }
        }
        return data;
      })
      .then(resolve, reject);
  }
}

function sanitizeData(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) {
    return obj.map(sanitizeData);
  }
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      res[key] = val === undefined ? null : sanitizeData(val);
    }
    return res;
  }
  return obj;
}

export class FirebaseModel {
  private col: any;
  constructor(public collectionName: string) {
    this.col = collection(db, collectionName);
  }

  find(q?: any) {
    return new QueryChain(async () => {
      const qs = await getDocs(this.col);
      let data = qs.docs.map(d => d.data());
      if (q && Object.keys(q).length > 0) {
        data = data.filter(item => matchQuery(item, q));
      }
      return data;
    });
  }

  findOne(q?: any) {
    return new QueryChain(async () => {
      const qs = await getDocs(this.col);
      let data = qs.docs.map(d => d.data());
      if (q && Object.keys(q).length > 0) {
        data = data.filter(item => matchQuery(item, q));
      }
      return data.length > 0 ? data[0] : null;
    });
  }

  async create(data: any) {
    const sanitized = sanitizeData(data);
    if (Array.isArray(sanitized)) {
      const results = [];
      for (const item of sanitized) {
        const id = item.id || `gen_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        item.id = id;
        const docRef = doc(db, this.collectionName, id);
        await setDoc(docRef, item);
        results.push(item);
      }
      return results;
    } else {
      const id = sanitized.id || `gen_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      sanitized.id = id;
      const docRef = doc(db, this.collectionName, id);
      await setDoc(docRef, sanitized);
      return sanitized;
    }
  }

  async deleteMany(q?: any) {
    const qs = await getDocs(this.col);
    const docs = qs.docs.map(d => ({ id: d.id, data: d.data() }));
    const toDelete = !q || Object.keys(q).length === 0
      ? docs  // empty query = delete all
      : docs.filter(item => matchQuery(item.data, q));
    for (const d of toDelete) {
      await deleteDoc(doc(db, this.collectionName, d.id));
    }
    return { deletedCount: toDelete.length };
  }

  async deleteOne(q: any) {
    const qs = await getDocs(this.col);
    const docs = qs.docs.map(d => ({ id: d.id, data: d.data() }));
    const toDelete = docs.find(item => matchQuery(item.data, q));
    if (toDelete) {
      await deleteDoc(doc(db, this.collectionName, toDelete.id));
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async updateOne(q: any, update: any) {
    const qs = await getDocs(this.col);
    const docs = qs.docs.map(d => ({ id: d.id, data: d.data() }));
    const toUpdate = docs.find(item => matchQuery(item.data, q));
    if (toUpdate) {
      const docRef = doc(db, this.collectionName, toUpdate.id);
      // Mongoose updateOne often uses $set. If it does, extract it.
      let updateData = update;
      if (update.$set) updateData = update.$set;
      
      const sanitizedUpdate = sanitizeData(updateData);
      await setDoc(docRef, sanitizeData({ ...(toUpdate.data as any), ...sanitizedUpdate }), { merge: true });
      return { modifiedCount: 1 };
    }
    return { modifiedCount: 0 };
  }

  async findOneAndUpdate(q: any, update: any, options?: any) {
    const qs = await getDocs(this.col);
    const docs = qs.docs.map(d => ({ id: d.id, data: d.data() }));
    const toUpdate = docs.find(item => matchQuery(item.data, q));
    if (toUpdate) {
      const docRef = doc(db, this.collectionName, toUpdate.id);
      let updateData = update;
      if (update.$set) updateData = update.$set;
      const sanitizedUpdate = sanitizeData(updateData);
      const newData = sanitizeData({ ...(toUpdate.data as any), ...sanitizedUpdate });
      await setDoc(docRef, newData, { merge: true });
      return newData;
    }
    return null;
  }

  async exists(q: any) {
    const qs = await getDocs(this.col);
    const docs = qs.docs.map(d => d.data());
    return docs.some(item => matchQuery(item, q));
  }

  async countDocuments(q?: any) {
    const qs = await getDocs(this.col);
    let data = qs.docs.map(d => d.data());
    if (q && Object.keys(q).length > 0) {
      data = data.filter(item => matchQuery(item, q));
    }
    return data.length;
  }

  async updateMany(q: any, update: any) {
    const qs = await getDocs(this.col);
    const docs = qs.docs.map(d => ({ id: d.id, data: d.data() }));
    const toUpdate = !q || Object.keys(q).length === 0
      ? docs
      : docs.filter(item => matchQuery(item.data, q));
    for (const d of toUpdate) {
      const docRef = doc(db, this.collectionName, d.id);
      let updateData = update;
      if (update.$set) updateData = update.$set;
      const sanitizedUpdate = sanitizeData(updateData);
      await setDoc(docRef, sanitizeData({ ...(d.data as any), ...sanitizedUpdate }), { merge: true });
    }
    return { modifiedCount: toUpdate.length };
  }
}

export const SettingModel = new FirebaseModel('settings');
export const BuildingModel = new FirebaseModel('buildings');
export const FloorModel = new FirebaseModel('floors');
export const RoomModel = new FirebaseModel('rooms');
export const ApplicationModel = new FirebaseModel('applications');
export const ResidentModel = new FirebaseModel('residents');
export const PaymentModel = new FirebaseModel('payments');
export const RuleModel = new FirebaseModel('rules');
export const NotificationModel = new FirebaseModel('notifications');
export const AuditLogModel = new FirebaseModel('auditlogs');
export const InvitationModel = new FirebaseModel('invitations');
export const StorageFileModel = new FirebaseModel('storagefiles');
export const ExpenseModel = new FirebaseModel('expenses');
