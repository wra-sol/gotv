import { redirect, useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";

export const useFileChanges = (socketUrl, userId) => {
  const [fileContent, setFileContent] = useState(null);
  const [error, setError] = useState(null);
  const fetcher = useFetcher();

  useEffect(() => {
    const ws = new WebSocket(`${socketUrl}?sessionId=${userId}`);
    const connectWebSocket = () => {
      ws.onopen = () => {
        console.log("WebSocket connected");
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
        } catch (error) {
          setError(error);
        }
      };

      ws.onerror = (event) => {
        console.error("WebSocket error:", event);
        setError("WebSocket error occurred");
      };

      ws.onclose = (event) => {
        if (event.wasClean) { 
          console.log(
            `WebSocket closed cleanly, code=${event.code}, reason=${event.reason}`
          );
        } else {
          console.error("WebSocket connection died");
          setError("WebSocket connection died");
        }
        setTimeout(connectWebSocket, 5000);
      };
    };
    if (userId) {
      connectWebSocket();
    }
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [socketUrl, userId]);

  return { fileContent, error };
};
