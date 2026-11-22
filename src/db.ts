import { openDB } from "idb";
const dbPromise = openDB("mareh-natural-studio", 1, {
  upgrade(db) {
    for (const name of ["sessions","cases","rules"]) {
      if (!db.objectStoreNames.contains(name)) db.createObjectStore(name,{keyPath:"id"});
    }
  }
});
export async function all<T>(store:string):Promise<T[]> { return (await dbPromise).getAll(store); }
export async function put(store:string,value:unknown) { return (await dbPromise).put(store,value); }
export async function remove(store:string,key:string) { return (await dbPromise).delete(store,key); }
