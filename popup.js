// Elementos do DOM
const startBtn      = document.getElementById('startBtn');
const stopBtn       = document.getElementById('stopBtn');
const statusEl      = document.getElementById('status');
const dot           = document.getElementById('dot');
const titleInput    = document.getElementById('titleInput');
const platformSel   = document.getElementById('platformSelect');
const activeBadge   = document.getElementById('activeBadge');
const activeTitle   = document.getElementById('activeTitle');
const activeMtgId   = document.getElementById('activeMeetingId');

// Verificar se ja tem gravacao ativa ao abrir o popup
chrome.runtime.sendMessage({ type: 'STATUS' }, (res) => {
  if (res && res.active) {
    setRecording(true, res.meetingId);
    chrome.storage.local.get(['gloriaMeetingTitle'], r => {
      if (r.gloriaMeetingTitle) activeTitle.textContent = r.gloriaMeetingTitle;
    });
  }
});

// ---- INICIAR ----
startBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return setStatus('Nenhuma aba ativa encontrada.', 'err');

  const title    = titleInput.value.trim() || tab.title || 'Reuniao sem titulo';
  const platform = platformSel.value;
  const meetingUrl = tab.url;

  setStatus('Iniciando transcricao...', '');
  startBtn.disabled = true;

  chrome.runtime.sendMessage(
    { type: 'START', tabId: tab.id, title, platform, meetingUrl },
    (res) => {
      if (chrome.runtime.lastError) {
        return setStatus('Erro: ' + chrome.runtime.lastError.message, 'err');
      }
      if (res && res.ok) {
        setRecording(true, res.meetingId);
        activeTitle.textContent = title;
        activeMtgId.textContent = 'ID: ' + res.meetingId;
        setStatus('Transcrevendo... chunks enviados a cada 30s.', 'ok');
      } else {
        startBtn.disabled = false;
        setStatus('Erro ao iniciar: ' + (res?.error || 'desconhecido'), 'err');
      }
    }
  );
});

// ---- PARAR ----
stopBtn.addEventListener('click', () => {
  setStatus('Finalizando e salvando...', '');
  stopBtn.disabled = true;

  chrome.runtime.sendMessage({ type: 'STOP' }, (res) => {
    if (chrome.runtime.lastError) {
      return setStatus('Erro: ' + chrome.runtime.lastError.message, 'err');
    }
    if (res && res.ok) {
      setRecording(false);
      const participants = res.data?.participants?.length || 0;
      setStatus(`Reuniao salva! ${participants} falante(s) detectado(s).`, 'ok');
    } else {
      stopBtn.disabled = false;
      setStatus('Erro ao finalizar: ' + (res?.error || 'desconhecido'), 'err');
    }
  });
});

// ---- Helpers ----
function setRecording(active, meetingId) {
  startBtn.disabled = active;
  stopBtn.disabled  = !active;
  titleInput.disabled  = active;
  platformSel.disabled = active;

  dot.classList.toggle('on', active);
  activeBadge.style.display = active ? 'block' : 'none';

  if (meetingId) activeMtgId.textContent = 'ID: ' + meetingId;
}

function setStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = 'status-bar' + (type ? ' ' + type : '');
}
