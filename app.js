var express = require('express');
var app = express();
var serv = require('http').Server(app);

var socketList = {};


app.get('/', function(req, res) {
	res.sendFile(__dirname + '/client/index.html');
});

app.use('/client',express.static(__dirname + '/client'));

serv.listen(2000); //port 2000

console.log("Server started...");


var Entity = function() {
	var self = {
		x: 250,
		y: 250,
		speedX: 0,
		speedY: 0,
		id: "",
	}
		
	self.update = function() {
		self.updatePosition();
	}
	
	self.updatePosition = function(){
		self.x += self.speedX;
		self.y += self.speedY;
	}
	
	return self;
}

var Player = function(id) {
	var self = Entity();
	self.id = id;
	self.number = "" + Math.floor(10 * Math.random());
	self.pressingDown = false;
	self.pressingLeft = false;
	self.pressingRight = false;
	self.pressingUp = false;
	self.maxSpeed = 10;
	
	var super_update = self.update;
	
	self.update = function() {
		self.updateSpeed();
		super_update();
	}

	self.updateSpeed = function() {
		if (self.pressingRight) {
			self.speedX = self.maxSpeed;
		} else if (self.pressingLeft) {
			self.speedX = -self.maxSpeed;
		} else {
			self.speedX = 0;
		}
		
		if (self.pressingUp) {
			self.speedY = -self.maxSpeed;
		} else if (self.pressingDown) {
			self.speedY = self.maxSpeed;
		} else {
			self.speedY = 0;
		}
	}
	
	Player.list[id] = self;
	return self; 
}

Player.list = {};

Player.onConnect = function(socket) {
	var player = Player(socket.id);
	socket.on('keyPress', function(data) {
		
		if (data.inputId === 'left') {
			player.pressingLeft = data.state;
		}
		
		if (data.inputId === 'right') {
			player.pressingRight = data.state;
		}
		
		if (data.inputId === 'up') {
			player.pressingUp = data.state;
		}
		
		if (data.inputId === 'down') {
			player.pressingDown = data.state;
		}
	});
}

Player.onDisconnect = function(socket){
	delete Player.list[socket.id];
}

Player.update = function () {
	
	if (Math.random() < 0.1) {
		Bullet(Math.random() * 360);
	}
	
	var pack = [];
	
	for (var i in Player.list) {
		//Loops through each currently connected socket
		var player = Player.list[i];
		player.update();
		pack.push({
			x:player.x,
			y:player.y,
			number:player.number
		});
	}
	return pack;
}

var Bullet = function (theta) {
	var self = Entity();
	self.id = Math.random();
	
	self.speedX = Math.cos(theta / 180 * Math.PI) * 10;
	self.speedY = Math.sin(theta / 180 * Math.PI) * 10;
	
	self.timer = 0;
	self.toRemove = false;
	var super_update = self.update;
	
	self.update = function(){
		if (self.timer++ > 100) {
			self.toRemove = true;
		}
		super_update();
	}
	Bullet.list[self.id] = self;
	return self;
}

Bullet.list = {};

Bullet.update = function () {
	var pack = [];
	
	for (var i in Bullet.list) {
		//Loops through each currently connected socket
		var b = Bullet.list[i];
		b.update();
		pack.push({
			x:b.x,
			y:b.y
		});
	}
	return pack;
}



var io = require('socket.io') (serv, {});
io.sockets.on('connection', function(socket){
	//Upon connection to the server, each socket is given unique properties.
	socket.id = Math.random();
	socketList[socket.id] = socket;

	Player.onConnect(socket);
	console.log('New socket connected...');
	
	//if socket is disconnected, it is then deleted
	socket.on('disconnect', function() {
		delete socketList[socket.id];
		Player.onDisconnect(socket);
	});
});

setInterval(function(){
	//Server update function
	
	var pack = {
		player: Player.update(),
		bullet: Bullet.update()
	}
	
	for (var i in socketList) {
		//Sends clients back the updated information
		var socket = socketList[i];
		socket.emit('newPosition', pack);
	}
	
}, 1000/25.0 /*25 frames/second*/);


