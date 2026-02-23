import { Client } from "./Client";
import * as net from 'net';
import { createMessageEvent } from "./Event";
import { Game } from "./Game";

export class Server {
  private clients = new Map<string, Client>();
  private currentGame: Game | null = null;
  constructor() {}

  start(port = 7535) {
    const server = net.createServer(sock => {
      const c = new Client(sock);
      this.clients.set(c.id, c);
      
      c.send(createMessageEvent(`Connected to B/C Server at ${sock.localAddress}:${port}`));

      // If there's an active game, add this client to it
      if (this.currentGame && this.currentGame.isActive()) {
        this.currentGame.clientJoined(c);
      } else {
        this.maybeStartGame();
      }

      sock.on('data', buf => {
        const said = buf.toString().trim();
        if (this.currentGame) {
          this.currentGame.handle(c.id, said);
        }
      })

      sock.on('error', () => {
        if (this.currentGame) {
          this.currentGame.clientDisconnected(c);
        }
        this.clients.delete(c.id);
      })

      sock.on('close', () => {
        // Only notify game if it's still active
        // (if game already ended, this client was already removed)
        if (this.currentGame && this.currentGame.isActive()) {
          this.currentGame.clientDisconnected(c);
        }
        this.clients.delete(c.id);
      })
    })

    server.listen(port, '127.0.0.1')
  }

  idleClients(): Client[] {
    return Array.from(this.clients.values());
  }

  maybeStartGame() {
    if (this.currentGame && this.currentGame.isActive()) return;
    const idle = this.idleClients();
    if (idle.length > 1) {
      const players = idle;
      this.currentGame = new Game(players, (p) => this.gameEnded(p));
      this.currentGame.start();
    } else {
      idle.forEach(client =>{
        client.send(createMessageEvent('No other players'));
      });
    }
  }

  gameEnded(winner: Client) {
    // Prevent multiple calls - if currentGame is already null, we've already processed this
    if (!this.currentGame) {
      return;
    }
    
    // Don't destroy the clients map - let players stay connected for next game
    // Just reset the current game and try to start a new one
    
    this.currentGame = null;
    this.maybeStartGame();
  }
}