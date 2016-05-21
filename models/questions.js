'use strict';

var mongoose = require('mongoose');
var random = require('mongoose-simple-random');

var questionSchema = new mongoose.Schema({
	author: String,
	date: Date,
	dateUpdated: { type: Date, default: Date.now },
	question: String,
	choices: Array,
	answer: String,
	category: String,
	accepted: { type: Boolean, default: false }
});

questionSchema.plugin(random);

var question = mongoose.model('question', questionSchema);

module.exports = question;