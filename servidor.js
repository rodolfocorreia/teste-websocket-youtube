const { WebSocketServer } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Servidor da Jam ativo!\n');
});

const wss = new WebSocketServer({ server });

function broadcastOuvintes() {
  const total = wss.clients.size;
  const payload = JSON.stringify({ tipo: 'ouvintes', total });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
  console.log(`Ouvintes na Jam: ${total}`);
}

wss.on('connection', (ws, req) => {
  console.log('Alguém entrou na Jam!', req.socket.remoteAddress);
  broadcastOuvintes();

  ws.on('message', (data) => {
    let mensagem;
    try {
      mensagem = JSON.parse(data);
    } catch {
      return;
    }

    // Repassa pra todos os outros (broadcast)
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(JSON.stringify(mensagem));
      }
    });
  });

  ws.on('close', () => {
    console.log('Alguém saiu da Jam.');
    broadcastOuvintes();
  });
});

server.listen(PORT, () => {
  console.log(`Servidor da Jam rodando na porta ${PORT}!`);
});
