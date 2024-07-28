import { createRequestHandler } from "@remix-run/express";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { parse } from 'url';

const isProduction = process.env.NODE_ENV === "production";
const DB_PATH = 'database.sqlite';
const FILE_TO_WATCH = 'database.sqlite-wal';

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

const app = express();

app.use(compression());
app.disable("x-powered-by");

if (viteDevServer) {
  app.use(viteDevServer.middlewares);
} else {
  app.use(
    "/assets",
    express.static("build/client/assets", { immutable: true, maxAge: "1y" })
  );
}

app.use(express.static("build/client", { maxAge: "1h" }));

app.use(morgan("tiny"));

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

let db;

const initDb = async () => {
  console.log('Initializing database...');
  db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });
  await db.run('PRAGMA journal_mode = WAL');
  console.log('Database initialized successfully.');
};

const watchContacts = async (initialContacts, userId) => {
  console.log(`Checking for contact changes for user ${userId}...`);
  try {
    const currentContacts = await db.all('SELECT * FROM contacts');
    console.log(`Current contacts count for user ${userId}: ${currentContacts.length}`);

    const changes = currentContacts.filter(contact => {
      const initialContact = initialContacts?.find(ic => ic.id === contact.id);
      return !initialContact || JSON.stringify(contact) !== JSON.stringify(initialContact);
    });

    const deletedContacts = initialContacts?.filter(contact => 
      !currentContacts.some(cc => cc.id === contact.id)
    ).map(contact => ({ ...contact, deleted: true })) || [];

    const allChanges = [...changes, ...deletedContacts];

    if (allChanges.length > 0) {
      console.log(`Changes detected for user ${userId}:`, allChanges);
      return allChanges;
    } else {
      console.log(`No changes detected for user ${userId}.`);
      return [];
    }
  } catch (error) {
    console.error(`Error in watchContacts for user ${userId}:`, error);
    return [];
  }
};

server.on('upgrade', async (request, socket, head) => {
  console.log('WebSocket upgrade request received');
  const { query } = parse(request.url, true);
  const sessionId = query.sessionId;

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
        ws.userId = userId;
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
  console.log(`Client connected for user ${ws.userId}`);
  let initialContacts;
  try {
    initialContacts = await db.all('SELECT * FROM contacts');
    console.log(`Sending initial contacts for user ${ws.userId}. Count: ${initialContacts.length}`);
    ws.send(JSON.stringify({
      type: 'initialContacts',
      contacts: initialContacts
    }));

    const watcher = fs.watch(FILE_TO_WATCH, async (eventType, filename) => {
      console.log(eventType)
      if (eventType === 'rename' || eventType === "change") {
        console.log(`File ${filename} has been changed for user ${ws.userId}`);
        const changes = await watchContacts(initialContacts, ws.userId);
        if (changes.length > 0) {
          ws.send(JSON.stringify({
            type: 'fileUpdate',
            changes: changes
          }));
          initialContacts = await db.all('SELECT * FROM contacts');
        }
      }
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for user ${ws.userId}:`, error);
    });

    ws.on('close', (code, reason) => {
      console.log(`Client disconnected for user ${ws.userId}. Code: ${code}, Reason: ${reason}`);
      watcher.close();
    });
  } catch (error) {
    console.error(`Error in WebSocket connection handler for user ${ws.userId}:`, error);
  }
});

app.all("*", remixHandler);

const port = process.env.PORT || 5173;

initDb().then(() => {
  server.listen(port, () =>
    console.log(`Express server listening at http://localhost:${port}`)
  );
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});