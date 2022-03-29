var connect = require('connect'),
    app = connect(),
    http = require('http'),
    server = http.createServer(app),
    urlrouter = require('urlrouter'),
    io = require('socket.io').listen(server),
    fs = require('fs'),
    sys = require('sys'),
    util = require('util'),
    ent = require('ent'),
    port = 8866;

app.use(urlrouter(function(app) {
    app.get('/', function(req, res, next) {
        req.url = '/index.html';
        connect.utils.parseUrl(req);
        next();
    });
}));

app.use(connect.static(__dirname + '/client'));

server.listen(port);

io.set('log level', 2);

//Variables for the server to run the rooms and players
var usernames = {};
//Vector that defines the game rooms
var rooms = ['Lobby', 'Room 1', 'Room 2', 'Room 3', 'Room 4'];
//A vector is created when the player connects to the room 
var games = {};


io.sockets.on('connection', function(socket) {

    //Number of people connected to the server
    socket.emit('updatePlayersCount', Object.keys(usernames).length);

    //Checking the nickname
    socket.on('adduser', function(niouwusername) {
        

        newusername = ent.encode(niouwusername); 
        testusername = ent.encode(niouwusername.toLowerCase())

        if (usernames.hasOwnProperty(testusername)) { //Verify if the nickname is already taken
            socket.emit('usernametaken');
            return;
        }



        // Nickname is stocked in the client's socket
        socket.username = newusername;

        // Client is added to the list of nicknames
        usernames[testusername] = testusername;

        //Editing visibility of the client
        socket.emit('switchwelcomevisibility');
        socket.emit('switchroomvisibility');

        //Connection to lobby
        default_room = 'Lobby';
        socket.join(default_room);
        socket.room = default_room; // We input on the socket the room value for easy access
        
        //Chat signals when player is connected
        socket.emit('updatechat', '', '<span style="color:gray;"> You are in the <span style="color:red;">' + default_room + '</span> !</span>');
        socket.broadcast.to(default_room).emit('updatechat', '', '<span style="color:gray;">' + newusername + ' connected to the Lobby. </span>');

        //Number of players in the game room
        var nbusers = [];

        for (var i in rooms) {
            nbusers.push(checknumberofplayers(rooms[i]));
        }

        //Update of the rooms with number of players and spectators
        io.sockets.in('Lobby').emit('updaterooms', rooms, 'Lobby', nbusers);

        socket.emit('updaterooms', rooms, socket.room, nbusers);

        //Instant update to all the players when new people connect
        io.sockets.emit('updatePlayersCount', Object.keys(usernames).length);


    });

    //Chat messaging
    socket.on('sendchat', function(data) {

        if (!socket.username) {
            socket.emit('notconnected');
        } else {
            io.sockets.in(socket.room).emit('updatechat', socket.username + ' :', ent.encode(data)); //ent permet d'escaper les entités html pour éviter le code malicieux
        }
    });

    // When a person on the lobby click in a room
    socket.on('switchRoom', function(newroom) {

        
        
            // Leaving a room
            socket.leave(socket.room);
            //Notification to the room that a player quit (On the chat)
            socket.broadcast.to(socket.room).emit('updatechat', '', '<span style="color:gray;">' + socket.username + ' left the room</span>');
        


        
        socket.join(newroom);
        socket.emit('updatechat', '', '<span style="color:gray;">You joined <span style="color:red;">' + newroom);


        // Update of the room value in the socket
        socket.room = newroom;
        socket.broadcast.to(newroom).emit('updatechat', '', '<span style="color:gray;">' + socket.username + ' joined this room</span>');

        nbusers = [];

        for (var i in rooms) {
            nbusers.push(checknumberofplayers(rooms[i]));
        }


        io.sockets.in('Lobby').emit('updaterooms', rooms, 'Lobby', nbusers); // Player values are updated in the rooms
        socket.emit('updaterooms', rooms, newroom, nbusers); //Name of room in the top of the page

        //We change the display to the player that enters game mode
        socket.emit('switchroomvisibility'); 
        socket.emit('switchgamevisibility');


        //Game room settings
        if (socket.room in games) { //If there's a game in the room

            if (typeof games[socket.room].player2 != "undefined") { //Check if there's a second player
                //If yes, the room is therefore full and the person enters as a spectator
                games[socket.room].spectators.push(socket);
                socket.emit('spectating', games[socket.room].player1.username, games[socket.room].player2.username); //Info to the spectator about what match its watching

                //If the game was in the middle the game is displayed in real time
                if (games[socket.room].player1.ready == 1 && games[socket.room].player2.ready == 1) {
                    socket.emit('updateboard', games[socket.room].turn.username, games[socket.room].turn.id, games[socket.room].board);
                    socket.emit('switchboardvisibility');
                }
                return; 
            }


            //If there wasn't a second player, the display loads
            games[socket.room].player2 = socket;
            //A button "Begin the Match" appears
            games[socket.room].player1.emit('requestgame', games[socket.room].player2.username);
            games[socket.room].player2.emit('requestgame', games[socket.room].player1.username);

        } else {
            //The object Games is created and linked to the room
            games[socket.room] = {
                player1: socket, //The client becomes player number one and the pointer directed to its socket
                board: [ 
                    [0, 0, 0],
                    [0, 0, 0],
                    [0, 0, 0]
                ], 
                spectators: [], //A spectator vector is created
                turn: null, //Here is stocked the player whose turn it is
            };

            games[socket.room].player1.emit('waiting'); //Message emited to the player to wait for another player
           
        }
    });

    // Function that allows player to click on the cross and return to the lobby
    socket.on('leaveRoom', function() {

        //Display is changed
        socket.emit('switchgamevisibility');
        socket.emit('hideboardvisibility');
        socket.emit('switchroomvisibility');

        //Tests 
        if (games[socket.room]) {
            if (games[socket.room].player1 && games[socket.room].player2) {
                if (games[socket.room].player1.id == socket.id || games[socket.room].player2.id == socket.id) {
                    if (games[socket.room].player1.ready == 1 && games[socket.room].player2.ready == 1) {
                        //Notification is sent when a player leaves the room
                        socket.broadcast.to(socket.room).emit('gameended', games[socket.room].board, '<span class=\"icon-cross\"></span> ' + games[socket.room].player1.username + ' VS ' + games[socket.room].player2.username + ' <span class=\"icon-radio-unchecked\"></span>', 'Déconnexion de ' + socket.username + ' :(');
                    }
                }
            }
        }

        
        socket.broadcast.to(socket.room).emit('updatechat', '', '<span style="color:gray;">' + socket.username + ' left the room.</span>');

        //Function that sends the state of the room
        roomchangestate(socket);

        //Player joins the lobby
        socket.leave(socket.room);
        socket.ready = 0;
        newroom = 'Lobby';
        socket.join(newroom);
        socket.room = newroom;

        var nbusers = [];

        for (var i in rooms) {
            nbusers.push(checknumberofplayers(rooms[i]));
        }

        //Refresh of all the players in the rooms
        io.sockets.in('Lobby').emit('updaterooms', rooms, newroom, nbusers);
        socket.emit('updaterooms', rooms, newroom, nbusers);
        socket.emit('updatechat', '', '<span style="color:gray;">You reconnected to <span style="color:red;">' + newroom);
    });

    //When a player clicks on "Beggin the Match"
    socket.on('gamerequested', function() {

        if (socket.id == games[socket.room].player1.id) {
            games[socket.room].player1.ready = 1;
        }
        if (socket.id == games[socket.room].player2.id) {
            games[socket.room].player2.ready = 1;
        }

        //When the two players are ready the game starts
        if (games[socket.room].player2.ready == 1 && games[socket.room].player1.ready == 1) {
            io.sockets.in(socket.room).emit('switchboardvisibility');
            games[socket.room].turn = games[socket.room].player1;
            io.sockets.in(socket.room).emit('updateboard', games[socket.room].turn.username, games[socket.room].turn.id, games[socket.room].board);
            io.sockets.in(socket.room).emit('updatechat', '', '<span style="color:#48ba69;">Start of the match!</span>');
        }

    });

    //The box where the player clicked during the game is seized
    socket.on('processgame', function(row, col) {

        if (games[socket.room].turn.id == socket.id) {

            
            if (socket.id == games[socket.room].player1.id) {
                var boardchange = 1;
                games[socket.room].turn = games[socket.room].player2; //Player turn change


            } else {
                var boardchange = 2;
                games[socket.room].turn = games[socket.room].player1; //The player that can play is changed

            }

            games[socket.room].board[row][col] = boardchange; //The matrix of the game is changed


            //Check if there is a victory
            if (checkifwin(socket.room)) {

                

                io.sockets.in(socket.room).emit('updateboard', '', '', games[socket.room].board);              

                //Notification at the end
                io.sockets.in(socket.room).emit('gameended', games[socket.room].board, '<span class=\"icon-cross\"></span> ' + games[socket.room].player1.username + ' VS ' + games[socket.room].player2.username + ' <span class=\"icon-radio-unchecked\"></span>', socket.username + ' wins!');

                var nbplayers = checknumberofplayers(socket.room);
                resetroomaftermatch(socket.room, nbplayers); //Game reset

                io.sockets.in(socket.room).emit('updatechat', '', '<span style="color:#48ba69;">' + socket.username + ' wins!</span>');

                return;
            }

            //The same with a tie
            if (checkifnull(socket.room)) {

                io.sockets.in(socket.room).emit('updateboard', '', '', games[socket.room].board);

                io.sockets.in(socket.room).emit('gameended', games[socket.room].board, '<span class=\"icon-cross\"></span> ' + games[socket.room].player1.username + " VS " + games[socket.room].player2.username + ' <span class=\"icon-radio-unchecked\"></span>', "It\'s a tie!");

                var nbplayers = checknumberofplayers(socket.room);
                resetroomaftermatch(socket.room, nbplayers);

                io.sockets.in(socket.room).emit('updatechat', '', '<span style="color:#48ba69;">It\'s a tie!</span>');

                return;
            }

            //If there is not a victory or a tie, we continue the game how it is
            io.sockets.in(socket.room).emit('updateboard', games[socket.room].turn.username, games[socket.room].turn.id, games[socket.room].board);

        }


    });

    //When there is brutal disconnection
    socket.on('disconnect', function() {
    
        if (games[socket.room]) {
            if (games[socket.room].player1 && games[socket.room].player2) {
                if (games[socket.room].player1.id == socket.id || games[socket.room].player2.id == socket.id) {
                socket.broadcast.to(socket.room).emit('gameended', games[socket.room].board, '<span class=\"icon-cross\"></span> ' + games[socket.room].player1.username + ' VS ' + games[socket.room].player2.username + ' <span class=\"icon-radio-unchecked\"></span>', 'Déconnexion de ' + socket.username + ' :(');
                if (games[socket.room].player1.ready == 1 && games[socket.room].player2.ready == 1) {
                    socket.broadcast.to(socket.room).emit('switchboardvisibility');
                }
            }
            }
        }

        roomchangestate(socket);

        //Delete the user from the list
        delete usernames[socket.username];
        // Avoid sending the message to an empty room when someone disconnects
        for (var i in rooms) {
            socket.broadcast.to(rooms[i]).emit('updatechat', '', '<span style="color:grey;">' + socket.username + ' s\'est déconnecté</span>');
        }
        
        socket.leave(socket.room);
        io.sockets.emit('updatePlayersCount', Object.keys(usernames).length);

    });

    //function for the number of users
    var checknumberofplayers = function(room) {
        var nbusers = Object.keys(io.sockets.clients(room)).length;
        return nbusers;
    };

    socket.on('checknumberofplayers', function(room) {
        var nbusers = checknumberofplayers(room);
        socket.emit('numberofplayers', nbusers);
    });

    //Game adaptations when someone disconnects or returns to lobby 
    var roomchangestate = function(socket) {
        
        if (socket.room && games[socket.room]) {
            var nbplayers = checknumberofplayers(socket.room) - 1; 


            if (nbplayers == 0) {
                delete games[socket.room];
                var bool = true;
            } else if (nbplayers == 1) {

                //Delete the references to the palyer that disconnected
                var bool = true;
                if (games[socket.room].player1.id == socket.id) {

                    games[socket.room].player1.ready = 0;

                    games[socket.room].player1 = games[socket.room].player2;

                    delete games[socket.room].player2;
                    games[socket.room].player1.ready = 0;

                } else {
                    games[socket.room].player2.ready = 0;

                    delete games[socket.room].player2;
                    games[socket.room].player1.ready = 0;

                }


            } else if (nbplayers >= 2) {

                //We adapt the spectator. If he disconnects, it changes the number of spectators. If a player disconnects, the spectators joins as a player.
                if (games[socket.room].player1.id == socket.id) {
                    games[socket.room].player1.ready = 0;
                    games[socket.room].player1 = games[socket.room].spectators[0];
                    games[socket.room].spectators.splice(0, 1);
                    games[socket.room].player1.ready = 0;
                    games[socket.room].player2.ready = 0;

                    var bool = true;
                } else if (games[socket.room].player2.id == socket.id) {

                    games[socket.room].player2.ready = 0;
                    games[socket.room].player2 = games[socket.room].spectators[0];
                    games[socket.room].spectators.splice(0, 1);
                    games[socket.room].player1.ready = 0;
                    games[socket.room].player2.ready = 0;
                    var bool = true;
                } else {
                    var index = games[socket.room].spectators.indexOf(socket);
                    var bool = false;

                    if (index > -1) {
                        games[socket.room].spectators.splice(index, 1);
                    }
                }



            }

            resetroomafterdisconnect(socket.room, nbplayers, bool); //On reset la room pour permettre un nouveau match
        }
    }

    //Check victory
    var checkifwin = function(room) {
        var board = games[room].board;
        var bool = false;

        // verify the conditions to win (lines, columns and diagonals)
        for (var i = 0; i <= 2; i++) {
            if (board[i][0] != 0 && board[i][0] == board[i][1] && board[i][0] == board[i][2]) {

                bool = true;
            }
        }

        for (var j = 0; j <= 2; j++) {
            if (board[0][j] != 0 && board[0][j] == board[1][j] && board[0][j] == board[2][j]) {

                bool = true;
            }
        }


        if (board[0][0] != 0 && board[0][0] == board[1][1] && board[0][0] == board[2][2]) {

            bool = true;
        }

        if (board[0][2] != 0 && board[0][2] == board[1][1] && board[0][2] == board[2][0]) {

            bool = true;
        }


        return bool;
    }

    //Check if is null
    var checkifnull = function(room) {
        var board = games[room].board;
        var test;
        var bool = false;

        if (board[0][0] != 0 && board[0][1] != 0 && board[0][2] != 0 && board[1][0] != 0 && board[1][1] != 0 && board[1][2] != 0 && board[2][0] != 0 && board[2][1] != 0 && board[2][2] != 0) {
            bool = true;
        }

        return bool;
    }

    var resetroomaftermatch = function(room, nbplayers) {


        if (games[room]) {

            //reset the board
            games[room].board = [
                [0, 0, 0],
                [0, 0, 0],
                [0, 0, 0]
            ];

            if (nbplayers == 1) {
                //we reset the game if there is only one player
                games[room].player1.ready = 0;
                io.sockets.in(socket.room).emit('hideboardvisibility');
                io.sockets.in(socket.room).emit('updateboard', "", games[socket.room].board);
                games[socket.room].player1.emit('waiting');
            }

            if (nbplayers >= 2) {

                //we change the player that goes first
                var temp;
                temp=games[room].player1;
                games[room].player1=games[room].player2;
                games[room].player2=temp;

                //we reset the "readys"
                games[room].player1.ready = 0;
                games[room].player2.ready = 0;

                for (var i in games[socket.room].spectators) {
                    games[socket.room].spectators[i].emit('spectating', games[socket.room].player1.username, games[socket.room].player2.username);
                }

                io.sockets.in(socket.room).emit('hideboardvisibility');

                //Buttons "begin match"
                games[room].player1.emit('requestgame', games[room].player2.username);
                games[room].player2.emit('requestgame', games[room].player1.username);
            }
        }
    }

    //Reset the room after disconnection
    var resetroomafterdisconnect = function(room, nbplayers, bool) {


        if (games[room]) {




            if (nbplayers == 1) {
                games[room].board = [
                    [0, 0, 0],
                    [0, 0, 0],
                    [0, 0, 0]
                ];
                games[room].player1.ready = 0;
                io.sockets.in(socket.room).emit('hideboardvisibility');
                io.sockets.in(socket.room).emit('updateboard', "", games[socket.room].board);
                games[socket.room].player1.emit('waiting');
            }

            if (nbplayers >= 2) {

                if (bool) {
                    games[room].board = [
                        [0, 0, 0],
                        [0, 0, 0],
                        [0, 0, 0]
                    ];

                    for (var i in games[socket.room].spectators) {
                        games[socket.room].spectators[i].emit('spectating', games[socket.room].player1.username, games[socket.room].player2.username);
                    }
                    io.sockets.in(socket.room).emit('updateboard', "", games[socket.room].board);
                    io.sockets.in(socket.room).emit('hideboardvisibility');
                    games[room].player1.emit('requestgame', games[room].player2.username);
                    games[room].player2.emit('requestgame', games[room].player1.username);
                } else {

                }
            }
        }
    }



});