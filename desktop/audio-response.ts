import { statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** File fetch supplies the bytes but omits HTTP size/range metadata needed by media elements. */
export async function audioResponse(
  filename: string,
  request: Request,
  fetchFile: (url: string, options: RequestInit) => Promise<Response>,
) {
  const size = statSync(filename).size,
    headers = new Headers({ 'Accept-Ranges': 'bytes' });
  if (!['GET', 'HEAD'].includes(request.method)) {
    headers.set('Allow', 'GET, HEAD');
    return new Response(null, { status: 405, headers });
  }

  let start = 0,
    end = size - 1,
    partial = false;
  const range = request.headers.get('range');
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2])) {
      if (match[1]) {
        start = Number(match[1]);
        end = match[2] ? Number(match[2]) : size - 1;
      } else {
        const suffix = Number(match[2]);
        start = Math.max(0, size - suffix);
      }
      partial =
        Number.isSafeInteger(start) &&
        Number.isSafeInteger(end) &&
        start >= 0 &&
        start < size &&
        end >= start;
    }
    if (!partial) {
      headers.set('Content-Range', 'bytes */' + size);
      headers.set('Content-Length', '0');
      return new Response(null, { status: 416, headers });
    }
    end = Math.min(end, size - 1);
    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
  }

  headers.set('Content-Length', String(Math.max(0, end - start + 1)));
  if (request.method === 'HEAD') {
    return new Response(null, { status: partial ? 206 : 200, headers });
  }

  const response = await fetchFile(pathToFileURL(filename).href, {
    method: 'GET',
    headers: partial ? { Range: `bytes=${start}-${end}` } : {},
  });
  if (!response.ok) {
    return response;
  }
  for (const [name, value] of response.headers) {
    if (!headers.has(name)) {
      headers.set(name, value);
    }
  }
  return new Response(response.body, { status: partial ? 206 : 200, headers });
}
