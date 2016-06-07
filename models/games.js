'use strict';

var mongoose = require('mongoose');

var gameSchema = new mongoose.Schema({
	player1: {
  	type: String,
  	required: true
  }, 
  player2: {
  	type: String,
    default: null
  },
  score1: {
    type: Number,
    default: 0
  }, 
  score2: {
    type: Number,
    default: 0
  },
  gameActive: {
    type: Boolean,
    default: false
  },
  gameOver: {
    type: Boolean,
    default: false
  },
  dateOfMatch: {
    type: Date,
    default: Date.now()
  },
  questions: {
    type: Array,
    required: true
  },
  player1Played: {
    type: Boolean,
    default: false
  },
  player2Played: {
    type: Boolean,
    default: false
  },
  winner: {
    type: String
  },
  loser: {
    type: String
  },
  tied: {
    type: Boolean
  }

});

var game = mongoose.model('game', gameSchema);

module.exports = game;