const Client = require('./client')


class AiClient extends Client {
  start() {
    super.start()
    this.current_number = null
  }


  handle_turn(turn) {
    console.log(`Turn: ${turn.player} : ${turn.said}`)
    if (this.current_number != null) {
      this.current_number++
    } else {
      this.current_number = parseInt(turn.said, 10)
    }
  }


  handle_event(event) {
    switch(event) {
      case 'start':
        this.current_number = 3
        this.socket.write(this.current_number.toString() + "\n")
        break
      case 'turn':
        this.current_number += 1
        setTimeout(() => { 
          this.socket.write(bcAnswer(this.current_number) + "\n")
        }, 100)
        break
      case 'timedout':
        console.log("\n --- I'm never too slow! :( :( ---")
        break
      case 'win':
        this.current_number = null
        console.log(' *** I WON *** ')
        break
      case 'lose':
        console.log(' ___ I NEVER LOSE :( :( ___')
        break
    }
  }
}


const bcAnswer = num => {

  const isMatch = (num, target) => {
    return ((num % target) === 0) || (num.toString().indexOf(target.toString()) >= 0)
  }

  const cats = isMatch(num, 5)
  const boots = isMatch(num, 7)

  if (boots && cats) {
    return 'boots & cats'
  } else if (boots) {
    return 'boots'
  } else if (cats) {
    return 'cats'
  }

  return num.toString()
}


module.exports = AiClient
