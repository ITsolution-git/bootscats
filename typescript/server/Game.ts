import { Client } from "./Client";
import { SocEvent, createEvtEvent, createTurnEvent, createErrorEvent, createMessageEvent } from "./Event";

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

    // Validate turnIdx is in bounds
    if (this.players.length === 0) {
      console.error('promptCurrent called with no players');
      return;
    }
    
    if (this.turnIdx >= this.players.length) {
      console.warn('turnIdx out of bounds, resetting to 0');
      this.turnIdx = 0;
    }

    const cur = this.players[this.turnIdx];
    if (!cur) {
      console.error('Current player is undefined at index', this.turnIdx);
      return;
    }
    
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
    // Prevent multiple calls to endGame
    if (!this.active) {
      return false;
    }
    
    if (this.players.length > 1) {
      throw new Error('EndGame - incorrect behavior');
    }

    const winner = this.players.length > 0 ? this.players[0] : null;
    this.active = false;

    if (this.turnTimeout) {
      clearTimeout(this.turnTimeout);
      this.turnTimeout = null;
    }

    if (winner) {
      this.clientIdWonGame = winner.id;
      this.sendMessage(winner, createEvtEvent('win'));
    } else {
      // No winner, everyone loses
      this.broadcastEvent(createEvtEvent('lose'));
    }

    // Clear players array so they're not tracked by this game anymore
    this.players = [];

    // Notify server that game ended
    this.onGameEnd(winner);
    return true
  }

  maybeEndGame(clientId?: string) {
    // disconnect client (if valid) and end the game if there is only 1 player
    if (clientId) {
      const client = this.players.find(p => p.id === clientId);
      if (client) {
        // Send lose event BEFORE disconnecting so client receives it
        this.sendMessage(client, createEvtEvent('lose'));
        
        // Disconnect client - this will trigger socket close event
        client.disconnect();
        
        // Remove from game and check if game should end
        const ended = this.clientDisconnected(client);
        return ended;
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
      if (num < 1) {
        this.sendMessage(currentPlayer, createErrorEvent("!!! please start with a positive number (1 or greater) !!!"));
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
    }

    // Broadcast the turn
    this.broadcastEvent(createTurnEvent(currentPlayer.id, said.trim()));

    // Increment for next turn
    this.currentNumber++;

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
    
    // Notify all players about the new player
    const otherPlayerIds = this.players
      .filter(p => p.id !== client.id)
      .map(p => p.id)
      .join(', ');
    
    if (otherPlayerIds) {
      client.send(createMessageEvent(`Other players: ${otherPlayerIds}`));
      this.broadcastEvent(createMessageEvent(`Player joined: ${client.id}`));
    }

    // Send current game state if game is in progress
    if (this.currentNumber !== null) {
      client.send(createMessageEvent(`Game in progress. Current number: ${this.currentNumber}`));
      const currentPlayer = this.players[this.turnIdx];
      if (currentPlayer) {
        client.send(createMessageEvent(`Current turn: ${currentPlayer.id}`));
      }
    }
  }

  clientDisconnected(client: Client): boolean {
    const index = this.players.findIndex(p => p.id === client.id);
    if (index === -1) return false;

    this.players.splice(index, 1);

    // Adjust turnIdx if needed
    if (index < this.turnIdx) {
      // A player before current turn left, shift index back
      this.turnIdx--;
    } else if (index === this.turnIdx && this.players.length > 0) {
      // Current player left, wrap around if needed
      if (this.turnIdx >= this.players.length) {
        this.turnIdx = 0;
      }
    }
    
    // If a player disconnects during an active game, check if game should end
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