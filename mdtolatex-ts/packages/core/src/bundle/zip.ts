/**
 * A minimal ZIP writer.
 *
 * The converter has to run in a Next.js route, a browser tab and an Obsidian
 * plugin (desktop *and* mobile), so a bundler cannot rely on Node's `zlib` or on
 * a native dependency. This writes the archive by hand instead: a few hundred
 * bytes of header packing with no dependencies at all, which works identically
 * everywhere a `Uint8Array` does.
 *
 * Entries are **stored**, not deflated. Compressing would need either
 * `CompressionStream` (absent in older Electron and in Node before 18) or a
 * bundled DEFLATE implementation, and the payload is mostly PNG/JPEG/PDF data
 * that is already compressed. The cost is larger archives for SVG-heavy notes;
 * the benefit is one code path that cannot fail on a platform.
 */

/** A single file to place in the archive. */
export interface ZipEntry {
  /** Path inside the archive. Always uses `/`, never a leading slash. */
  path: string;
  data: Uint8Array;
  /** Modification time. Defaults to the `date` passed to {@link createZip}. */
  date?: Date;
}

export interface CreateZipOptions {
  /** Timestamp for entries that do not carry their own. Fix it for reproducible output. */
  date?: Date;
}

/** ZIP stores sizes and offsets as unsigned 32-bit fields. */
const MAX_UINT32 = 0xffffffff;

const LOCAL_HEADER_SIG = 0x04034b50;
const CENTRAL_HEADER_SIG = 0x02014b50;
const END_OF_CENTRAL_DIR_SIG = 0x06054b50;

/**
 * Bit 11 marks the filename as UTF-8. Without it, unzip tools fall back to
 * CP437 and mangle Hebrew and accented filenames — which is most of this
 * project's real input.
 */
const FLAG_UTF8 = 0x0800;
const METHOD_STORE = 0;
/** 2.0; what every tool expects for a plain stored entry. */
const VERSION = 20;

const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

/** CRC-32 (IEEE), the checksum every ZIP entry carries. */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = CRC_TABLE[(crc ^ data[index]) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Packs a date into the two 16-bit DOS fields ZIP inherited from MS-DOS.
 *
 * Seconds have 2-second resolution and the year is an offset from 1980, so
 * anything earlier is clamped rather than silently wrapping.
 */
function dosDateTime(date: Date): { time: number; dateValue: number } {
  const year = Math.max(1980, date.getFullYear());
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f);
  const dateValue = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, dateValue };
}

/** Normalizes a path to the form ZIP expects: forward slashes, no leading slash. */
function normalizeEntryPath(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) throw new Error('zip: an entry path cannot be empty');
  if (normalized.split('/').includes('..')) {
    // A `..` segment lets an archive write outside the folder it is extracted
    // into. Refuse rather than produce one.
    throw new Error(`zip: entry path "${path}" must not contain ".."`);
  }
  return normalized;
}

/**
 * Builds a ZIP archive from a list of files.
 *
 * Duplicate paths are rejected: some extractors take the first copy and some the
 * last, so an archive containing both is genuinely ambiguous.
 */
export function createZip(entries: ZipEntry[], options: CreateZipOptions = {}): Uint8Array {
  const defaultDate = options.date ?? new Date();
  const encoder = new TextEncoder();

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  const seen = new Set<string>();
  let offset = 0;

  for (const entry of entries) {
    const path = normalizeEntryPath(entry.path);
    if (seen.has(path)) throw new Error(`zip: duplicate entry "${path}"`);
    seen.add(path);

    const nameBytes = encoder.encode(path);
    const { data } = entry;
    if (data.length > MAX_UINT32) {
      // Anything this large needs the ZIP64 extensions, which this writer does
      // not implement. Fail loudly instead of emitting a corrupt archive.
      throw new Error(`zip: "${path}" is too large for a non-ZIP64 archive`);
    }

    const checksum = crc32(data);
    const { time, dateValue } = dosDateTime(entry.date ?? defaultDate);

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, LOCAL_HEADER_SIG, true);
    localView.setUint16(4, VERSION, true);
    localView.setUint16(6, FLAG_UTF8, true);
    localView.setUint16(8, METHOD_STORE, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, dateValue, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, data.length, true); // compressed == uncompressed
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true); // no extra field
    local.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, CENTRAL_HEADER_SIG, true);
    centralView.setUint16(4, VERSION, true);
    centralView.setUint16(6, VERSION, true);
    centralView.setUint16(8, FLAG_UTF8, true);
    centralView.setUint16(10, METHOD_STORE, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, dateValue, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true); // extra
    centralView.setUint16(32, 0, true); // comment
    centralView.setUint16(34, 0, true); // disk number
    centralView.setUint16(36, 0, true); // internal attributes
    // External attributes: 0644, in the high 16 bits where Unix permissions live.
    centralView.setUint32(38, 0o644 << 16, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    locals.push(local, data);
    centrals.push(central);
    offset += local.length + data.length;
  }

  const centralSize = centrals.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, END_OF_CENTRAL_DIR_SIG, true);
  endView.setUint16(4, 0, true); // this disk
  endView.setUint16(6, 0, true); // disk with the central directory
  endView.setUint16(8, centrals.length, true);
  endView.setUint16(10, centrals.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true); // no archive comment

  return concat([...locals, ...centrals, end]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let position = 0;
  for (const part of parts) {
    result.set(part, position);
    position += part.length;
  }
  return result;
}
