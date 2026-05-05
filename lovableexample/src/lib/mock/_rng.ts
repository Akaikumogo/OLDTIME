// Tiny seeded PRNG for stable mock data
let seed = 1337;
export function rand() {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}
export function int(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
export function chance(p: number) {
  return rand() < p;
}
export function resetSeed(s = 1337) {
  seed = s;
}
export function uid(prefix: string, n: number) {
  return `${prefix}_${String(n).padStart(4, "0")}`;
}
