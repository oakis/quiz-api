'use strict';

var express = require('express');
var app = express();


// Models
var question = require('./models/questions');
var user = require('./models/users');
var game = require('./models/games');

var mongoose = require('mongoose');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var jwt = require('jsonwebtoken');
var cors = require('cors');

var config = require('./config');

// Load database
mongoose.connect(config.database, function(err) {
    if (err) throw err;
    console.log('MongoDB successfully connected.')
});

// Logger
app.use(morgan('dev'));

// Parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// CORS
app.use(cors());

// Function

function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

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
    'username': new RegExp(["^", req.body.username, "$"].join(""), "i")
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
	          expiresIn: '30d' // 30 days
	        });

	        // return the information including token as JSON
	        console.log('Token success')
	        res.json({
	          success: true,
	          username: foundUser.username,
	          token: token,
	          role: foundUser.role
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
    user.findOne({ $or: [ { username: { $regex: req.body.username, $options: 'i' } },{ email: { $regex: req.body.email, $options: 'i' } } ] }, function(err, foundUser) {
      if (err) console.log(err);
      if (!foundUser) { // if user doesn't exist, register
      	user.create(req.body ,function(err){
      		if (err) {
      			console.log(err);
      			res.json({ success: false, message: 'User could not be saved.', exists: false })
      		} else {
      			res.json({ success: true, message: 'Successfully created new user '+req.body.username+'.', user: req.body.username, exists: false });
      		}
      	})
      } else if (new RegExp('^'+foundUser.email+'$', "i").test(req.body.email)) { // if email already exists, abort
      	console.log('2')
      	res.json({ success: false, message: 'E-mail is already registered.', exists: true, error: 'email', email: req.body.email });
      } else if (new RegExp('^'+foundUser.username+'$', "i").test(req.body.username)) { // if user already exists, abort
      	console.log('3')
      	res.json({ success: false, message: 'Username is already registered.', exists: true, error: 'username', user: req.body.username });
      } else {
      	console.log('4')
      	res.json({ success: false });
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
        return res.status(403).json({ success: false, message: 'Failed to authenticate token.' });    
      } else {
        // if everything is good, save to request for use in other routes
        req.decoded = decoded;
        next();
      }
    });

  } else {

    // if there is no token
    // return an error
    return res.status(403).json({ 
        success: false, 
        message: 'No token provided.' 
    });
    
  }
});

//############
//### USER ###
//############

// Current user
app.get('/user/:username', function (req, res, next) {
	user.findOne({ username: req.params.username }, 'username totalPoints', function(err, currentUser){
		console.log(currentUser)
		if (err) throw err;

		if (!currentUser) {
			console.log('no user found')
			res.status(403).json({ message: 'Could not fetch user '+req.params.username+' from database.' });
		} else {
			console.log('user found')
			res.status(200).json({ message: 'User loaded.', user: currentUser });
		}
	});
});

// Update role
app.put('/role/:username', function (req, res, next) {
	console.log(req.body);
	console.log(req.params.username);
	user.findOneAndUpdate({ username: req.params.username }, { $set: { role: req.body.role } }, function(err, userRole){
		if(err) {
			res.status(500).json({ message: 'Something went wrong.' });
		} else {
			res.status(200).json({ message: 'User role updated.' });
		}
	});
});

//#################
//### QUESTIONS ###
//#################

app.get('/question/:accepted', function (req, res, next) {

  question.findRandom({ accepted: req.params.accepted }, {}, {limit: 5}, function(err, result) {
			if(err) {
				res.status(500).json({ message: 'Could not fetch question from database.' });
			} else {
				res.status(200).json({ message: 'Question loaded.', question: result });
			}
  });

});

app.get('/questionstats', function (req, res, next) {

  question.aggregate([
  	{ $match: { accepted: true } },
  	{ $group : { _id : "$author", sum: { $sum: 1 } } }
  	], function(err, result) {
			if(err) {
				res.status(500).json({ message: 'Could not fetch questions from database.' });
			} else {
				res.status(200).json({ message: 'Question loaded.', question: result });
			}
  });

});

app.post('/question', function (req, res, next) {
	function roleCheck (role) {
		if (role == 'admin' || role == 'trusted') {
			return true;
		} else if (role == 'user') {
			return false;
		}
		return false;
	}
	question.create({ 
		author: req.body.author,
		date: Date.now(),
		question: req.body.question,
		choices: req.body.choices.split(','),
		answer: req.body.answer,
		category: req.body.category,
		accepted: roleCheck(req.body.role)
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
	console.log('Params id:',req.params.id);
	console.log('Body:',req.body);
	question.update({ _id: req.params.id },
		{$set:{ 
			dateUpdated: Date.now(),
			question: req.body.question,
			choices: req.body.choices.split(','),
			answer: req.body.answer
		 }}, function (err, question) {
	  if (err) {
	  	res.status(500).json({ message: 'Could not update question.' });
	  } else {
	  	res.status(200).json({ message: 'Question '+req.params.id+' was successfully updated.' });
	  };
	});
});

app.put('/accept', function (req, res) {
	question.update({ _id: req.body.id },
		{$set:{ 
			accepted: true
		 }}, function (err, question) {
	  if (err) {
	  	res.status(500).json({ message: 'Could not update question.' });
	  } else {
	  	res.status(200).json({ message: 'Question '+req.body.id+' was successfully accepted.' });
	  };
	});
});

//#############
//### STATS ###
//#############

// All users
app.get('/users', function (req, res, next) {
	user.find({}, 'username role totalPoints', function(err, users){
		if(err) {
			res.status(500).json({ message: 'Could not fetch users from database.' });
		} else {
			res.status(200).json({ message: 'Users loaded.', users: users });
		}
	});
});

app.get('/stats', function (req, res, next) {
	var statsData = [];
	var obj = {};
	user.aggregate([ { $group: { _id: null, sum: { $sum: "$totalPoints" } } } ], function(err, points){
		if(err) {
			res.status(500).json({ message: 'Could not fetch stats from database.' });
		} else {
			var obj = {
				'name': 'Total poäng',
				'sum': points[0].sum
			};
			statsData.push(obj);
		}
	});
	user.find({}, 'username', function(err, users){
		var obj = {};
		if(err) {
			res.status(500).json({ message: 'Could not fetch stats from database.' });
		} else {
			var obj = {
				'name': 'Antal användare',
				'sum': users.length
			};
			statsData.push(obj);
			question.aggregate([ { $match: { accepted: true } } ], function(err, accepted){
				var obj = {};
				if(err) {
					res.status(500).json({ message: 'Could not fetch stats from database.' });
				} else {
					var obj = {
						'name': 'Antal godkända frågor',
						'sum': accepted.length
					};
					statsData.push(obj);
					question.aggregate([ { $match: { accepted: false } } ], function(err, accepted){
						var obj = {};
						if(err) {
							res.status(500).json({ message: 'Could not fetch stats from database.' });
						} else {
							var obj = {
								'name': 'Antal icke godkända frågor',
								'sum': accepted.length
							};
							statsData.push(obj);
							res.status(200).json(statsData);
						}
					});
				}
			});
		}
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

app.post('/game/queue', function(req,res,next) {
	game.findOneAndUpdate({ $and: [ { player2: null },{ player1: { $ne: req.body.username } } ] }, { $set: { player2: req.body.username, gameActive: true } }, function (err, data) {
		if (err) throw err;
		if (!data) {
			console.log('1')
			// get questions for game
			question.findRandom({ accepted: true }, {}, {limit: 10}, function(err, questions) {
				if(err) throw err;
				var questionsArr = [];
				for (var q of questions) {
		      questionsArr.push({
		        _id: q._id,
		        question: q.question,
		        choices: shuffleArray(q.choices),
		        answer: q.answer
		      });
		    }
		    shuffleArray(questionsArr);
				// then create game
				game.create({ player1: req.body.username, questions: questionsArr }, function (err, data) {
					if (err) throw err;
					console.log('2')
					res.json({ success: true, message: 'User '+req.body.username+' created a new game.' });
				});
		  });
		} else if (data.player1 != req.body.username) {
			console.log('3')
			res.json({ success: true, message: 'User '+req.body.username+' joined '+data.player1+' game.' });
		} else {
			console.log('4')
			res.json({ success: false, message: 'User '+req.body.username+' is already queued for a game.' });
		}
	})
})

app.post('/game/lfm', function (req,res,next) {
	game.findOne({ $and: [ { $or: [ { player1: req.body.username },{ player2: req.body.username } ] }, { gameActive: true }, { player2: { $ne: null } } ] }, function (err, data) {
		if (err) throw err;
		if (data) {
			console.log('success')
			res.json({ success: true, data: data })
		} else {
			res.json({ success: false })
		}
	})
})

// Get active or finnished games
app.post('/game/matches/:active/:finnished', function (req,res,next) {
	game.find({ $and: [ { $or: [ { player1: req.body.username },{ player2: req.body.username } ] }, { gameActive: req.params.active }, { gameOver: req.params.finnished } ] }, function (err, data) {
		if (err) throw err;
		res.json(data);
	})
})

// Get match by ID
app.get('/game/getmatch/:id', function (req,res,next) {
	game.find({ _id: req.params.id }, function (err, data) {
		if (err) throw err;
		res.json(data);
	})
})

// Get all matches and check win/loss
app.get('/game/getmatches', function (req,res,next) {
	game.aggregate([
    { 
        $project: { 
            scores: [
                { name: '$winner', wins: { $literal: 1 }, losses: { $literal: 0 }, tied: { $literal: 0 } }, 
                { name: '$loser', wins: { $literal: 0 }, losses: { $literal: 1 }, tied: { $literal: 0 } },
     					  { name: '$player1', wins: { $literal: 0 }, losses: { $literal: 0 }, tied: { $cond: [ "$tied", 1, 0 ] } },
        				{ name: '$player2', wins: { $literal: 0 }, losses: { $literal: 0 }, tied: { $cond: [ "$tied", 1, 0 ] } }
            ] 
        } 
    }, 
    { 
        $unwind: '$scores' 
    }, 
    { 
        $group: {
             _id: "$scores.name", 
            wins: { $sum: "$scores.wins" }, 
            losses: { $sum: "$scores.losses" },
    tied: { $sum: "$scores.tied" }
        } 
    }
], function (err, data) {
		if (err) throw err;
		var listToDelete = [null, 'tie'];
		var newData = data.filter(function(obj) {
		    return listToDelete.indexOf(obj._id) === -1;
		});
		for (var user of newData) {
      user.ratio = user.wins / (user.losses + user.wins + user.tied) * 100;   
    }
		console.log(newData);
		res.json(newData);
	})
})

app.post('/game/savescore/', function (req,res,next) {

	var isOver = false;
	var theWinner;
	var theLoser;
	var isItTied = false;

	game.find({ _id: req.body.gameId }, function (err, data) {
		if (err) throw err;

		var data = data[0];

		if (data.player1 == req.body.username) {
			if (data.player2Played) {
				isOver = true;
				if (data.player2Played && req.body.score > data.score2) {
					theWinner = data.player1;
					theLoser = data.player2;
				} else if (data.player2Played && req.body.score < data.score2) {
					theWinner = data.player2;
					theLoser = data.player1;
				} else {
					theWinner = 'tie';
					isItTied = true;
				}
			}
			console.log('theWinner:',theWinner);
			game.findOneAndUpdate({ _id: req.body.gameId },{ $set: { score1: req.body.score, player1Played: true, gameOver: isOver, gameActive: !isOver, winner: theWinner, loser: theLoser, tied: isItTied } }, function (err,newdata) {
			})
		} else if (data.player2 == req.body.username) {
			if (data.player1Played) {
				isOver = true;
				if (data.player1Played && data.score1 > req.body.score) {
					theWinner = data.player1;
					theLoser = data.player2;
				} else if (data.player1Played && data.score1 < req.body.score) {
					theWinner = data.player2;
					theLoser = data.player1;
				} else {
					theWinner = 'tie';
					isItTied = true;
				}
			}
			console.log('theWinner:',theWinner);
			game.findOneAndUpdate({ _id: req.body.gameId },{ $set: { score2: req.body.score, player2Played: true, gameOver: isOver, gameActive: !isOver, winner: theWinner, loser: theLoser, tied: isItTied } }, function (err,newdata) {
			})
		}
	})
	res.json({ message: 'success, score added lol' })
})

// Start server
app.listen(80, function() {
    console.log("The API is running on port 80!");
});