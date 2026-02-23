#!/usr/bin/env npx ts-node

import * as net from 'net';

// Simple test: 2 players, one loses
class SimpleTestClient {
  private socket: net.Socket;
  
  constructor(private name: string) {
    this.socket = new net.Socket();
  }

  connect() {
    this.socket.connect(7535, '127.0.0.1', () => {
      console.log(`[${this.name}] Connected`);
    });

    this.socket.on('data', (buffer) => {
      const messages = buffer.toString().split('\n').filter(line => line.trim());
      messages.forEach(line => {
        try {
          const msg = JSON.parse(line);
          console.log(`[${this.name}] <<`, JSON.stringify(msg));
          
          if (msg.event === 'start') {
            // Player 1 starts with 33
            if (this.name === 'P1') {
              console.log(`[${this.name}] >> Sending: 33`);
              this.socket.write('33\n');
            }
          } else if (msg.event === 'turn') {
            // P2's turn after P1 said 33
            if (this.name === 'P2') {
              console.log(`[${this.name}] >> Sending: 34`);
              this.socket.write('34\n');
            }
            // P1's turn after P2 said 34 (should say "boots" for 35)
            else if (this.name === 'P1') {
              console.log(`[${this.name}] >> Sending: WRONG (testing lose)`);
              this.socket.write('35\n');  // Wrong! Should be "boots"
            }
          }
        } catch (e) {
          console.error(`[${this.name}] Parse error:`, line);
        }
      });
    });

    this.socket.on('end', () => {
      console.log(`[${this.name}] Disconnected`);
    });
  }
}

async function test() {
  console.log('Starting simple 2-player test...\n');
  
  const p1 = new SimpleTestClient('P1');
  const p2 = new SimpleTestClient('P2');
  
  p1.connect();
  
  setTimeout(() => {
    p2.connect();
  }, 500);
  
  // Let it run for 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('\nTest complete');
  process.exit(0);
}

test().catch(console.error);
