import { Client } from "./Client";
import { SocEvent, createEvtEvent, createTurnEvent, createErrorEvent } from "./Event";

export class Game {
  private players: Client[];
  private turnIdx = 0;
  private currentNumber: number | null = null;
  private active = true;
  private onGameEnd: (winner: Client) => void;
  private clientIdWonGame: string | null = null;
  private turnTimeout: NodeJS.Timeout | null = null;
  private readonly TURN_TIMEOUT_MS = 1000 * 60; // 1 minutes

  constructor(clients: Client[], onGameEnd: (winner: Client) => void) {
    this.onGameEnd = onGameEnd;
    this.players = [...clients];
  }

  start() {
    this.active = true;
    this.currentNumber = null;
    this.turnIdx = 0;
    this.promptCurrent();
  }

  private promptCurrent() {
    if (!this.active) return;

    const cur = this.players[this.turnIdx];
    this.sendMessage(cur, this.currentNumber === null ? createEvtEvent('start') : createEvtEvent('turn'));

    // Set timeout for current player
    if (this.turnTimeout) {
      clearTimeout(this.turnTimeout);
    }

    this.turnTimeout = setTimeout(() => {
      this.handleTimeout();
    }, this.TURN_TIMEOUT_MS);
  }

  private handleTimeout() {
    if (!this.active) return;

    const current = this.players[this.turnIdx];
    this.sendMessage(current, createEvtEvent('timedout'));
    this.broadcastEvent(createTurnEvent(current.id, 'TIMEOUT'));

    // Current player loses
    return this.maybeEndGame(current.id);
  }

  private getOtherPlayer(client: Client): Client | null {
    return this.players.find(p => p.id !== client.id) || null;
  }

  private endGame() {
    if (this.players.length > 1) {
      throw new Error('EndGame - incorrect behavior');
    }

    const winner = this.players.length > 0 ? this.players[0] : null;
    console.log('endGame the winner is', winner.id);
    this.active = false;

    if (this.turnTimeout) {
      clearTimeout(this.turnTimeout);
      this.turnTimeout = null;
    }

    if (winner) {
      this.clientIdWonGame = winner.id;
      this.sendMessage(winner, createEvtEvent('win'));

      const loser = this.getOtherPlayer(winner);
      if (loser) {
        this.sendMessage(loser, createEvtEvent('lose'));
      }
    } else {
      // No winner, everyone loses
      this.broadcastEvent(createEvtEvent('lose'));
    }

    // Notify server that game ended
    this.onGameEnd(winner);
    return true
  }

  maybeEndGame(clientId?: string) {
    console.log('maybeEndGame', clientId)
    // disconnect client (if valid) and end the game if there is only 1 player
    if (clientId) {
      const client = this.players.find(p => p.id === clientId);
      if (client) {
        client.disconnect()
        this.clientDisconnected(client);
      }
    }
    return false
  }

  handle(clientId: string, said: string) {
    if (!this.active) return;

    const currentPlayer = this.players[this.turnIdx];

    // Check if it's this client's turn
    if (currentPlayer.id !== clientId) {
      const client = this.players.find(p => p.id === clientId);
      if (client) {
        this.sendMessage(client, createErrorEvent("Not your turn!"));
      }
      return;
    }

    // Clear timeout since player responded
    if (this.turnTimeout) {
      clearTimeout(this.turnTimeout);
      this.turnTimeout = null;
    }

    // Initialize game if this is the first move
    if (this.currentNumber === null) {
      const num = parseInt(said.trim(), 10);
      if (isNaN(num)) {
        this.sendMessage(currentPlayer, createErrorEvent("!!! start with a number, please - try again !!!"));
        this.promptCurrent();
        return;
      }
      this.currentNumber = num;
    } else {
      // Validate the answer
      const expectedAnswer = this.getExpectedAnswer(this.currentNumber);
      const playerSaid = said.trim();

      if (playerSaid !== expectedAnswer) {
        // Player made a mistake, they lose
        const ended = this.maybeEndGame(clientId);
        if (ended) {
          return;
        }
      }

      this.currentNumber++;
    }

    // Broadcast the turn
    this.broadcastEvent(createTurnEvent(currentPlayer.id, said.trim()));

    // Move to next player
    this.turnIdx = (this.turnIdx + 1) % this.players.length;
    this.promptCurrent();
  }

  private getExpectedAnswer(num: number): string {
    const isMatch = (n: number, target: number): boolean => {
      return (n % target === 0) || n.toString().includes(target.toString());
    };

    const cats = isMatch(num, 5);
    const boots = isMatch(num, 7);

    if (boots && cats) {
      return 'boots & cats';
    } else if (boots) {
      return 'boots';
    } else if (cats) {
      return 'cats';
    }

    return num.toString();
  }

  clientJoined(client: Client) {
    this.players.push(client);
  }

  clientDisconnected(client: Client) {
    const index = this.players.findIndex(p => p.id === client.id);
    if (index === -1) return;

    this.players.splice(index, 1);

    console.log('clientDiconencted', this.players.length)
    // If a player disconnects during an active game, the other player wins
    if (this.active && this.players.length === 1) {
      return this.endGame();
    } else if (this.players.length === 0) {
      return this.endGame();
    }
  
    return false
  }

  broadcastEvent(event: SocEvent) {
    this.players.forEach(player => {
      this.sendMessage(player, event);
    });
  }

  sendMessage(client: Client, event: SocEvent) {
    // FIXME: callback implementation to handle send failures
    client.send(event);
  }

  getPlayerCount(): number {
    return this.players.length;
  }

  public isActive() {
    return this.active;
  }
}