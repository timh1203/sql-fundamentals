import * as WS from 'ws';
import { Value as JSONValue } from 'json-typescript';
import { logger } from './log';
import { Server } from 'http';

const WS_PORT = 40510;
const WS_HEARTBEAT_PULSE = 2000;

interface WebSocket extends WS {
  isAlive: boolean;
}

// tslint:disable-next-line:no-empty
function noop() {}

function heartbeat(this: WebSocket) {
  this.isAlive = true;
}

class WebSocketManager {
  private wss: WS.Server;
  private heartbeatInterval: number;
  private connectedSockets: WebSocket[] = [];
  public constructor(server: Server) {
    this.wss = new WS.Server({ server });
    this.wss.on('connection', this.onConnect.bind(this));
    this.heartbeatInterval = setInterval(
      this.onHeartbeat.bind(this),
      WS_HEARTBEAT_PULSE
    );
  }
  public refreshAllClients() {
    this.broadcast('refresh');
  }
  public close() {
    clearInterval(this.heartbeatInterval);
    this.wss.clients.forEach(client => {
      // if (client.readyState === WS.OPEN) {
      client.close();
      // }
    });
    this.wss.close();
  }
  protected broadcast(message: JSONValue) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WS.OPEN) {
        client.send(message);
      }
    });
  }

  protected onConnect(ws: WebSocket) {
    console.log('connect');
    this.connectedSockets.push(ws);
    ws.isAlive = true;
    ws.on('pong', heartbeat);
    ws.on('message', this.onMessagereceived.bind(this));
    ws.on('error', (err: Error) => {
      console.error('WS ERROR', err.message);
    });
  }
  protected onMessagereceived(message: WS.Data) {
    console.log('received: %s', message);
  }

  private onHeartbeat() {
    this.cleanupClosedConnections();
  }
  private cleanupClosedConnections() {
    (this.wss.clients as Set<WebSocket>).forEach((ws: WebSocket) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping(noop);
    });
  }
}
let wsm: WebSocketManager;
export function setup(server: Server) {
  wsm = new WebSocketManager(server);
}
export default () => wsm;
