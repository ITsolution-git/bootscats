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

      this.maybeStartGame();

      sock.on('data', buf => {
        const said = buf.toString().trim();
        if (this.currentGame) {
          this.currentGame.handle(c.id, said);
        }
      })

      sock.on('error', () => {
        // TODO
      })
    })

    server.listen(port, '127.0.0.1', () => {
      console.log('Server started');
    })
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
    this.clients = new Map<string, Client>;
    this.clients.set(winner.id, winner);

    this.currentGame = null;
    this.maybeStartGame();
  }
}