const { WebSocketServer } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

// Render (Web Service) precisa de um servidor HTTP escutando na porta atribuída
// para passar o health check. O WebSocket sobe em cima desse mesmo servidor.
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Servidor da Jam ativo!\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  console.log('Alguém entrou na Jam!', req.socket.remoteAddress);

  ws.on('message', (data) => {
    const mensagem = JSON.parse(data);

    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(JSON.stringify(mensagem));
      }
    });
  });

  ws.on('close', () => {
    console.log('Alguém saiu da Jam.');
  });
});

server.listen(PORT, () => {
  console.log(`Servidor da Jam rodando na porta ${PORT}!`);
});
