export type CollectedSseEvent = {
  event: string;
  data: unknown;
};

export function collectSseChunks(chunks: Iterable<string>): CollectedSseEvent[] {
  const events: CollectedSseEvent[] = [];
  let buffer = '';

  for (const chunk of chunks) {
    buffer += chunk.replace(/\r\n/g, '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseSseFrame(frame);
      if (parsed) {
        events.push(parsed);
      }
      boundary = buffer.indexOf('\n\n');
    }
  }

  const tail = parseSseFrame(buffer.trim());
  if (tail) {
    events.push(tail);
  }
  return events;
}

function parseSseFrame(frame: string): CollectedSseEvent | null {
  if (!frame) {
    return null;
  }
  let event = 'message';
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data.push(line.slice(5).trimStart());
    }
  }
  if (data.length === 0) {
    return null;
  }
  const raw = data.join('\n');
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return { event, data: raw };
  }
}
