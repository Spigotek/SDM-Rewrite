export interface PageParams {
  readonly start: number;
  readonly size: number;
}

export interface Paginated<T> {
  readonly results: readonly T[];
  readonly totalCount: number;
  readonly start: number;
  readonly size: number;
}

const DEFAULT_SIZE = 25;
const MAX_SIZE = 200;

export function readPageParams(url: URL): PageParams {
  const startRaw = Number(url.searchParams.get("start") ?? "0");
  const sizeRaw = Number(url.searchParams.get("size") ?? String(DEFAULT_SIZE));
  const start = Number.isFinite(startRaw) && startRaw >= 0 ? Math.floor(startRaw) : 0;
  const sizeBounded = Number.isFinite(sizeRaw) && sizeRaw > 0 ? Math.floor(sizeRaw) : DEFAULT_SIZE;
  const size = Math.min(sizeBounded, MAX_SIZE);
  return { start, size };
}

export function paginate<T>(records: readonly T[], params: PageParams): Paginated<T> {
  const { start, size } = params;
  return {
    results: records.slice(start, start + size),
    totalCount: records.length,
    start,
    size,
  };
}
