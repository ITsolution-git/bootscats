net = require 'net'

class Server

  constructor: (port=7535) ->
    @port = parseInt(port, 10)
    @s = net.createServer()
    @circle = []
    @players = {}
    @current_player = null
    @current_number = null
    @timeout = null


  start: () ->
    @s.on 'connection', (c) =>
      this.configure_player(c)

    @s.listen @port, () =>
      console.log 'started'


  stop: () ->


  configure_player: (c) ->
    id = "#{c.remoteAddress}:#{c.remotePort}"
    this.add_to_circle(id, c)

    c.on 'data',  (buffer) =>
      this.handle_data(id, buffer.toString().replace(/(\n|\r)+$/, '')) ##chomped

    c.on 'end', () =>
      this.remove_from_circle(id)


  handle_data: (id, data) ->
    console.log id, 'said', data
    this.stop_timeout()
    if id == @current_player
      if !@current_number?
        if !data.match /^\d+$/
          this.send_to_player id, error: 'start with a number, please - try again'
          this.send_to_player id, event: 'start'
          return
        else
          @current_number = parseInt(data, 10)
      this.turn_taken(id, data)
    else
      this.send_to_player(id, error: 'not your turn')


  send_to_player: (id, msg) ->
    body = (if 'string' == typeof msg
             message: msg
           else
             msg)
    c = @players[id]
    if c?
      c.write JSON.stringify(body) + "\n"
      console.log 'sent:', id, body
    else
      console.log 'no connection, can\'t send:', id, body


  notify_others_of_new_player: (id) ->
    for player in @circle
      if player != id
        this.send_to_player player, 'New player: ' + id


  notify_others_of_gone_player: (id) ->
    for player in @circle
      this.send_to_player player, 'Player gone: ' + id


  notify_player_of_others: (id) ->
    msg_parts = []
    for player in @circle
      if player != id
        msg_parts.push player
    if msg_parts.length > 0
      msg_parts.unshift 'Other players:'
    else
      msg_parts.unshift 'No other players'
    this.send_to_player id, msg_parts.join(' ')


  notify_others_of_turn: (id, data) ->
    for player in @circle
      if player != id
        this.send_to_player player, turn: {player: id, said: data}


  notify_others_of_mistake: (id) ->
    for player in @circle
      if player != id
        this.send_to_player player, id + ' lost!'


  notify_others_of_timeout: (id) ->
    for player in @circle
      if player != id
        this.send_to_player player, id + ' was too slow!'


  add_to_circle: (id, c) ->
    @circle.push id
    @players[id] = c
    console.log 'new player', id
    this.notify_others_of_new_player(id)
    this.notify_player_of_others(id)
    this.start_game_if_necessary()


  remove_from_circle: (id) ->
    if @circle.indexOf(id) >= 0
      index = @circle.indexOf(id)

      nc = (i for i in @circle when i != id)
      @circle = nc
      c = @players[id]
      c.end()
      delete @players[id]

      this.notify_others_of_gone_player(id)
      if this.should_stop_game()
        this.stop_game()
      else
        if id == @current_player
          this.stop_timeout()
          this.start_turn(index)


  start_game_if_necessary: () ->
    if !@current_player? and (@circle.length > 1)
      this.start_turn(0)


  should_stop_game: () ->
    (@circle.length == 1) and @current_player?


  stop_game: () ->
    this.send_to_player @circle[0], event: 'win'
    @current_player = null
    @current_number = null



  turn_taken: (id, data) ->
    this.notify_others_of_turn(id, data)
    if this.is_turn_valid(data)
      @current_number +=1
      this.start_turn(@circle.indexOf(id) + 1)
    else
      this.made_mistake(id)


  is_turn_valid: (data) ->
    correct_answer = BC.answer(@current_number)
    console.log 'checking valid: ', data, ' == ', correct_answer
    correct_answer == data


  start_turn: (index) ->
    @current_player = @circle[index % @circle.length]
    if @current_number?
      this.send_to_player @current_player, event: 'turn'
      this.start_timeout(@current_player)
    else
      this.send_to_player @current_player, event: 'start'


  start_timeout: (id) ->
    @timeout = setTimeout( (() => this.timed_out(id)), 10000 )


  stop_timeout: () ->
    if @timeout
      clearTimeout @timeout
      @timeout = null


  made_mistake: (id) ->
    this.send_to_player id, event: 'lose'
    this.notify_others_of_mistake(id)
    this.remove_from_circle(id)


  timed_out: (id) ->
    console.log("timed_out " + id)
    console.log("current_p " + @current_player)
    if @current_player? && @current_player == id
      this.send_to_player @current_player, event: 'timedout'
      this.notify_others_of_timeout(@current_player)
      this.remove_from_circle(@current_player)


BC =

  is_match: (num, target) ->
    ((num % target) == 0) or (num.toString().indexOf(target.toString()) >= 0)

  is_cats: (num) ->
    this.is_match(num, 5)

  is_boots: (num) ->
    this.is_match(num, 7)

  answer: (num) ->
    cats = this.is_cats(num)
    boots = this.is_boots(num)
    if boots and cats
      'boots & cats'
    else if boots
      'boots'
    else if cats
      'cats'
    else
      num.toString()


module.exports = Server
