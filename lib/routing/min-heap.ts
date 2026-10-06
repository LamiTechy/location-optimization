/**
 * Binary min-heap priority queue.
 *
 * Used by Dijkstra's algorithm to always expand the closest unsettled node in
 * O(log n). A hand-written implementation keeps the algorithm easy to explain
 * in a project defence and avoids external dependencies.
 */
export class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(value: T): void {
    this.items.push(value);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(startIndex: number): void {
    let index = startIndex;
    const value = this.items[index];
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(value, this.items[parent]) >= 0) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = value;
  }

  private sinkDown(startIndex: number): void {
    let index = startIndex;
    const value = this.items[index];
    const length = this.items.length;

    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;

      if (left < length && this.compare(this.items[left], this.items[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compare(this.items[right], this.items[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === index) break;

      this.items[index] = this.items[smallest];
      index = smallest;
    }
    this.items[index] = value;
  }
}
