import * as net from 'net';

class TestClient {
  private socket: net.Socket;
  private id: string = '';
  private responses: string[] = [];
  private currentNumber: number | null = null;

  constructor(private name: string, private moves: (string | number)[]) {
    this.socket = new net.Socket();
  }

  connect() {
    this.socket.connect(7535, '127.0.0.1', () => {
      console.log(`[${this.name}] Connected to server`);
    });

    this.socket.on('data', (buffer) => {
      const messages = buffer.toString().split('\n').filter(line => line.trim());
      messages.forEach(line => {
        try {
          const msg = JSON.parse(line);
          this.handleMessage(msg);
        } catch (e) {
          console.error(`[${this.name}] Parse error:`, line);
        }
      });
    });

    this.socket.on('end', () => {
      console.log(`[${this.name}] Disconnected from server`);
    });

    this.socket.on('error', (err) => {
      console.error(`[${this.name}] Socket error:`, err.message);
    });
  }

  private handleMessage(msg: any) {
    console.log(`[${this.name}] Received:`, JSON.stringify(msg));

    if (msg.error) {
      console.log(`[${this.name}] ERROR: ${msg.error}`);
    }

    if (msg.message) {
      console.log(`[${this.name}] Message: ${msg.message}`);
    }

    if (msg.turn) {
      console.log(`[${this.name}] Turn: ${msg.turn.player} said "${msg.turn.said}"`);
      // Track the current number from other players' turns
      if (msg.turn.said && !isNaN(parseInt(msg.turn.said))) {
        const num = parseInt(msg.turn.said);
        if (this.currentNumber === null || num > this.currentNumber) {
          this.currentNumber = num;
        }
      }
    }

    if (msg.event) {
      this.handleEvent(msg.event);
    }
  }

  private handleEvent(event: string) {
    console.log(`[${this.name}] Event: ${event}`);
    
    switch(event) {
      case 'start':
      case 'turn':
        // Send next move after a short delay
        setTimeout(() => {
          this.sendMove();
        }, 100);
        break;
      case 'win':
        console.log(`[${this.name}] 🎉 WON THE GAME! 🎉`);
        break;
      case 'lose':
        console.log(`[${this.name}] 💀 LOST THE GAME 💀`);
        break;
      case 'timedout':
        console.log(`[${this.name}] ⏰ TIMED OUT ⏰`);
        break;
    }
  }

  private sendMove() {
    if (this.moves.length === 0) {
      console.log(`[${this.name}] No more moves`);
      return;
    }

    const move = this.moves.shift();
    console.log(`[${this.name}] Sending: "${move}"`);
    this.socket.write(move + '\n');
  }

  disconnect() {
    this.socket.end();
  }
}

// Test Scenario 1: Basic 2-player game
async function test2PlayerGame() {
  console.log('\n========== TEST 1: Basic 2-Player Game ==========\n');
  
  // Player 1 starts with 33, then plays 35, 37, 39
  const player1 = new TestClient('Player1', [33, 35, 'boots', 39]);
  
  // Player 2 responds with 34, 36, 38, 40
  const player2 = new TestClient('Player2', [34, 36, 38, 40]);
  
  player1.connect();
  
  // Wait a bit before second player joins
  await sleep(500);
  player2.connect();
  
  // Let game run for a while
  await sleep(5000);
}

// Test Scenario 2: 3 players
async function test3PlayerGame() {
  console.log('\n========== TEST 2: Three Player Game ==========\n');
  
  const player1 = new TestClient('Alice', [10, 13, 16]);
  const player2 = new TestClient('Bob', [11, 'cats', 'boots']);
  const player3 = new TestClient('Charlie', [12, 'cats', 18]);
  
  player1.connect();
  await sleep(300);
  player2.connect();
  await sleep(300);
  player3.connect();
  
  await sleep(5000);
}

// Test Scenario 3: Player joins mid-game
async function testMidGameJoin() {
  console.log('\n========== TEST 3: Mid-Game Join ==========\n');
  
  const player1 = new TestClient('Early1', [20, 22, 'cats', 26]);
  const player2 = new TestClient('Early2', ['boots', 23, 'cats']);
  
  player1.connect();
  await sleep(300);
  player2.connect();
  
  // Let game start
  await sleep(2000);
  
  // Third player joins mid-game
  const player3 = new TestClient('Latecomer', [27, 29, 31]);
  player3.connect();
  
  await sleep(5000);
}

// Test Scenario 4: Wrong answer
async function testWrongAnswer() {
  console.log('\n========== TEST 4: Wrong Answer ==========\n');
  
  const player1 = new TestClient('Correct', [33, 36, 39]);
  const player2 = new TestClient('Wrong', [34, 'WRONG_ANSWER']);
  
  player1.connect();
  await sleep(300);
  player2.connect();
  
  await sleep(3000);
}

// Test Scenario 5: Invalid starting number
async function testInvalidStart() {
  console.log('\n========== TEST 5: Invalid Starting Number ==========\n');
  
  const player1 = new TestClient('NegativeStart', [-5, 10, 12]);
  const player2 = new TestClient('Normal', [11, 13]);
  
  player1.connect();
  await sleep(300);
  player2.connect();
  
  await sleep(3000);
}

// Test Scenario 6: Zero start
async function testZeroStart() {
  console.log('\n========== TEST 6: Zero Starting Number ==========\n');
  
  const player1 = new TestClient('ZeroStart', [0, 5, 7]);
  const player2 = new TestClient('Normal', [6, 8]);
  
  player1.connect();
  await sleep(300);
  player2.connect();
  
  await sleep(3000);
}

// Test Scenario 7: Special numbers (35, 70, etc)
async function testSpecialNumbers() {
  console.log('\n========== TEST 7: Special Numbers (35, 70) ==========\n');
  
  // 35 should be "boots & cats" (divisible by both 5 and 7)
  const player1 = new TestClient('Player1', [33, 'boots & cats', 'boots']);
  const player2 = new TestClient('Player2', [34, 36, 38]);
  
  player1.connect();
  await sleep(300);
  player2.connect();
  
  await sleep(4000);
}

// Test Scenario 8: Out of turn messages
async function testOutOfTurn() {
  console.log('\n========== TEST 8: Out of Turn Messages ==========\n');
  
  // Player2 will try to send during Player1's turn
  const player1 = new TestClient('Player1', [40]);
  const player2 = new TestClient('Spammer', [41, 'SPAM', 'MORE_SPAM']);
  
  player1.connect();
  await sleep(300);
  player2.connect();
  
  await sleep(3000);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run tests sequentially
async function runAllTests() {
  const tests = [
    { name: 'Basic 2-Player Game', fn: test2PlayerGame },
    { name: 'Three Player Game', fn: test3PlayerGame },
    { name: 'Mid-Game Join', fn: testMidGameJoin },
    { name: 'Wrong Answer', fn: testWrongAnswer },
    { name: 'Invalid Starting Number', fn: testInvalidStart },
    { name: 'Zero Starting Number', fn: testZeroStart },
    { name: 'Special Numbers', fn: testSpecialNumbers },
    { name: 'Out of Turn Messages', fn: testOutOfTurn },
  ];

  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✅ ${test.name} completed\n`);
    } catch (error) {
      console.error(`❌ ${test.name} failed:`, error);
    }
    await sleep(2000); // Wait between tests
  }

  console.log('\n========== ALL TESTS COMPLETED ==========\n');
  process.exit(0);
}

// Run tests
runAllTests().catch(console.error);
