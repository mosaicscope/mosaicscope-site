/**
 * Uniform-grid broad phase. Items are dense integer indices with positions supplied at insert time.
 * Rebuilt each tick with `clear` + `insert` (O(n), zero allocation). Queries write into a caller-owned
 * array so hot loops never allocate.
 */
export class SpatialHash {
  readonly cellSize: number;
  readonly cols: number;
  readonly rows: number;
  private head: Int32Array;
  private next: Int32Array;
  private xs: Float32Array;
  private ys: Float32Array;
  private capacity: number;
  private sparse=new Map<string,number>();
  count = 0;
  /** Metrics (reset by the owner each frame). */
  queries = 0;
  candidatesVisited = 0;

  constructor(worldW: number, worldH: number, cellSize = 2, capacity = 1024,private unbounded=false) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(worldW / cellSize) + 1;
    this.rows = Math.ceil(worldH / cellSize) + 1;
    this.head = new Int32Array(unbounded?0:this.cols * this.rows).fill(-1);
    this.capacity = capacity;
    this.next = new Int32Array(capacity);
    this.xs = new Float32Array(capacity);
    this.ys = new Float32Array(capacity);
  }

  clear(): void { if(this.unbounded)this.sparse.clear();else this.head.fill(-1); this.count = 0; }

  private cellOf(x: number, y: number): number {
    let cx = Math.floor(x / this.cellSize), cy = Math.floor(y / this.cellSize);
    if (cx < 0) cx = 0; else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0; else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  insert(id: number, x: number, y: number): void {
    if (id >= this.capacity) this.grow(id + 1);
    if(this.unbounded){const key=Math.floor(x/this.cellSize)+','+Math.floor(y/this.cellSize);this.xs[id]=x;this.ys[id]=y;this.next[id]=this.sparse.get(key)??-1;this.sparse.set(key,id);this.count++;return;}
    const c = this.cellOf(x, y);
    this.xs[id] = x; this.ys[id] = y;
    this.next[id] = this.head[c];
    this.head[c] = id;
    this.count++;
  }

  private grow(min: number): void {
    let cap = this.capacity * 2;
    while (cap < min) cap *= 2;
    const n = new Int32Array(cap); n.set(this.next); this.next = n;
    const xs = new Float32Array(cap); xs.set(this.xs); this.xs = xs;
    const ys = new Float32Array(cap); ys.set(this.ys); this.ys = ys;
    this.capacity = cap;
  }

  /** Writes ids within radius r of (x, y) into out; returns the count. */
  query(x: number, y: number, r: number, out: number[]): number {
    this.queries++;
    out.length = 0;
    const cs = this.cellSize, r2 = r * r;
    if(this.unbounded){for(let cy=Math.floor((y-r)/cs);cy<=Math.floor((y+r)/cs);cy++)for(let cx=Math.floor((x-r)/cs);cx<=Math.floor((x+r)/cs);cx++){let id=this.sparse.get(cx+','+cy)??-1;while(id!==-1){this.candidatesVisited++;const dx=this.xs[id]-x,dy=this.ys[id]-y;if(dx*dx+dy*dy<=r2)out.push(id);id=this.next[id];}}return out.length;}
    const x0 = Math.max(0, Math.floor((x - r) / cs)), x1 = Math.min(this.cols - 1, Math.floor((x + r) / cs));
    const y0 = Math.max(0, Math.floor((y - r) / cs)), y1 = Math.min(this.rows - 1, Math.floor((y + r) / cs));
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        let id = this.head[cy * this.cols + cx];
        while (id !== -1) {
          this.candidatesVisited++;
          const dx = this.xs[id] - x, dy = this.ys[id] - y;
          if (dx * dx + dy * dy <= r2) out.push(id);
          id = this.next[id];
        }
      }
    }
    return out.length;
  }

  /** Visit every occupied cell (debug drawing). */
  forEachCell(fn: (cx: number, cy: number, n: number) => void): void {
    if(this.unbounded){for(const [key,start]of this.sparse){let n=0,id=start;while(id!==-1){n++;id=this.next[id];}const [x,y]=key.split(',').map(Number);fn(x,y,n);}return;}
    for (let c = 0; c < this.head.length; c++) {
      let n = 0, id = this.head[c];
      while (id !== -1) { n++; id = this.next[id]; }
      if (n) fn(c % this.cols, Math.floor(c / this.cols), n);
    }
  }
}
