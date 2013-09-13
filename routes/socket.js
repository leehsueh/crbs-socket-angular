/*
 * Serve content over a socket
 */
// Keep track of which names are used so that there are no duplicates
var userNames = (function () {
  var userNames = {};

  var claim = function (name) {
    if (!name || userNames[name]) {
      return false;
    } else {
      userNames[name] = true;
      return true;
    }
  };

  // find the lowest unused "guest" name and claim it
  var getGuestName = function () {
    var name,
      nextUserId = 1;

    do {
      name = 'Guest ' + nextUserId;
      nextUserId += 1;
    } while (!claim(name));

    return name;
  };

  // serialize claimed names as an array
  var get = function () {
    var res = [];
    for (user in userNames) {
      res.push(user);
    }

    return res;
  };

  var free = function (name) {
    if (userNames[name]) {
      delete userNames[name];
    }
  };

  return {
    claim: claim,
    free: free,
    get: get,
    getGuestName: getGuestName
  };
}());

module.exports = function (socket) {
  var name = userNames.getGuestName();

  // send new user their name and list of users
  socket.emit('init', {
  	name: name,
  	users: userNames.get()
  });

  // notify other clients that new user has joined
  socket.broadcast.emit('user:join', {
  	name: name
  });

  // broad cast a user's message to other users
  socket.on('send:message', function(data) {
  	socket.broadcast.emit('send:message', {
  		user: name,
  		text: data.message
  	});
  });

  // validate a user's name change, and broadcast
  socket.on('change:name', function(data, fn) {
  	if (userNames.claim(data.name)) {
  		var oldName = name;
  		userNames.free(oldName);
  		name = data.name;
  		socket.broadcast.emit('change:name', {
  			oldName: oldName,
  			newName: name
  		});

  		fn(true);
  	} else {
  		fn(false);
  	}
  });

  // clean up when a user leaves, and broadcast it
  socket.on('disconnect', function() {
  	socket.broadcast.emit('user:left', {
  		name: name
  	});
  	userNames.free(name);
  });
};
