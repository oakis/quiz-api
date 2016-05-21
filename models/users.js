'use strict';

var mongoose = require('mongoose');
var bcrypt = require("bcryptjs")

var userSchema = new mongoose.Schema({
	username: {
  	type: String,
  	unique: true,
  	required: true
  }, 
  email: {
  	type: String,
    unique: true,
    required: true
  },
  role: {
  	type: String,
  	enum: ['user','admin','trusted'], // set available account types
  	default: 'user' // default to user
  },
  password: String,
  totalPoints: {
    type: Number,
    default: 0
  }
});

userSchema.pre('save', function (next) {
    var user = this;
    if (this.isModified('password') || this.isNew) {
        bcrypt.genSalt(10, function (err, salt) {
            if (err) {
                return next(err);
            }
            bcrypt.hash(user.password, salt, function (err, hash) {
                if (err) {
                    return next(err);
                }
                user.password = hash;
                next();
            });
        });
    } else {
        return next();
    }
});

userSchema.methods.comparePassword = function (passw, cb) {
    bcrypt.compare(passw, this.password, function (err, isMatch) {
        if (err) {
            return cb(err);
        }
        cb(null, isMatch);
    });
};

module.exports = mongoose.model('user', userSchema);