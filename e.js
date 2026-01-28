const express = require("express");
const path = require("path");
const serveIndex = require("serve-index");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 3057;
const server = http.createServer(app);

app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".wasm")) {
      res.setHeader("Content-Type", "application/wasm");
    }
  }
}));

const servercorer3Path = path.join(__dirname, "servercorer3");
app.use("/servercorer3", express.static(servercorer3Path), serveIndex(servercorer3Path, { icons: true }));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const wsServer = new WebSocket.Server({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  wsServer.handleUpgrade(req, socket, head, (wsClient) => {
    wsServer.emit("connection", wsClient, req);
  });
});

wsServer.on("connection", (client, req) => {
  const url = req.url;

  console.log("Client connected to:", url);

  const targetUrl = `wss://ak7oqfc2u4qqcu6i-c.uvwx.xyz:8443${url}`;

  const queue = [];

  // Notice: NO subprotocols here
  const upstream = new WebSocket(targetUrl, {
    rejectUnauthorized: false,
    headers: {
      origin: "https://arras.io",
      host: "ak7oqfc2u4qqcu6i-c.uvwx.xyz:8443",
      cookie: req.headers.cookie || "",
    },
  });

  upstream.on("open", () => {
    console.log("Upstream connected");
    while (queue.length) upstream.send(queue.shift());
  });

  upstream.on("message", (data) => client.send(data));

  upstream.on("close", (code, reason) => {
    console.log("Upstream closed:", code, reason.toString());
    client.close();
  });

  upstream.on("error", (err) => {
    console.error("Upstream error:", err.message);
    client.close();
  });

  client.on("message", (data) => {
    if (upstream.readyState === WebSocket.OPEN) upstream.send(data);
    else queue.push(data);
  });

  client.on("close", () => upstream.close());
  client.on("error", () => upstream.close());
});

server.listen(PORT, () => {
  console.log(`✅ Local server running at: http://localhost:${PORT}`);
});
