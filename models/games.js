'use strict';

var mongoose = require('mongoose');

var gameSchema = new mongoose.Schema({
	player1: {
  	type: String,
  	required: true
  }, 
  player2: {
  	type: String,
    required: true
  },
  score1: {
    type: Number,
    required: true
  }, 
  score2: {
    type: Number,
    required: true
  },
  dateOfMatch: {
    type: Date,
    default: Date.now()
  }

});

var game = mongoose.model('game', gameSchema);

module.exports = game;