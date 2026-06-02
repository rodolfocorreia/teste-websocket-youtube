let recebendoComando = false;

// Função para pegar o vídeo da página atual
function obterVideo() {
  return document.querySelector('video');
}

// 1. Escuta as ações que VOCÊ faz na página
function configurarOuvintes() {
  const video = obterVideo();
  if (!video) return;

  // Evita adicionar ouvintes duplicados
  if (video.dataset.jamConfigurado) return;
  video.dataset.jamConfigurado = true;

  video.addEventListener('play', () => {
    if (recebendoComando) return;
    chrome.runtime.sendMessage({ acao: 'play', tempo: video.currentTime });
  });

  video.addEventListener('pause', () => {
    if (recebendoComando) return;
    chrome.runtime.sendMessage({ acao: 'pause', tempo: video.currentTime });
  });

  video.addEventListener('seeked', () => {
    if (recebendoComando) return;
    chrome.runtime.sendMessage({ acao: 'sincronizarTempo', tempo: video.currentTime });
  });
}

// Fica monitorando a página para garantir que o player do YouTube carregou
const monitor = new MutationObserver(() => {
  if (obterVideo()) {
    configurarOuvintes();
  }
});
monitor.observe(document.body, { childList: true, subtree: true });

// 2. Escuta os comandos que vêm do OUTRO computador (ou do popup)
chrome.runtime.onMessage.addListener((playerComando, sender, sendResponse) => {
  const video = obterVideo();
  if (!video) {
    sendResponse?.({ erro: 'sem-video' });
    return;
  }

  // Popup pedindo o estado atual do player
  if (playerComando.acao === 'obterEstadoPlayer') {
    sendResponse({ tocando: !video.paused, tempo: video.currentTime });
    return true;
  }

  // Comando vindo do popup: força broadcast do tempo atual
  if (playerComando.acao === 'forcarSincronizar') {
    chrome.runtime.sendMessage({ acao: 'sincronizarTempo', tempo: video.currentTime });
    return;
  }

  // Popup pedindo toggle play/pause local (o evento play/pause do <video>
  // já dispara o broadcast pelos listeners configurados em configurarOuvintes)
  if (playerComando.acao === 'togglePlay') {
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    sendResponse({ tocando: !video.paused });
    return true;
  }

  recebendoComando = true;

  if (playerComando.acao === 'play') {
    video.currentTime = playerComando.tempo;
    video.play().catch(() => {});
  } else if (playerComando.acao === 'pause') {
    video.pause();
    video.currentTime = playerComando.tempo;
  } else if (playerComando.acao === 'sincronizarTempo') {
    if (Math.abs(video.currentTime - playerComando.tempo) > 1.5) {
      video.currentTime = playerComando.tempo;
    }
  }

  setTimeout(() => { recebendoComando = false; }, 600);
});