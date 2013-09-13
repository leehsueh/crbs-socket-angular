/*
 * Serve content over a socket
 */
// Keep track of which names are used so that there are no duplicates
http = require('http');

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

// Biblia API object
var biblia = (function () {
  var API_URL = 'http://api.biblia.com/v1/bible/content/LEB.txt';
  var API_KEY = "6936276c430fe411a35bb1f6ae786c19";

  var getFullReference = function(textToScan) {
    textToScan = textToScan[0].toUpperCase() + textToScan.slice(1);
    var api_url = "http://api.biblia.com/v1/bible/scan/";
    var result = 'not set';
    $.ajax({
      url: api_url,
      type: "GET",
      data: { key: API_KEY, text: textToScan },
      async: false,
      success: function(data) {
        if (data.results.length > 0) {
          result = data.results[0].passage;  
        } else {
          result = false;
        }
      }
    });
    if (!result) return result;
    return result.replace("–","-"); // replace long dash with regular hyphen
  };
  var getPassage = function(fullRef) {
    console.log("fetching passage");
    var mergedParams = {
      key: API_KEY,
      passage: fullRef,
      style: "orationOneVersePerLine"
    }
    var result = false;
    $.extend(mergedParams, params);
    $.ajax({
      url: api_url,
      type: "GET",
      data: mergedParams,
      async: false,
      success: function(data) {
        // console.log(data.split("\n"));
        var refParts = data.split("\n");
        var fullRefWithVersion = refParts[0].replace("–","-"); // replace long dash with regular hyphen
        var passageText = refParts.slice(1).join("<br>").replace(/([0-9]+)/g, "<sup>$1</sup>");
        // successCallback(fullRefWithVersion, passageText);
        result = {
          passage: fullRefWithVersion,
          text: passageText
        }
      }
    });

    return result;
  }
  var parseFullReference = function(fullRef) {
    var regex = /(((1|2) )?([A-Za-z ]+)) ([0-9]{1,3})/,
      matches = fullRef.match(regex);
    if (matches && matches.length > 5) {
      return {
        book: matches[1],
        chapter: matches[5]
      };
    } else {
      return null;
    }
  };

  return {
    getFullReference: getFullReference,
    getPassage: getPassage,
    parseFullReference: parseFullReference,

  };
}());

// stored passages
var passages = [];

module.exports = function (socket) {
  // send new user their name and list of users
  // send existing passages
  var name = userNames.getGuestName();
  socket.emit('init', {
    name: name,
    users: userNames.get(),
    passages: passages
  });

  /** Bible passages stuff **/
  socket.on('add:passage', function(data, fn) {
    // get full reference
    var fullReference = biblia.getFullReference(data.userPassageRef);
    if (!fullReference) {
      fn(false, "Invalid reference");
    } else {
      // get the passage text
      var passageResult = biblia.getPassage(fullReference);
      if (!passageResult) {
        fn(false, "Error fetching passage");
      } else {
        passages.push(passageResult);  
        // broadcast the fetched data
        socket.broadcast.emit('add:passage', passageResult);
      }
    }
  });

  socket.on('remove:passage', function(fullReference) {
    var i, passage;
    for (i=0; i < passages.length; i++) {
      passage = passages[i];
      if (fullReference === passage.passage) {
        passages.splice(i, 1);
        break;
      }
    }
    socket.broadcast.emit('remove:passage', {
      passage: fullReference
    });
  });

  /** Chatroom socket stuff **/

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
