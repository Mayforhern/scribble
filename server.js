const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const serveStatic = require('serve-static');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(serveStatic(path.join(__dirname, 'public')));

// Game state
const rooms = {};
const users = {};

// Word list for the game
const words = [
  'apple', 'banana', 'car', 'dog', 'elephant', 'flower', 'guitar', 
  'house', 'ice cream', 'jellyfish', 'kite', 'lion', 'mountain',
  'notebook', 'ocean', 'pizza', 'queen', 'robot', 'sun', 'tree',
  'umbrella', 'violin', 'whale', 'xylophone', 'yacht', 'zebra',
  'airplane', 'beach', 'cat', 'dinosaur', 'earth', 'football',
  'giraffe', 'helicopter', 'island', 'jungle', 'kangaroo', 'lighthouse',
  'monkey', 'night', 'orange', 'penguin', 'rainbow', 'snake', 'tiger',
  'unicorn', 'volcano', 'waterfall', 'fox', 'yogurt', 'zoo'
];

// Get a random word
function getRandomWord() {
  return words[Math.floor(Math.random() * words.length)];
}

// Create a new room
function createRoom(hostId, hostName) {
  const roomId = uuidv4().substring(0, 6);
  rooms[roomId] = {
    id: roomId,
    hostId: hostId,
    players: [{
      id: hostId,
      name: hostName,
      score: 0,
      isDrawing: true
    }],
    currentWord: getRandomWord(),
    gameState: 'waiting', // waiting, drawing, roundEnd
    roundTimer: 60,
    timerInterval: null,
    messages: [],
    drawing: []
  };
  return roomId;
}

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Create or join a game room
  socket.on('joinGame', ({ userData, roomId }) => {
    const user = {
      id: socket.id,
      name: userData.name || `Player${Math.floor(Math.random() * 1000)}`,
      initials: userData.initials || userData.name?.charAt(0)?.toUpperCase() || 'P'
    };
    
    users[socket.id] = user;
    
    // Create new room if no roomId provided
    if (!roomId) {
      const newRoomId = createRoom(socket.id, user.name);
      socket.join(newRoomId);
      socket.emit('gameJoined', { 
        roomId: newRoomId, 
        players: rooms[newRoomId].players,
        currentPlayer: rooms[newRoomId].players[0],
        isHost: true
      });
      console.log(`Created new room: ${newRoomId}`);
      return;
    }
    
    // Join existing room
    if (rooms[roomId]) {
      const room = rooms[roomId];
      
      // Check if game is in progress
      if (room.gameState === 'drawing') {
        socket.emit('gameInProgress');
        return;
      }
      
      // Add player to room
      room.players.push({
        id: socket.id,
        name: user.name,
        score: 0,
        isDrawing: false
      });
      
      socket.join(roomId);
      
      // Send updated player list to everyone in the room
      io.to(roomId).emit('playerJoined', {
        player: {
          id: socket.id,
          name: user.name,
          score: 0
        },
        players: room.players
      });
      
      // Send game state to new player
      socket.emit('gameJoined', { 
        roomId, 
        players: room.players,
        currentPlayer: room.players.find(p => p.isDrawing),
        isHost: room.hostId === socket.id,
        drawing: room.drawing
      });
      
      console.log(`Player ${user.name} joined room ${roomId}`);
    } else {
      socket.emit('roomNotFound');
    }
  });
  
  // Start the game
  socket.on('startGame', ({ roomId }) => {
    const room = rooms[roomId];
    
    if (!room || room.hostId !== socket.id) {
      return;
    }
    
    if (room.players.length < 2) {
      socket.emit('needMorePlayers');
      return;
    }
    
    // Select first player as drawer
    room.players.forEach(player => {
      player.isDrawing = player.id === room.players[0].id;
    });
    
    room.gameState = 'drawing';
    room.currentWord = getRandomWord();
    room.roundTimer = 60;
    
    // Send word to the drawer
    const drawer = room.players.find(p => p.isDrawing);
    io.to(drawer.id).emit('yourTurn', { word: room.currentWord });
    
    // Send game started to all players
    io.to(roomId).emit('gameStarted', {
      drawer: drawer,
      roundTimer: room.roundTimer
    });
    
    // Start round timer
    room.timerInterval = setInterval(() => {
      room.roundTimer--;
      
      if (room.roundTimer <= 0) {
        clearInterval(room.timerInterval);
        endRound(roomId, null);
      } else {
        io.to(roomId).emit('timerUpdate', { timer: room.roundTimer });
      }
    }, 1000);
  });
  
  // Handle drawing events
  socket.on('draw', ({ roomId, action }) => {
    const room = rooms[roomId];
    
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    
    if (!player || !player.isDrawing) return;
    
    // Store drawing action
    room.drawing.push(action);
    
    // Broadcast to all other players
    socket.to(roomId).emit('drawEvent', action);
  });
  
  // Clear canvas
  socket.on('clearCanvas', ({ roomId }) => {
    const room = rooms[roomId];
    
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    
    if (!player || !player.isDrawing) return;
    
    room.drawing = [];
    io.to(roomId).emit('canvasCleared');
  });
  
  // Handle chat message / guess
  socket.on('sendMessage', ({ roomId, message }) => {
    const room = rooms[roomId];
    
    if (!room) return;
    
    const player = room.players.find(p => p.id === socket.id);
    
    if (!player) return;
    
    // Check if player is guessing and not the drawer
    if (room.gameState === 'drawing' && !player.isDrawing) {
      // Check if the message matches the word (case insensitive)
      if (message.toLowerCase() === room.currentWord.toLowerCase()) {
        // Correct guess!
        player.score += 10;
        
        // Send message that player guessed correctly
        const correctMessage = {
          id: Date.now(),
          sender: 'Game',
          text: `${player.name} guessed the word!`,
          isSystem: true
        };
        
        room.messages.push(correctMessage);
        io.to(roomId).emit('newMessage', correctMessage);
        
        // Update scores
        io.to(roomId).emit('scoreUpdate', { players: room.players });
        
        // Check if all players have guessed
        const nonDrawingPlayers = room.players.filter(p => !p.isDrawing);
        const allGuessed = nonDrawingPlayers.every(p => {
          const playerMessages = room.messages.filter(m => 
            m.sender === p.name && 
            m.text.toLowerCase() === room.currentWord.toLowerCase()
          );
          return playerMessages.length > 0;
        });
        
        if (allGuessed) {
          endRound(roomId, null);
        }
        
        return;
      }
    }
    
    // Normal message
    const newMessage = {
      id: Date.now(),
      sender: player.name,
      text: message,
      isSystem: false
    };
    
    room.messages.push(newMessage);
    io.to(roomId).emit('newMessage', newMessage);
  });
  
  // Disconnect handler
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Find rooms where this player is
    Object.keys(rooms).forEach(roomId => {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        
        // Remove player from room
        room.players.splice(playerIndex, 1);
        
        // Notify others
        io.to(roomId).emit('playerLeft', { 
          playerId: socket.id,
          playerName: player.name,
          players: room.players
        });
        
        // If room is empty, remove it
        if (room.players.length === 0) {
          clearInterval(room.timerInterval);
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted (empty)`);
          return;
        }
        
        // If host left, assign new host
        if (room.hostId === socket.id) {
          room.hostId = room.players[0].id;
          io.to(room.hostId).emit('youAreHost');
        }
        
        // If drawer left, end round and select new drawer
        if (player.isDrawing && room.gameState === 'drawing') {
          endRound(roomId, 'drawerLeft');
        }
      }
    });
    
    // Remove from users
    delete users[socket.id];
  });
});

// End round and select next player
function endRound(roomId, reason) {
  const room = rooms[roomId];
  
  if (!room) return;
  
  // Clear timer if it exists
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
  
  room.gameState = 'roundEnd';
  
  // Send end round message
  let message = "";
  if (reason === 'drawerLeft') {
    message = `The drawer left the game. The word was: ${room.currentWord}`;
  } else if (reason === 'allGuessed') {
    message = `Everyone guessed the word: ${room.currentWord}`;
  } else {
    message = `Time's up! The word was: ${room.currentWord}`;
  }
  
  const systemMessage = {
    id: Date.now(),
    sender: 'Game',
    text: message,
    isSystem: true
  };
  
  room.messages.push(systemMessage);
  io.to(roomId).emit('newMessage', systemMessage);
  
  // Send round end to all players
  io.to(roomId).emit('roundEnded', { 
    word: room.currentWord,
    reason: reason,
    players: room.players
  });
  
  // Clear drawing
  room.drawing = [];
  
  // Start next round after 5 seconds
  setTimeout(() => {
    // Find current drawer index
    const currentDrawerIndex = room.players.findIndex(p => p.isDrawing);
    
    // Select next player as drawer
    let nextDrawerIndex = (currentDrawerIndex + 1) % room.players.length;
    
    // Update players
    room.players.forEach((player, index) => {
      player.isDrawing = index === nextDrawerIndex;
    });
    
    // Get new word
    room.currentWord = getRandomWord();
    
    // Set game state to drawing
    room.gameState = 'drawing';
    room.roundTimer = 60;
    
    // Send word to the drawer
    const drawer = room.players[nextDrawerIndex];
    io.to(drawer.id).emit('yourTurn', { word: room.currentWord });
    
    // Start new round
    io.to(roomId).emit('newRound', {
      drawer: drawer,
      roundTimer: room.roundTimer
    });
    
    // Start round timer
    room.timerInterval = setInterval(() => {
      room.roundTimer--;
      
      if (room.roundTimer <= 0) {
        clearInterval(room.timerInterval);
        endRound(roomId, null);
      } else {
        io.to(roomId).emit('timerUpdate', { timer: room.roundTimer });
      }
    }, 1000);
  }, 5000);
}

// Routes
app.get('/api/rooms/:roomId', (req, res) => {
  const roomId = req.params.roomId;
  if (rooms[roomId]) {
    res.json({ 
      exists: true, 
      playerCount: rooms[roomId].players.length,
      inProgress: rooms[roomId].gameState === 'drawing'
    });
  } else {
    res.json({ exists: false });
  }
});

// Default route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 