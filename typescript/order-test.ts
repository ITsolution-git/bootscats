#!/usr/bin/env npx ts-node

import * as net from 'net';

class OrderTestClient {
  private socket: net.Socket;
  
  constructor(private name: string, private joinDelay: number) {
    this.socket = new net.Socket();
  }

  connect() {
    setTimeout(() => {
      this.socket.connect(7535, '127.0.0.1', () => {
        console.log(`[${this.name}] Connected (joined after ${this.joinDelay}ms)`);
      });

      this.socket.on('data', (buffer) => {
        const messages = buffer.toString().split('\n').filter(line => line.trim());
        messages.forEach(line => {
          try {
            const msg = JSON.parse(line);
            
            if (msg.event === 'start') {
              console.log(`\n🎯 [${this.name}] GOT START EVENT - gets to choose the number!\n`);
            } else if (msg.event === 'turn') {
              console.log(`[${this.name}] Got turn event`);
            } else if (msg.message) {
              console.log(`[${this.name}] Message: ${msg.message}`);
            }
          } catch (e) {}
        });
      });

      this.socket.on('end', () => {
        console.log(`[${this.name}] Disconnected`);
      });
    }, this.joinDelay);
  }
}

async function test() {
  console.log('Testing player order...\n');
  console.log('Player1 joins first, Player2 joins second');
  console.log('Player1 should get the START event\n');
  
  const p1 = new OrderTestClient('Player1', 0);
  const p2 = new OrderTestClient('Player2', 500);
  const p3 = new OrderTestClient('Player3', 1000);
  
  p1.connect();
  p2.connect();
  p3.connect();
  
  // Let it run for 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('\nTest complete');
  process.exit(0);
}

test().catch(console.error);
