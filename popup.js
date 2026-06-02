const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const thumbWrapper = document.getElementById('thumb-wrapper');
const listenersBadge = document.getElementById('listeners-badge');
const listenersCount = document.getElementById('listeners-count');
const titleEl = document.getElementById('title');
const channelEl = document.getElementById('channel');
const playBtn = document.getElementById('play-btn');
const playIcon = document.getElementById('play-icon');
const syncBtn = document.getElementById('sync-btn');
const footerEl = document.getElementById('footer');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');

let abaYouTubeId = null;
let tocando = false;
let duracao = 0;

function extrairVideoId(url) {
  try {
    return new URL(url).searchParams.get('v');
  } catch {
    return null;
  }
}

function formatarTempo(seg) {
  if (!seg || !isFinite(seg)) return '0:00';
  const total = Math.floor(seg);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
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
  playIcon.className = tocando ? 'pause-icon' : 'play-icon';
}

function renderProgresso(tempo) {
  const pct = duracao > 0 ? Math.min(100, (tempo / duracao) * 100) : 0;
  progressFill.style.width = pct + '%';
  timeCurrent.textContent = formatarTempo(tempo);
  timeTotal.textContent = formatarTempo(duracao);
}

function renderSemVideo(msg) {
  const ph = thumbWrapper.querySelector('.thumb-placeholder');
  if (ph) ph.textContent = msg;
  thumbWrapper.querySelector('img')?.remove();
  if (!thumbWrapper.querySelector('.thumb-placeholder')) {
    const div = document.createElement('div');
    div.className = 'thumb-placeholder';
    div.textContent = msg;
    thumbWrapper.prepend(div);
  }
  titleEl.textContent = msg;
  channelEl.textContent = '';
  playBtn.disabled = true;
  syncBtn.disabled = true;
  progressFill.style.width = '0%';
  timeCurrent.textContent = '0:00';
  timeTotal.textContent = '0:00';
}

async function localizarAbaYouTube() {
  // Procura QUALQUER aba do YouTube (não importa se é a ativa) — assim o popup
  // funciona mesmo quando o usuário está em outra aba.
  const tabs = await chrome.tabs.query({ url: 'https://*.youtube.com/watch*' });
  if (tabs.length === 0) return null;

  // Preferir a aba ativa da janela atual se houver uma do YouTube ali
  const [ativa] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (ativa && tabs.some(t => t.id === ativa.id)) return ativa;
  return tabs[0];
}

async function carregarVideoAtivo() {
  const tab = await localizarAbaYouTube();

  if (!tab) {
    renderSemVideo('Abra um vídeo do YouTube');
    abaYouTubeId = null;
    return;
  }

  abaYouTubeId = tab.id;

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
    if (!img.src.includes(videoId)) {
      img.src = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
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

  playBtn.disabled = false;
  syncBtn.disabled = false;

  await atualizarEstadoPlayer();
}

async function atualizarEstadoPlayer() {
  if (!abaYouTubeId) return;
  try {
    const estado = await chrome.tabs.sendMessage(abaYouTubeId, { acao: 'obterEstadoPlayer' });
    if (estado) {
      tocando = !!estado.tocando;
      duracao = estado.duracao || 0;
      renderPlayIcon();
      renderProgresso(estado.tempo || 0);
    }
  } catch {
    // aba pode ter sido fechada — tentar relocalizar na próxima
    abaYouTubeId = null;
  }
}

async function carregarStatus() {
  try {
    const resp = await chrome.runtime.sendMessage({ tipo: 'obterStatus' });
    renderStatus(resp?.estado || 'disconnected', resp?.ouvintes || 0);
  } catch {
    renderStatus('disconnected', 0);
  }
}

// Clique na barra de progresso → seek
progressBar.addEventListener('click', async (e) => {
  if (!abaYouTubeId || duracao <= 0) return;
  const rect = progressBar.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  const novoTempo = Math.max(0, Math.min(duracao, pct * duracao));
  try {
    await chrome.tabs.sendMessage(abaYouTubeId, { acao: 'seekPara', tempo: novoTempo });
    renderProgresso(novoTempo);
  } catch {}
});

playBtn.addEventListener('click', async () => {
  if (!abaYouTubeId) return;
  try {
    const resp = await chrome.tabs.sendMessage(abaYouTubeId, { acao: 'togglePlay' });
    if (resp && typeof resp.tocando === 'boolean') {
      tocando = resp.tocando;
      renderPlayIcon();
    }
  } catch (e) {
    console.warn('Falha no toggle:', e);
  }
});

syncBtn.addEventListener('click', async () => {
  if (!abaYouTubeId) return;

  syncBtn.disabled = true;
  const textoOriginal = syncBtn.textContent;
  syncBtn.textContent = 'Enviando...';

  try {
    await chrome.tabs.sendMessage(abaYouTubeId, { acao: 'forcarSincronizar' });
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

// Poll do estado do player + status (a cada 500ms a barra anda suave)
const intervaloPlayer = setInterval(() => {
  if (!abaYouTubeId) {
    carregarVideoAtivo();
  } else {
    atualizarEstadoPlayer();
  }
}, 500);
const intervaloStatus = setInterval(carregarStatus, 1500);

window.addEventListener('unload', () => {
  clearInterval(intervaloPlayer);
  clearInterval(intervaloStatus);
});
