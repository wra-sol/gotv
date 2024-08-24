import { createRequestHandler } from "@remix-run/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { parse } from 'url';
import { initializeDatabase, query, closePool, getClient } from "./dbServer.js"

const isProduction = process.env.NODE_ENV === "production";

// Vite setup for development
const viteDevServer = isProduction
  ? undefined
  : await import("vite").then((vite) =>
      vite.createServer({
        server: { middlewareMode: true },
      })
    );

const remixHandler = createRequestHandler({
  build: viteDevServer
    ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
    : await import("./build/server/index.js"),
});

const startServer = async () => {
  try {
    var client = await initializeDatabase({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT || '5432', 10),
    });

    const app = express();

    app.use(compression());
    app.disable("x-powered-by");

    // Serve static files
    if (viteDevServer) {
      app.use(viteDevServer.middlewares);
    } else {
      app.use(
        "/assets",
        express.static("build/client/assets", { immutable: true, maxAge: "1y" })
      );
      app.use(express.static("build/client", { maxAge: "1h" }));
    }

    app.use(morgan("tiny"));

    const server = createServer(app);
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', async (request, socket, head) => {
      console.log('WebSocket upgrade request received');
      const { query: queryParams } = parse(request.url, true);
      const sessionId = queryParams.sessionId;

      if (!sessionId) {
        console.log('WebSocket connection rejected: No session ID provided');
        socket.destroy();
        return;
      }

      try {
        console.log('User ID from auth:', sessionId);
        const userId = sessionId;
        if (userId) {
          wss.handleUpgrade(request, socket, head, (ws) => {
            (ws).userId = userId;
            console.log(`WebSocket connection established for user ${userId}`);
            wss.emit('connection', ws, request);
          });
        } else {
          console.log('WebSocket connection rejected: Invalid session');
          socket.destroy();
        }
      } catch (error) {
        console.error('Error during WebSocket upgrade:', error);
        socket.destroy();
      }
    });

    wss.on('connection', async (ws) => {
      const userId = (ws).userId;
      let client;
      try {
        client = await getClient(); 
        const result = await query('SELECT * FROM contacts');
        const initialContacts = result.rows;
        console.log(`Sending initial contacts for user ${userId}. Count: ${initialContacts.length}`);
        ws.send(JSON.stringify({
          type: 'initialContacts',
          contacts: initialContacts
        }));
    
        await client.query('LISTEN contact_changes');
        await client.query('LISTEN interaction_changes');
    
        const dbListener = (msg) => {
          console.log(msg);
          if (msg.channel === 'contact_changes') {
            const change = JSON.parse(msg.payload);
            ws.send(JSON.stringify({
              type: 'contactUpdate',
              change: change
            }));
          } else if (msg.channel === 'interaction_changes') {
            const change = JSON.parse(msg.payload);
            ws.send(JSON.stringify({
              type: 'interactionUpdate',
              change: change
            }));
          }
        };
        
        client.on('notification', dbListener);
    
        ws.on('error', (error) => {
          console.error(`WebSocket error for user ${userId}:`, error);
        });
    
        ws.on('close', (code, reason) => {
          console.log(`Client disconnected for user ${userId}. Code: ${code}, Reason: ${reason}`);
          client.removeListener('notification', dbListener);
          client.release();
        });
      } catch (error) {
        console.error(`Error in WebSocket connection handler for user ${userId}:`, error);
        if (client) client.release();
      }
    });

    app.all("*", remixHandler);

    const port = process.env.PORT || 5173;

    server.listen(port, () =>
      console.log(`Express server listening at http://localhost:${port}`)
    );
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
  await closePool();
  process.exit(0);
});