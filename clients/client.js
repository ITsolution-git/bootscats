const net = require('net')

class Client {
  constructor(address) {
    this.address = address || '127.0.0.1:7535' //default
    const [host, port] = this.address.split(':')

    this.socket = net.createConnection(parseInt(port, 10), host)
  }


  start() {
    this.socket.on('connect', () => {
      console.log(`Connected to B/C Server at ${this.address}`)
    })

    this.socket.on('data', buffer => {
      this.handle_data(buffer.toString())
    })

    this.socket.on('end', buffer => {
      this.stop()
    })
  }


  stop() {
    console.log('Disconnected from B/C Server')
  }


  handle_data(data) {
    data.split('\n').forEach(line => {
      if(!line.match(/^\s*$/)) {
        console.log("Handle Data", line);
        this.handle_message(JSON.parse(line))
      }
    })
  }


  handle_message(msg) {
    if (msg.error) {
      console.log(`!!! ${msg.error} !!!`)
    }

    if (msg.message) {
      console.log(msg.message)
    }

    if (msg.turn) {
      this.handle_turn(msg.turn)
    }

    if (msg.event) {
      this.handle_event(msg.event)
    }
  }
}


module.exports = Client
