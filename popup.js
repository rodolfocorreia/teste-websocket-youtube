const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const thumbWrapper = document.getElementById('thumb-wrapper');
const thumbPlaceholder = document.getElementById('thumb-placeholder');
const listenersBadge = document.getElementById('listeners-badge');
const listenersCount = document.getElementById('listeners-count');
const titleEl = document.getElementById('title');
const channelEl = document.getElementById('channel');
const playBtn = document.getElementById('play-btn');
const playIcon = document.getElementById('play-icon');
const syncBtn = document.getElementById('sync-btn');
const footerEl = document.getElementById('footer');

let abaAtivaId = null;
let tocando = false;

function extrairVideoId(url) {
  try {
    return new URL(url).searchParams.get('v');
  } catch {
    return null;
  }
}

function renderStatus(estado, ouvintes) {
  statusDot.classList.remove('connected', 'connecting', 'disconnected');

  if (estado === 'connected') {
    statusDot.classList.add('connected');
    statusText.textContent = 'Conectado';
    footerEl.textContent = ouvintes > 1
      ? `${ouvintes} ouvintes na Jam`
      : 'Você está sozinho na Jam';
  } else if (estado === 'connecting') {
    statusDot.classList.add('connecting');
    statusText.textContent = 'Conectando...';
    footerEl.textContent = 'Aguardando o servidor...';
  } else {
    statusDot.classList.add('disconnected');
    statusText.textContent = 'Offline';
    footerEl.textContent = 'Sem conexão com o servidor';
  }

  if (estado === 'connected' && ouvintes > 0) {
    listenersBadge.style.display = 'flex';
    listenersCount.textContent = String(ouvintes);
  } else {
    listenersBadge.style.display = 'none';
  }
}

function renderPlayIcon() {
  if (tocando) {
    playIcon.className = 'pause-icon';
  } else {
    playIcon.className = 'play-icon';
  }
}

async function carregarVideoAtivo() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url || !tab.url.includes('youtube.com/watch')) {
    thumbPlaceholder.style.display = 'block';
    titleEl.textContent = 'Nenhum vídeo aberto';
    channelEl.textContent = '';
    playBtn.disabled = true;
    syncBtn.disabled = true;
    return;
  }

  abaAtivaId = tab.id;

  const videoId = extrairVideoId(tab.url);
  if (videoId) {
    thumbWrapper.querySelector('.thumb-placeholder')?.remove();
    let img = thumbWrapper.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.alt = 'thumb';
      img.onerror = () => { img.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`; };
      thumbWrapper.prepend(img);
    }
    img.src = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }

  const tituloLimpo = (tab.title || '').replace(/\s*-\s*YouTube\s*$/, '');
  titleEl.textContent = tituloLimpo || 'Vídeo do YouTube';

  try {
    const [resultado] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const el = document.querySelector('#owner #channel-name a, ytd-channel-name a');
        return el ? el.textContent.trim() : '';
      }
    });
    channelEl.textContent = resultado?.result || '';
  } catch {
    channelEl.textContent = '';
  }

  // Pega estado atual do player
  try {
    const estado = await chrome.tabs.sendMessage(tab.id, { acao: 'obterEstadoPlayer' });
    tocando = !!estado?.tocando;
  } catch {
    tocando = false;
  }
  renderPlayIcon();

  playBtn.disabled = false;
  syncBtn.disabled = false;
}

async function carregarStatus() {
  try {
    const resp = await chrome.runtime.sendMessage({ tipo: 'obterStatus' });
    renderStatus(resp?.estado || 'disconnected', resp?.ouvintes || 0);
  } catch {
    renderStatus('disconnected', 0);
  }
}

playBtn.addEventListener('click', async () => {
  if (!abaAtivaId) return;
  try {
    const resp = await chrome.tabs.sendMessage(abaAtivaId, { acao: 'togglePlay' });
    if (resp && typeof resp.tocando === 'boolean') {
      tocando = resp.tocando;
      renderPlayIcon();
    }
  } catch (e) {
    console.warn('Falha no toggle:', e);
  }
});

syncBtn.addEventListener('click', async () => {
  if (!abaAtivaId) return;

  syncBtn.disabled = true;
  const textoOriginal = syncBtn.textContent;
  syncBtn.textContent = 'Enviando...';

  try {
    await chrome.tabs.sendMessage(abaAtivaId, { acao: 'forcarSincronizar' });
    syncBtn.textContent = 'Sincronizado ✓';
  } catch {
    syncBtn.textContent = 'Falhou';
  }

  setTimeout(() => {
    syncBtn.textContent = textoOriginal;
    syncBtn.disabled = false;
  }, 1500);
});

carregarVideoAtivo();
carregarStatus();

const intervalo = setInterval(carregarStatus, 1000);
window.addEventListener('unload', () => clearInterval(intervalo));
