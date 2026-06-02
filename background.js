const SERVER_URL = 'wss://teste-websocket-youtube.onrender.com';
const RECONNECT_DELAY_MS = 3000;

let socket = null;

function conectar() {
  console.log('[Jam] Tentando conectar em', SERVER_URL);
  socket = new WebSocket(SERVER_URL);

  socket.onopen = () => {
    console.log('[Jam] ✅ Conectado ao servidor!');
  };

  socket.onmessage = (event) => {
    console.log('[Jam] ⬇️ Mensagem recebida do servidor:', event.data);
    let dados;
    try {
      dados = JSON.parse(event.data);
    } catch (e) {
      console.warn('[Jam] Mensagem inválida (não é JSON):', event.data);
      return;
    }

    chrome.tabs.query({ url: 'https://*.youtube.com/watch*' }, (tabs) => {
      if (tabs.length === 0) {
        console.warn('[Jam] Nenhuma aba do YouTube aberta para repassar o comando.');
        return;
      }
      console.log(`[Jam] Repassando comando para ${tabs.length} aba(s) do YouTube.`);
      tabs.forEach((tab) => {
        chrome.tabs.sendMessage(tab.id, dados, () => {
          if (chrome.runtime.lastError) {
            console.warn('[Jam] Falha ao enviar para a aba', tab.id, chrome.runtime.lastError.message);
          }
        });
      });
    });
  };

  socket.onerror = (err) => {
    console.error('[Jam] ❌ Erro no WebSocket:', err);
  };

  socket.onclose = (event) => {
    console.warn(`[Jam] 🔌 Conexão fechada (code=${event.code}, reason=${event.reason || 'sem motivo'}). Reconectando em ${RECONNECT_DELAY_MS}ms...`);
    setTimeout(conectar, RECONNECT_DELAY_MS);
  };
}

conectar();

// Escuta o que acontece no YouTube e manda para o servidor
chrome.runtime.onMessage.addListener((mensagem) => {
  console.log('[Jam] ⬆️ Comando vindo da aba do YouTube:', mensagem);

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.warn('[Jam] Socket não está aberto (readyState=' + (socket && socket.readyState) + '). Comando descartado.');
    return;
  }

  socket.send(JSON.stringify(mensagem));
  console.log('[Jam] Comando enviado ao servidor.');
});
