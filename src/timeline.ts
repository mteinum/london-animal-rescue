import type { Incident } from './types';
export const DAY = 86400000;
export class Timeline {
  start = 0;
  end = 0;
  cursor = 0;
  playing = false;
  speed = 1;
  active = false;
  recent = false;
  follow = false;
  reset(records: Incident[]): void {
    this.pause();
    this.start = records[0]?.clock ?? 0;
    this.end = records.at(-1)?.clock ?? 0;
    this.cursor = this.end;
    this.active = false;
  }
  play(): void {
    if (this.end <= this.start) return;
    if (this.cursor >= this.end) this.cursor = this.start;
    this.active = true;
    this.playing = true;
  }
  pause(): void {
    this.playing = false;
  }
  scrub(value: number): void {
    this.pause();
    this.active = true;
    this.cursor = Math.max(
      this.start,
      Math.min(this.end, Number.isFinite(value) ? value : this.start),
    );
  }
  tick(elapsed: number): boolean {
    if (!this.playing) return false;
    this.cursor = Math.min(
      this.end,
      this.cursor + ((Math.max(0, elapsed) * DAY * 30) / 1000) * this.speed,
    );
    if (this.cursor >= this.end) this.pause();
    return true;
  }
  visible(records: Incident[]): Incident[] {
    return !this.active ? records : records.filter((r) => r.clock <= this.cursor);
  }
  opacity(r: Incident): number {
    return this.active && this.recent && r.clock < this.cursor - 30 * DAY ? 0.17 : 1;
  }
}
