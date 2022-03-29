var socket = io.connect('http://localhost:8866');

//Au chargement de la page
$(function() {

    //Sending nickname to server
    $('#join').bind('click', function() {
        $('#error').html('&nbsp;');
        if (!$('#nickname').val().length) {
            $('#error').html('Obviously you username cannot be blank!');
            return;
        }
        socket.emit('adduser', $('#nickname').val());
    });

    //Notify the server for when a player wants to quit when it click on the cross on the top right
    $('#exit').click(function() {
        socket.emit('leaveRoom');
    });

    //Hide elements at the start of a game
    $('#gameended').toggle();
    $('#rooms').toggle();
    $('#game').toggle();
    $('#gameboard').toggle();

    //Chat refresh after sending a message
    $('#data').keypress(function(e) {
        if (e.which == 13) {
            $(this).blur();
            $('#datasend').focus().click();
            $(this).focus().select();
        }
    });
    
    //Message sent to the server
    $('#datasend').click(function() {
        var message = $('#data').val();
        $('#data').val('');
        if (message) {
            socket.emit('sendchat', message);
        }
    });

});

//Updating the chat
socket.on('updatechat', function(username, data) {
    $('#conversation').append('<b>' + username + '</b> ' + data + '<br>');
});

//Shows number of players in main screen
socket.on('updatePlayersCount', function(number) {
    if (!number) {
        numerb = "0";
    }
    $('#players').html(number);
});

//Players can't chat before inputing a nickname
socket.on('notconnected', function() {
    $('#error').html("You must choose a username to use the chat!");
});

// Players can't repeat the same nickname
socket.on('usernametaken', function() {
    $('#error').html('Unfortunately this username is already taken. Choose another one!');
});

//Hide or display graphic elements
socket.on('switchwelcomevisibility', function() {
    $('#welcome').toggle();
});

socket.on('switchroomvisibility', function() {
    $('#rooms').toggle();
    $('#gameinfo').html('');
});

socket.on('switchgamevisibility', function() {
    $('#game').toggle();
});

socket.on('switchboardvisibility', function() {
    $('#gameboard').toggle();
});

socket.on('hideboardvisibility', function() {
    $('#gameboard').hide();
});


//Displays the available rooms and number of player and spectators. Shows also the current room.
socket.on('updaterooms', function(rooms, current_room, nbusers) {
    $('#roomcards').empty();
    $.each(rooms, function(key, value) {
        if (value != 'Lobby') {

            if (nbusers[key] <= 2) {
                nbjoueurs = nbusers[key];
                nbspec = 0;
            } else {
                nbjoueurs = 2;
                nbspec = nbusers[key] - 2;
            }
            $('#roomcards').append('<a href="#" onclick="switchRoom(\'' + value + '\')"><div class="roomcard"><center>' + value + '</center><h2></h2><table style="width:100%"><tr><td  class="left">Players</td><td>' + nbjoueurs + '</td></tr><tr><td  class="left">Spectators</td><td>' + nbspec + '</td> </tr></table></div></a>');
        }
    });



    $('#salon').html(current_room);
});

//Function called when a player chooses a room
function switchRoom(room) {
    socket.emit('switchRoom', room);
}

//Function called when opponent is available and the game is ready to go
socket.on('requestgame', function(username) {
    $('#state').html('Opponent : <b>' + username + '</b>');
    $('#gamestate').html('<input type="button" onclick="gamerequest()" value="Begin the match" id="gamerequest" />');

});

//Function called when Player clicks on "Beggin the Match"
function gamerequest() {
    $('#gamestate').html('is not ready yet. Wait for him to press the button.');
    socket.emit('gamerequested');

}

//Waiting for the other player to send gamerequested
socket.on('waiting', function() {
    $('#state').html('Waiting for an opponent...');
    $('#gamestate').html('');
});

socket.on('spectating', function(username1, username2) {
    $('#state').html('You are watching the match of    <b><span class=\"icon-cross\"></span> ' + username1 + '</b> vs <b>' + username2 + ' <span class=\"icon-radio-unchecked\"></span>.</b>');
    $('#gamestate').html("Waiting for the match to start...");
});

//Refresh for the game board. The comparison of the socket id of the player that played sent to the server with the local socket.id helps to determine what computer receives the ability to play 
socket.on('updateboard', function(username, socketid, board) {

    if (board) {
        //Game board is emptied based on the matrix of the game that was sent
        $('#gameboard').empty();

        //Compares if the local id corresponds to the player that has its turn
        if (socket.socket.sessionid == socketid) {

            $('#gamestate').html("made his move. Now it\'s your turn.");
            var onclikedij = [
                ["onclick=clicked(this)", "onclick=clicked(this)", "onclick=clicked(this)"],
                ["onclick=clicked(this)", "onclick=clicked(this)", "onclick=clicked(this)"],
                ["onclick=clicked(this)", "onclick=clicked(this)", "onclick=clicked(this)"]
            ];
            var cssij = [
                ["cursor:pointer", "cursor:pointer", "cursor:pointer"],
                ["cursor:pointer", "cursor:pointer", "cursor:pointer"],
                ["cursor:pointer", "cursor:pointer", "cursor:pointer"]
            ];

        } else {

            $('#gamestate').html("");
            //Spectators and players that aren't in their turn can't click on the board to set a new move
            var cssij = [
                ["", "", ""],
                ["", "", ""],
                ["", "", ""]
            ];
            var onclikedij = [
                ["", "", ""],
                ["", "", ""],
                ["", "", ""]
            ];
        }

        var valij = [
            ["&nbsp;", "&nbsp;", "&nbsp;"],
            ["&nbsp;", "&nbsp;", "&nbsp;"],
            ["&nbsp;", "&nbsp;", "&nbsp;"]
        ];

        //The values of valij, cssij et onclickedij  are replaced based on the board sent by the server. board[i][j]=0 no one played in that box | board[i][j]=1 player 1 played in that box | board[i][j]=2 player 2 played in that box

        for (i = 0; i <= 2; i++) {
            for (j = 0; j <= 2; j++) {
                if (board[i][j] == 1) {
                    valij[i][j] = "<span class=\"icon-cross\"></span>";
                    cssij[i][j] = "";
                    onclikedij[i][j] = "";
                } else if (board[i][j] == 2) {
                    valij[i][j] = "<span class=\"icon-radio-unchecked\"></span>";
                    cssij[i][j] = "";
                    onclikedij[i][j] = "";
                }
            }
        }



        $('#gameboard').append('<div row="0" col="0" ' + onclikedij[0][0] + '  style="' + cssij[0][0] + '">' + valij[0][0] + '</div>');
        $('#gameboard').append('<div row="0" col="1" ' + onclikedij[0][1] + '  class="leftright" style="' + cssij[0][1] + '">' + valij[0][1] + '</div>');
        $('#gameboard').append('<div row="0" col="2" ' + onclikedij[0][2] + '  style="' + cssij[0][2] + '">' + valij[0][2] + '</div>');
        $('#gameboard').append('<div row="1" col="0" ' + onclikedij[1][0] + '  class="updown" style="' + cssij[1][0] + '">' + valij[1][0] + '</div>');
        $('#gameboard').append('<div row="1" col="1" ' + onclikedij[1][1] + '  class="middle" style="' + cssij[1][1] + '">' + valij[1][1] + '</div>');
        $('#gameboard').append('<div row="1" col="2" ' + onclikedij[1][2] + '  class="updown" style="' + cssij[1][2] + '">' + valij[1][2] + '</div>');
        $('#gameboard').append('<div row="2" col="0" ' + onclikedij[2][0] + '  style="' + cssij[2][0] + '">' + valij[2][0] + '</div>');
        $('#gameboard').append('<div row="2" col="1" ' + onclikedij[2][1] + '  class="leftright" style="' + cssij[2][1] + '">' + valij[2][1] + '</div>');
        $('#gameboard').append('<div row="2" col="2" ' + onclikedij[2][2] + '  style="' + cssij[2][2] + '">' + valij[2][2] + '</div>');
    }


});

//When player click in the box during its turn
function clicked(item) {
    var row = $(item).attr("row");
    var col = $(item).attr("col");

    socket.emit('processgame', row, col);
}

// In case of disconnection, victory or draw the server send a notification
socket.on('gameended', function(board, matchdetails, conclusion) {

	
    if (board) {} else {
        board = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0]
        ];
    }



    var valij = [
        ["&nbsp;", "&nbsp;", "&nbsp;"],
        ["&nbsp;", "&nbsp;", "&nbsp;"],
        ["&nbsp;", "&nbsp;", "&nbsp;"]
    ];

  

    for (i = 0; i <= 2; i++) {
        for (j = 0; j <= 2; j++) {
            if (board[i][j] == 1) {
                    valij[i][j] = "<span class=\"icon-cross\"></span>";                 
                } else if (board[i][j] == 2) {
                    valij[i][j] = "<span class=\"icon-radio-unchecked\"></span>";                 
                }
        }
    }

    $('#finalgameboard').empty();

    $('#finalgameboard').append('<div row="0" col="0"  >' + valij[0][0] + '</div>');
    $('#finalgameboard').append('<div row="0" col="1"  class="leftright">' + valij[0][1] + '</div>');
    $('#finalgameboard').append('<div row="0" col="2" >' + valij[0][2] + '</div>');
    $('#finalgameboard').append('<div row="1" col="0"   class="updown" >' + valij[1][0] + '</div>');
    $('#finalgameboard').append('<div row="1" col="1"  class="middle">' + valij[1][1] + '</div>');
    $('#finalgameboard').append('<div row="1" col="2"  class="updown">' + valij[1][2] + '</div>');
    $('#finalgameboard').append('<div row="2" col="0" >' + valij[2][0] + '</div>');
    $('#finalgameboard').append('<div row="2" col="1"  class="leftright">' + valij[2][1] + '</div>');
    $('#finalgameboard').append('<div row="2" col="2" >' + valij[2][2] + '</div>');

    $('#matchdetails').html(matchdetails);
    $('#conclusion').html(conclusion);
    $('#gameended').fadeTo(100, 1);


    //Countdown of 5 seconds of the victory/loss notificat
    $.fn.countdown = function(callback, duration) {

        var container = $(this[0]).html(duration);

        var countdown = setInterval(function() {

            if (--duration) {

                $('#countdown').html(duration);

            } else {

                clearInterval(countdown);

                callback.call(container);
            }

        }, 1000);

    };

    $("#countdown").countdown(redirect, 5);

    function redirect() {
        $('#countdown').html(0);
        $('#gameended').fadeTo(1000, 0); //Hide notification
        setTimeout(function() {
            $('#gameended').toggle(); //Show it again
        }, 1003);

    }


});