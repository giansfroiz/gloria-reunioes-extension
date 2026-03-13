import { SUPABASE_ANON_KEY, FUNCTION_URL, CHUNK_INTERVAL_MS } from './config.js';

let session = null;

// ============================================================
// Mensagens recebidas do popup
// ============================================================
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'START') {
    startSession(msg.tabId, msg.title, msg.platform, msg.meetingUrl)
      .then(meetingId => sendResponse({ ok: true, meetingId }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'STOP') {
    stopSession()
      .then(data => sendResponse({ ok: true, data }))
      .catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg.type === 'STATUS') {
    sendResponse({ active: !!session, meetingId: session?.meetingId || null });
    return false;
  }
});

// ============================================================
// Iniciar gravacao
// ============================================================
async function startSession(tabId, title, platform, meetingUrl) {
  if (session) throw new Error('Ja existe uma transcricao em andamento.');

  // 1. Criar reuniao no Supabase
  const res = await callFunction('start_meeting', {
    method: 'POST',
    body: JSON.stringify({ title, platform, meeting_url: meetingUrl }),
  });
  if (!res.ok) throw new Error(res.error || 'Erro ao criar reuniao no Supabase');
  const meetingId = res.meeting.id;

  // 2. Capturar audio da aba
  const stream = await captureTab(tabId);

  // 3. Configurar MediaRecorder
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm';
  const mediaRecorder = new MediaRecorder(stream, { mimeType });

  let chunkIndex = 0;
  let chunkBuffer = [];

  mediaRecorder.addEventListener('dataavailable', e => {
    if (e.data && e.data.size > 0) chunkBuffer.push(e.data);
  });

  // Enviar chunk a cada CHUNK_INTERVAL_MS
  const chunkTimer = setInterval(async () => {
    if (!session) return;
    try {
      mediaRecorder.stop();
      await delay(300);
      if (chunkBuffer.length > 0) {
        const blob = new Blob(chunkBuffer, { type: mimeType });
        chunkBuffer = [];
        const idx = chunkIndex++;
        sendChunk(blob, meetingId, idx).catch(console.error);
      }
      if (session) mediaRecorder.start();
    } catch (err) {
      console.error('Erro no ciclo de chunk:', err);
    }
  }, CHUNK_INTERVAL_MS);

  mediaRecorder.start();

  session = { stream, mediaRecorder, meetingId, chunkTimer, chunkBuffer, chunkIndex, mimeType };

  await chrome.storage.local.set({
    gloriaMeetingActive: true,
    gloriaMeetingId: meetingId,
    gloriaMeetingTitle: title,
    gloriaMeetingPlatform: platform,
  });

  return meetingId;
}

// ============================================================
// Parar gravacao e finalizar
// ============================================================
async function stopSession() {
  if (!session) throw new Error('Nenhuma transcricao ativa.');

  const { stream, mediaRecorder, chunkTimer, chunkBuffer, chunkIndex, meetingId, mimeType } = session;

  clearInterval(chunkTimer);

  if (mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    await delay(500);
  }

  stream.getTracks().forEach(t => t.stop());

  // Enviar ultimo chunk
  if (chunkBuffer.length > 0) {
    const blob = new Blob(chunkBuffer, { type: mimeType });
    await sendChunk(blob, meetingId, chunkIndex).catch(console.error);
    await delay(2000); // aguardar transcricao do ultimo chunk
  }

  session = null;
  await chrome.storage.local.remove(['gloriaMeetingActive', 'gloriaMeetingId', 'gloriaMeetingTitle', 'gloriaMeetingPlatform']);

  // Finalizar reuniao no Supabase
  const result = await callFunction('finish_meeting', {
    method: 'POST',
    body: JSON.stringify({ meeting_id: meetingId }),
  });

  return result;
}

// ============================================================
// Enviar chunk de audio para transcricao
// ============================================================
async function sendChunk(blob, meetingId, idx) {
  const form = new FormData();
  form.append('audio', blob, `chunk_${idx}.webm`);
  form.append('meeting_id', meetingId);
  form.append('chunk_index', String(idx));

  const res = await fetch(`${FUNCTION_URL}?action=transcribe_chunk`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`[Gloria] Erro chunk ${idx}:`, txt);
  } else {
    console.log(`[Gloria] Chunk ${idx} transcrito OK`);
  }
}

// ============================================================
// Helpers
// ============================================================
function captureTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.capture({ audio: true, video: false }, stream => {
      if (chrome.runtime.lastError || !stream) {
        reject(new Error(chrome.runtime.lastError?.message || 'Falha ao capturar aba'));
      } else {
        resolve(stream);
      }
    });
  });
}

async function callFunction(action, opts = {}) {
  const res = await fetch(`${FUNCTION_URL}?action=${action}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(opts.headers || {}),
    },
  });
  return res.json();
}

const delay = ms => new Promise(r => setTimeout(r, ms));
