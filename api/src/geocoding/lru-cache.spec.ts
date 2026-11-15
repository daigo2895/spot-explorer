import { LruCache } from './lru-cache.js';

describe('LruCache', () => {
  it('上限を超えたら、最も長く使われていないものから消す', () => {
    const cache = new LruCache<number>(2, 60_000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a'); // a を最近使ったことにする
    cache.set('c', 3);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('TTLを過ぎたものは返さない', () => {
    vi.useFakeTimers();
    const cache = new LruCache<string>(10, 1000);
    cache.set('a', 'x');
    vi.advanceTimersByTime(1001);
    expect(cache.get('a')).toBeUndefined();
    vi.useRealTimers();
  });

  it('null（住所なし）もキャッシュできる', () => {
    const cache = new LruCache<string | null>(10, 1000);
    cache.set('sea', null);
    expect(cache.get('sea')).toBeNull();
  });
});
