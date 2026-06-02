// Substitua pelo IP do seu servidor na nuvem quando for usar online
const socket = new WebSocket('ws://localhost:8080'); 

socket.onmessage = (event) => {
  const dados = JSON.parse(event.data);
  
  // Envia o comando recebido do outro PC direto para a aba do YouTube
  chrome.tabs.query({ url: "https://*.youtube.com/watch*" }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, dados);
    }
  });
};

// Escuta o que acontece no YouTube e manda para o Servidor
chrome.runtime.onMessage.addListener((mensagem) => {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(mensagem));
  }
});