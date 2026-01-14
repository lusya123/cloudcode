import type http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

export type EventPayload = {
  event: string;
  data: unknown;
  timestamp: string;
};

export class EventBus {
  private wss: WebSocketServer;

  constructor(server: http.Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
  }

  broadcast(event: string, data: unknown): void {
    const payload: EventPayload = {
      event,
      data,
      timestamp: new Date().toISOString()
    };
    const message = JSON.stringify(payload);
    this.wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}
