const Client = require('./client')
const {stdin, stdout} = process

class CliClient extends Client {
  start() {
    super.start()
    this.accept_input = false
    stdin.resume()
    stdin.on('data', buffer => {
      this.handle_input(buffer.toString())
    })
  }


  stop() {
    super.stop()
    stdin.end()
  }


  handle_input(data) {
    if (this.accept_input) {
      this.accept_input = false
      return this.socket.write(data)
    }
  }


  handle_turn(turn) {
    console.log(`Turn: ${turn.player} : ${turn.said}`)
  }


  handle_event(event) {
    switch(event){
      case 'start':
        this.accept_input = true
        process.stdout.write('Start the game > ')
        break
      case 'turn':
        this.accept_input = true
        process.stdout.write('Your turn > ')
        break
      case 'timedout':
        this.accept_input = false
        console.log("\n --- Too Slow... Timed out! ---")
        break
      case 'win':
        console.log(' *** YOU WON ***   /ᐠ｡ꞈ｡ᐟ\\')
        break
      case 'lose':
        console.log(' ___ YOU LOST! ___    ¯\\_₍⸍⸌̣ʷ̣̫⸍̣⸌₎_/¯')
        break
    }
  }
}


module.exports = CliClient
