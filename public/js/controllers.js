'use strict';

/* Controllers */

angular.module('myApp.controllers', []).
  controller('AppCtrl', function ($scope, socket, $timeout) {
    socket.on('init', function (data) {
      $scope.name = data.name;
      $scope.users = data.users;
      $scope.passages = data.passages;
    });

    /* CRBS stuff */
    $scope.addPassage = function() {
      console.log($scope.userPassageRef);
      socket.emit('add:passage', { userPassageRef: $scope.userPassageRef }, function(result, msg) {
        if (!result) {
          alert(msg);
        } else {
          $scope.passages.push(result);
          $scope.userPassageRef = "";
        }
      });
    }

    $scope.removePassage = function(index) {
      // update this client's data
      var removedPassage = $scope.passages.splice(index, 1)[0];

      // emit to server
      socket.emit('remove:passage', removedPassage.passage);
    }

    $scope.updatePassage = function(index, socketEvent, params) {
      var passage = $scope.passages[index];
      passage.loading = true
      params = $.extend(params, { passage: passage, index: index, translation: passage.translation });
      console.log(params);
      socket.emit(socketEvent, params, function(result, msg) {
        console.log(result);
        if (result) {
          $scope.passages[index] = result;
        } else {
          alert(msg);
        }
      });
    }

    $scope.prevChapter = function(index) {
      $scope.updatePassage(index, 'prevchapter');
    }

    $scope.nextChapter = function(index) {
      $scope.updatePassage(index, 'nextchapter');
    }

    $scope.expandChapter = function(index) {
      $scope.updatePassage(index, 'expandchapter');
    }

    $scope.changeTranslation = function(index) {
      $scope.updatePassage(index, 'changetranslation');
    }

    socket.on('add:passage', function(data) {
      console.log(data);
      $scope.passages.push(data);
    });

    socket.on('remove:passage', function(data) {
      var i, passage;
      for (i=0; i < $scope.passages.length; i++) {
        passage = $scope.passages[i];
        if (data.passage === passage.passage) {
          $scope.passages.splice(i, 1);
          break;
        }
      }
    });

    socket.on('update:passage', function(data)  {
      console.log(data);
      $scope.passages[data.index] = data.passage;
    });

    /** Chatroom stuff **/
    socket.on('send:message', function(message) {
      $scope.messages.push(message);
      $timeout(function() {
        $("#message-list").scrollTop($("#message-list")[0].scrollHeight);
      });
    });

    socket.on('change:name', function(data) {
      changeName(data.oldName, data.newName);
    });

    socket.on('user:join', function(data) {
      $scope.messages.push({
        user: 'chatroom',
        text: 'User ' + data.name + ' has joined'
      });
      $scope.users.push(data.name);
    });

    socket.on('user:left', function(data) {
      $scope.messages.push({
        user: 'chatroom',
        text: 'User ' + data.name + ' has left'
      });
      var i, user;
      for (i=0; i < $scope.users.length; i++) {
        user = $scope.users[i];
        if (user == data.name) {
          $scope.users.splice(i,1);
          break;
        }
      }
    });
    var changeName = function(oldName, newName) {
      var i;
      for (i=0; i < $scope.users.length; i++) {
        if ($scope.users[i] === oldName) {
          $scope.users[i] = newName;
        }
      }

      $scope.messages.push({
        user: 'chatroom',
        text: 'User ' + oldName + ' is now known as ' + newName + '.'
      });
    }

    $scope.changeName = function() {
      socket.emit('change:name', {
        name: $scope.newName
      }, function(result) {
        if (!result) {
          alert("There was an error changing your name");
        } else {
          changeName($scope.name, $scope.newName);
          $scope.name = $scope.newName;
          $scope.newName = '';
        }
      });
    }

    $scope.sendMessage = function() {
      socket.emit('send:message', {
        message: $scope.message
      });

      // add message to our model locally
      $scope.messages.push({
        user: $scope.name,
        text: $scope.message
      });

      // clear message box
      $scope.message = '';

      $timeout(function() {
        $("#message-list").scrollTop($("#message-list")[0].scrollHeight);
      });
    }
  });
