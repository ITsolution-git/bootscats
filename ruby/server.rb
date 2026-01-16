 require 'eventmachine'
 require 'json'

 module EchoServer
    @@connected_clients = []
    @@current_num = nil
    @@current_player_idx = 0

   def combine_second_elements(array_2d)
     array_2d.map { |child| child[1] }.join(" ")
   end

   def post_init
     puts "-- someone connected to the echo server!"
     port, *ip_parts = get_peername[2, 6].unpack("nC4")
     @@connected_clients << [self, "::ffff:#{ip_parts.join('.')}:#{port}"]

     if (@@connected_clients.length == 1)
        send_data({message: "No other players"}.to_json + "\n")
     end

     if (@@connected_clients.length >= 2)
        other_players = @@connected_clients.take(@@connected_clients.length - 1)

        send_data({message: "Other players: #{combine_second_elements(other_players)}"}.to_json+ "\n")

        other_players.each do |client|
          client[0].send_data({message:"New player: #{@@connected_clients.last[1]}"}.to_json+ "\n")
        end
     end
     
     if (@@connected_clients.length == 2)
      @@connected_clients[0][0].send_data({event: 'start'}.to_json + "\n")
     end

   end

   def receive_data data
    # if they type the right thing - no output
    # otherwise something 

    data = data.strip


    # first turn
    if (@@current_num == nil)
      # Check if data can be converted to integer
      if data =~ /^\d+$/
        @@current_num = data.to_i
      else
        send_data({error: '!!! start with a number, please - try again !!!'}.to_json + "\n")
        send_data({event: 'start'}.to_json + "\n")
        return
      end
    end

    if (data != response_for_num(@@current_num))
      send_data({event: 'lose'}.to_json)

      client_connection = @@connected_clients[@@current_player_idx][0]
      @@connected_clients.delete_at(@@current_player_idx)
      client_connection.close_connection
    end

    if @@current_player_idx == @@connected_clients.length - 1 
      @@current_player_idx = 0
    else 
      @@current_player_idx += 1 
    end

    # puts(@@current_num)
    @@current_num += 1

    next_player = @@connected_clients[@@current_player_idx][0]
    
    if (@@connected_clients.length == 1)
      next_player.send_data({event: 'win'}.to_json + "\n")
    else

      next_player.send_data({event: 'turn'}.to_json + "\n")
    end

     close_connection if data =~ /quit/i
   end

   def unbind
     puts "-- someone disconnected from the echo server!"
   end

   def response_for_num(num)
    if (num % 5 == 0 || num.to_s.include?('5')) && (num % 7 == 0 || num.to_s.include?('7')) 
      return 'boots and cats'
    elsif num % 5 == 0 || num.to_s.include?('5')
      return 'boots'
    elsif num % 7 == 0 || num.to_s.include?('7')
      return 'cats'
    end

    return num.to_s 
  end

end

# Note that this will block current thread.
EventMachine.run {
  EventMachine.start_server "127.0.0.1", 7535, EchoServer
}

