'use strict';

var express = require('express');
var question = require('./models/questions');
var user = require('./models/users');
var mongoose = require('mongoose');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var jwt = require('jsonwebtoken');
var cors = require('cors');

var config = require('./config');

var app = express();

// Load database
mongoose.connect(config.database);

// Logger
app.use(morgan('dev'));

// Parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// CORS
app.use(cors());

// Api routes


//############
//### ROOT ###
//############

app.get('/', function (req, res, next) {
	res.status(200).json({message: 'This is the root of the API.'});
});

//############
//#REG  LOGIN#
//############

app.post('/login', function(req, res) {

  // find the user
  user.findOne({
    username: req.body.username
  }, function(err, foundUser) {

    if (err) throw err;

    if (!foundUser) {
    	console.log('user not found')
      res.json({ success: false, message: 'Authentication failed. User not found.' });
    } else if (foundUser) {

    	console.log('user found')

      // check if password matches
      foundUser.comparePassword(req.body.password, function(err, isMatch) {
        if (isMatch && !err) {
	        // if user is found and password is right
	        // create a token
	        var token = jwt.sign(foundUser, config.secret, {
	          expiresIn: 999999 // expires in 24 hours
	        });

	        // return the information including token as JSON
	        console.log('Token success')
	        res.json({
	          success: true,
	          username: foundUser.username,
	          token: token
	        });
      	} else {
      		console.log('wrong password')
      		res.json({ success: false, message: 'Authentication failed. Wrong password.' });
      	}   
			});
    }

  });
});

app.post('/register', function(req,res){
  // check if all fields are filled in
  if (req.body.username!=undefined || req.body.password!=undefined || req.body.email!=undefined) {
  	// check db for username
    user.findOne({ $or: [ { username: req.body.username },{ email: req.body.email } ] }, function(err, foundUser) {
      if (err) throw err;
      console.log(foundUser);
      if (!foundUser) { // if user doesn't exist, register
      	user.create(req.body ,function(err){
      		if (err) {
      			console.log(err);
      			res.json({ success: false, message: 'User could not be saved.', exists: false })
      		} else {
      			res.json({ success: true, message: 'Successfully created new user '+req.body.username+'.', user: req.body.username, exists: false });
      		}
      	})
      } else if (foundUser) { // if user already exists, abort
      	res.json({ success: false, message: 'Username or E-mail is already registered.', exists: true, user: req.body.username });
      }
    });
  } else {
    res.json({ success: false, message: 'All fields must be filled in.', exists: false });
  }
});

//############
//### AUTH ###
//############

app.use(function(req, res, next) {

  // check header or url parameters or post parameters for token
  var token = req.body.token || req.query.token || req.headers['x-access-token'];

  // decode token
  if (token) {

    // verifies secret and checks exp
    jwt.verify(token, config.secret, function(err, decoded) {      
      if (err) {
        return res.json({ success: false, message: 'Failed to authenticate token.' });    
      } else {
        // if everything is good, save to request for use in other routes
        req.decoded = decoded;
        next();
      }
    });

  } else {

    // if there is no token
    // return an error
    return res.status(403).send({ 
        success: false, 
        message: 'No token provided.' 
    });
    
  }
});

//############
//### USER ###
//############

// All users
app.get('/users', function (req, res, next) {
	user.find({}, /*'username totalPoints',*/ function(err, users){
		if(err) {
			res.status(500).json({ message: 'Could not fetch users from database.' });
		} else {
			res.status(200).json({ message: 'Users loaded.', users: users });
		}
	});
});

// Current user
app.get('/user/:username', function (req, res, next) {
	user.findOne({ username: req.params.username }, 'username totalPoints', function(err, currentUser){
		if(err) {
			res.status(500).json({ message: 'Could not fetch user '+req.params.username+' from database.' });
		} else {
			res.status(200).json({ message: 'User loaded.', user: currentUser });
		}
	});
});

//#################
//### QUESTIONS ###
//#################

app.get('/question', function (req, res, next) {

  question.findRandom({}, {}, {limit: 3}, function(err, result) {
			if(err) {
				res.status(500).json({ message: 'Could not fetch question from database.' });
			} else {
				res.status(200).json({ message: 'Question loaded.', question: result });
			}
  });

});

app.post('/question', function (req, res, next) {
	question.create({ 
		author: req.body.author,
		date: Date.now(),
		question: req.body.question,
		choices: req.body.choices.split(','),
		answer: req.body.answer,
		category: req.body.category
	 }, function (err, question) {
	  if (err) {
	  	res.status(500).json({ message: 'Could not create question.' });
	  } else {
	  	res.status(200).json({ message: 'Question '+question._id+' was successfully created.' });
	  };
	})
});

app.delete('/question/:id', function (req, res) {
	question.remove({ _id: req.params.id }, function (err) {
	  if (err) {
	  	res.status(500).json({ message: 'Could not delete question.' });
	  } else {
	  	res.status(200).json({ message: 'Question '+req.params.id+' was successfully deleted.' });
	  };
	});
});

app.put('/question/:id', function (req, res) {
	question.update({ _id: req.params.id },
		{$set:{ 
			author: req.body.author,
			dateUpdated: Date.now(),
			question: req.body.question,
			choices: req.body.choices.split(','),
			answer: req.body.answer,
			category: req.body.category,
			accepted: req.body.accepted
		 }}, function (err, question) {
	  if (err) {
	  	res.status(500).json({ message: 'Could not update question.' });
	  } else {
	  	res.status(200).json({ message: 'Question '+req.params.id+' was successfully updated.' });
	  };
	});
});

//############
//### GAME ###
//############

// Save user score
app.post('/userscore', function (req, res) {

	user.findOne({ username: req.body.username }, 'totalPoints', function(err,userScore){
		if (err) {
	  	res.status(500).json({ message: 'Could not find user.' });
	  } else {
	  	var updatedScore = parseInt(userScore.totalPoints) + parseInt(req.body.newScore);
	  	user.update({ username: req.body.username },
	  		{$set:{
	  			totalPoints: updatedScore
	  		}}, function (err, result) {
	  			if (err) {
				  	res.status(500).json({ message: 'Could not update score.' });
				  } else {
				  	res.status(200).json({ newScore: updatedScore });
				  };
	  		});
	  };
	})

});

// Start server
app.listen(80, function() {
    console.log("The API is running on port 80!");
});