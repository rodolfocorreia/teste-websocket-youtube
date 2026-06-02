const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ port: 8080 });

wss.on('connection', (ws) => {
  console.log('Alguém entrou na Jam!', ws._socket.remoteAddress);

  ws.on('message', (data) => {
    const mensagem = JSON.parse(data);

    // Repassa a mensagem para TODOS os outros conectados, menos para quem enviou
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(JSON.stringify(mensagem));
      }
    });
  });
});

console.log('Servidor da Jam rodando na porta 8080!');