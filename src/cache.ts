
export class LRUCache<T extends any = any> {

  private maxSize: number;
  private cache: Map<string, T>;
  private keys: string[];

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.keys = [];
  }

  get<V extends T = T>(key: string): V {
    const value = this.cache.get(key);

    // Put the key at the front of the list (most recently used)
    if (value) {
      this.keys = this.keys.filter(k => k !== key);
      this.keys.unshift(key);
    }

    // @ts-ignore
    return value;
  }
  set(key: string, value: T) {
    // If the cache is full, remove the least recently used key
    if (this.cache.size >= this.maxSize) {
      const lastKey = this.keys.pop();
      this.cache.delete(lastKey!);
    }

    this.cache.set(key, value);
    this.keys.unshift(key);
  }

  delete(key: string) {
    this.cache.delete(key);
    this.keys = this.keys.filter(k => k !== key);
  }
}
