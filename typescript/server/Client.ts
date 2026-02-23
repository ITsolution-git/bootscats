import { Socket } from "net";
import { SocEvent } from "./Event";

export class Client {
  id: string;
  socket: Socket;

  constructor(socket: Socket) {
    this.socket = socket;
    this.id = `${this.socket.remoteAddress}:${this.socket.remotePort}`;
  }

  // TODO callback implementation
  send(payload: SocEvent) {
    this.socket.write(JSON.stringify(payload) + '\n');
  }

  // disconnect
  disconnect() {
    this.socket.end();
  }
}