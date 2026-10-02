/** Pages consume words only when the reader advances, never during a resize. */
export class DialoguePages {
  constructor(message) {
    this.words = String(message ?? '').trim().split(/\s+/).filter(Boolean);
    this.cursor = 0; this.pageEnd = 0; this.text = '';
  }
  fit(fits = () => true) {
    if (this.done) { this.pageEnd = this.cursor; this.text = ''; return this.text; }
    let low = 1, high = this.words.length - this.cursor, count = 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const text = this.words.slice(this.cursor, this.cursor + middle).join(' ');
      if (fits(text)) { count = middle; low = middle + 1; } else high = middle - 1;
    }
    this.pageEnd = this.cursor + count;
    this.text = this.words.slice(this.cursor, this.pageEnd).join(' ');
    return this.text;
  }
  advance() { this.cursor = Math.max(this.cursor, this.pageEnd); this.pageEnd = this.cursor; this.text = ''; return !this.done; }
  get done() { return this.cursor >= this.words.length; }
  get hasNext() { return this.pageEnd < this.words.length; }
  get remaining() { return this.words.slice(this.cursor).join(' '); }
}

/** Important news remains queued until read; passive banter never displaces it. */
export class DialogueQueue {
  constructor() { this.current = null; this.pending = []; this.seen = new Set(); this.sequence = 0; }
  enqueue({ role, message, priority = 1, key = null, isRelevant = null }) {
    this.prune();
    if (!String(message ?? '').trim() || (key && this.seen.has(key)) || (isRelevant && !isRelevant())) return { accepted: false, interrupted: false };
    if (priority === 0 && (this.current || this.pending.length)) return { accepted: false, interrupted: false };
    const speech = { role, message, priority, key, isRelevant, sequence: this.sequence++, pages: new DialoguePages(message) };
    if (key) this.seen.add(key);
    const interrupted = !!this.current && priority > this.current.priority;
    if (!this.current) this.current = speech;
    else if (interrupted) {
      // Preserve the undismissed page and its consumed cursor on interruption.
      if (this.current.priority > 0) this.pending.push(this.current);
      this.current = speech;
    } else this.pending.push(speech);
    this.pending.sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
    return { accepted: true, interrupted, speech };
  }
  prune() {
    const relevant = speech => !speech.isRelevant || speech.isRelevant();
    this.pending = this.pending.filter(relevant);
    if (this.current && !relevant(this.current)) this.current = this.pending.shift() ?? null;
    return this.current;
  }
  advance() {
    if (!this.current) return null;
    this.current.pages.advance();
    if (this.current.pages.done) this.current = this.pending.shift() ?? null;
    return this.current;
  }
  get idle() { return !this.current && !this.pending.length; }
}
