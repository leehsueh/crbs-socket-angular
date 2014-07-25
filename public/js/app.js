'use strict';

// Declare app level module which depends on filters, and services

var app = angular.module('myApp', [
  'ngSanitize',
  'myApp.controllers',
  'myApp.filters',
  // 'myApp.services',
  'myApp.directives',

  // 3rd party dependencies
  // 'btford.socket-io'
]);

