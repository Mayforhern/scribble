// Initialize Telegram WebApp
const telegramWebApp = window.Telegram.WebApp;
telegramWebApp.expand();
telegramWebApp.ready();

// Initialize Socket.io
const socket = io();

// Game state variables
let currentRoom = null;
let isDrawing = false;
let isMyTurn = false;
let currentWord = '';
let roundNumber = 1;
let isHost = false;
let userData = {
    name: telegramWebApp.initDataUnsafe.user ? `${telegramWebApp.initDataUnsafe.user.first_name}` : '',
    id: telegramWebApp.initDataUnsafe.user ? telegramWebApp.initDataUnsafe.user.id : null,
    initials: telegramWebApp.initDataUnsafe.user ? telegramWebApp.initDataUnsafe.user.first_name.charAt(0) : 'P'
};

// Drawing state
let isMouseDown = false;
let currentColor = '#000000';
let currentThickness = 5;
let lastX = 0;
let lastY = 0;

// DOM Elements
const joinScreen = document.getElementById('joinScreen');
const lobbyScreen = document.getElementById('lobbyScreen');
const gameScreen = document.getElementById('gameScreen');
const createGameBtn = document.getElementById('createGameBtn');
const joinGameBtn = document.getElementById('joinGameBtn');
const nameForm = document.getElementById('nameForm');
const joinForm = document.getElementById('joinForm');
const playerName = document.getElementById('playerName');
const playerNameJoin = document.getElementById('playerNameJoin');
const roomCode = document.getElementById('roomCode');
const createRoom = document.getElementById('createRoom');
const joinRoom = document.getElementById('joinRoom');
const backToOptions = document.getElementById('backToOptions');
const backToOptionsJoin = document.getElementById('backToOptionsJoin');
const roomCodeDisplay = document.getElementById('roomCodeDisplay');
const copyRoomCode = document.getElementById('copyRoomCode');
const playersList = document.getElementById('playersList');
const startGameBtn = document.getElementById('startGameBtn');
const drawingCanvas = document.getElementById('drawingCanvas');
const wordDisplay = document.getElementById('wordDisplay');
const roundNumberDisplay = document.getElementById('roundNumber');
const timer = document.getElementById('timer');
const colorOptions = document.querySelectorAll('.color-option');
const thicknessSlider = document.getElementById('thicknessSlider');
const clearBtn = document.getElementById('clearBtn');
const messages = document.getElementById('messages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const drawingControls = document.getElementById('drawingControls');
const actionButtons = document.getElementById('actionButtons');
const roundEndModal = document.getElementById('roundEndModal');
const revealedWord = document.getElementById('revealedWord');
const scoresList = document.getElementById('scoresList');
const hintContainer = document.getElementById('hintContainer');
const errorModal = document.getElementById('errorModal');
const errorTitle = document.getElementById('errorTitle');
const errorMessage = document.getElementById('errorMessage');
const errorOkBtn = document.getElementById('errorOkBtn');

// Canvas setup
const ctx = drawingCanvas.getContext('2d');

// Use Telegram user info
if (userData.name) {
    playerName.value = userData.name;
    playerNameJoin.value = userData.name;
}

// Set canvas size
function resizeCanvas() {
    const container = drawingCanvas.parentElement;
    drawingCanvas.width = container.clientWidth;
    drawingCanvas.height = container.clientHeight;
    redrawCanvas();
}

// Initialize canvas
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Event listeners for join screen
createGameBtn.addEventListener('click', () => {
    joinScreen.querySelector('.join-options').classList.add('hidden');
    nameForm.classList.remove('hidden');
});

joinGameBtn.addEventListener('click', () => {
    joinScreen.querySelector('.join-options').classList.add('hidden');
    joinForm.classList.remove('hidden');
});

backToOptions.addEventListener('click', () => {
    nameForm.classList.add('hidden');
    joinScreen.querySelector('.join-options').classList.remove('hidden');
});

backToOptionsJoin.addEventListener('click', () => {
    joinForm.classList.add('hidden');
    joinScreen.querySelector('.join-options').classList.remove('hidden');
});

createRoom.addEventListener('click', () => {
    if (!playerName.value.trim()) {
        showError('Error', 'Please enter your name');
        return;
    }
    
    userData.name = playerName.value.trim();
    socket.emit('joinGame', { userData });
});

joinRoom.addEventListener('click', () => {
    if (!playerNameJoin.value.trim()) {
        showError('Error', 'Please enter your name');
        return;
    }
    
    if (!roomCode.value.trim() || roomCode.value.trim().length !== 6) {
        showError('Error', 'Please enter a valid 6-digit room code');
        return;
    }
    
    userData.name = playerNameJoin.value.trim();
    socket.emit('joinGame', { 
        userData, 
        roomId: roomCode.value.trim() 
    });
});

copyRoomCode.addEventListener('click', () => {
    navigator.clipboard.writeText(roomCodeDisplay.textContent)
        .then(() => {
            copyRoomCode.textContent = '✓';
            setTimeout(() => {
                copyRoomCode.textContent = '📋';
            }, 2000);
        });
});

startGameBtn.addEventListener('click', () => {
    if (isHost) {
        socket.emit('startGame', { roomId: currentRoom });
    }
});

// Drawing events
colorOptions.forEach(option => {
    option.addEventListener('click', () => {
        colorOptions.forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        currentColor = option.getAttribute('data-color');
    });
});

thicknessSlider.addEventListener('input', () => {
    currentThickness = parseInt(thicknessSlider.value);
});

clearBtn.addEventListener('click', () => {
    if (isMyTurn) {
        ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
        socket.emit('clearCanvas', { roomId: currentRoom });
    }
});

// Drawing functions
function startDrawing(e) {
    if (!isMyTurn) return;
    
    isMouseDown = true;
    
    const pos = getPosition(e);
    lastX = pos.x;
    lastY = pos.y;
    
    const action = {
        type: 'dot',
        x: lastX,
        y: lastY,
        color: currentColor,
        thickness: currentThickness
    };
    
    drawAction(action);
    socket.emit('draw', { roomId: currentRoom, action });
}

function draw(e) {
    if (!isMyTurn || !isMouseDown) return;
    
    const pos = getPosition(e);
    const currentX = pos.x;
    const currentY = pos.y;
    
    const action = {
        type: 'line',
        x0: lastX,
        y0: lastY,
        x1: currentX,
        y1: currentY,
        color: currentColor,
        thickness: currentThickness
    };
    
    drawAction(action);
    socket.emit('draw', { roomId: currentRoom, action });
    
    lastX = currentX;
    lastY = currentY;
}

function stopDrawing() {
    isMouseDown = false;
}

function getPosition(e) {
    let x, y;
    const rect = drawingCanvas.getBoundingClientRect();
    
    if (e.type.includes('touch')) {
        const touch = e.touches[0] || e.changedTouches[0];
        x = touch.clientX - rect.left;
        y = touch.clientY - rect.top;
    } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }
    
    return { x, y };
}

function drawAction(action) {
    if (action.type === 'dot') {
        ctx.beginPath();
        ctx.arc(action.x, action.y, action.thickness / 2, 0, Math.PI * 2);
        ctx.fillStyle = action.color;
        ctx.fill();
    } else if (action.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(action.x0, action.y0);
        ctx.lineTo(action.x1, action.y1);
        ctx.strokeStyle = action.color;
        ctx.lineWidth = action.thickness;
        ctx.lineCap = 'round';
        ctx.stroke();
    }
}

function redrawCanvas() {
    // Nothing to redraw yet - this will be populated from socket events
}

// Chat functionality
sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    socket.emit('sendMessage', {
        roomId: currentRoom,
        message
    });
    
    chatInput.value = '';
}

function addMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');
    
    if (message.isSystem) {
        messageElement.classList.add('system-message');
        messageElement.innerHTML = `<span class="message-text">${message.text}</span>`;
    } else {
        messageElement.innerHTML = `<span class="message-sender">${message.sender}:</span><span class="message-text">${message.text}</span>`;
    }
    
    messages.appendChild(messageElement);
    messages.scrollTop = messages.scrollHeight;
}

// Update players list
function updatePlayersList(players, hostId) {
    playersList.innerHTML = '';
    
    players.forEach(player => {
        const isDrawingPlayer = player.isDrawing;
        const isHostPlayer = player.id === hostId;
        
        const playerElement = document.createElement('div');
        playerElement.classList.add('player-item');
        
        const initial = player.name.charAt(0).toUpperCase();
        
        playerElement.innerHTML = `
            <div class="player-avatar">${initial}</div>
            <div class="player-info">
                <span class="player-name">${player.name}</span>
                ${isHostPlayer ? '<span class="player-host-badge">HOST</span>' : ''}
                ${isDrawingPlayer ? '<span class="drawer-indicator">DRAWING</span>' : ''}
                <div class="player-status">Score: ${player.score}</div>
            </div>
        `;
        
        playersList.appendChild(playerElement);
    });
}

// Screen switching
function switchToScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// Word display and hints
function displayWord(word, isDrawer) {
    if (isDrawer) {
        wordDisplay.textContent = word;
    } else {
        wordDisplay.textContent = '_ '.repeat(word.length).trim();
        displayHints(word);
    }
}

function displayHints(word) {
    hintContainer.innerHTML = '';
    
    for (let i = 0; i < word.length; i++) {
        const letterBox = document.createElement('div');
        letterBox.classList.add('letter-box');
        letterBox.setAttribute('data-index', i);
        letterBox.textContent = '_';
        
        if (word[i] === ' ') {
            letterBox.classList.add('revealed');
            letterBox.textContent = ' ';
        }
        
        hintContainer.appendChild(letterBox);
    }
}

function revealHint(word) {
    // Collect all unrevealed letter boxes
    const unrevealed = Array.from(hintContainer.querySelectorAll('.letter-box:not(.revealed)'));
    if (unrevealed.length === 0) return;
    
    // Pick random unrevealed letter
    const randomIndex = Math.floor(Math.random() * unrevealed.length);
    const letterBox = unrevealed[randomIndex];
    const index = parseInt(letterBox.getAttribute('data-index'));
    
    // Reveal it
    letterBox.textContent = word[index];
    letterBox.classList.add('revealed');
}

// Socket event handlers
socket.on('gameJoined', data => {
    currentRoom = data.roomId;
    isHost = data.isHost;
    
    // Update room code display
    roomCodeDisplay.textContent = data.roomId;
    
    // Update players list
    updatePlayersList(data.players, data.hostId || data.players[0].id);
    
    // Show/hide start game button
    startGameBtn.style.display = isHost ? 'block' : 'none';
    
    // Switch to lobby screen
    switchToScreen(lobbyScreen);
});

socket.on('playerJoined', data => {
    updatePlayersList(data.players, data.hostId);
    
    // Add system message
    addMessage({
        isSystem: true,
        text: `${data.player.name} joined the game`
    });
});

socket.on('playerLeft', data => {
    updatePlayersList(data.players, data.hostId);
    
    // Add system message
    addMessage({
        isSystem: true,
        text: `${data.playerName} left the game`
    });
});

socket.on('youAreHost', () => {
    isHost = true;
    startGameBtn.style.display = 'block';
    
    // Add system message
    addMessage({
        isSystem: true,
        text: `You are now the host`
    });
});

socket.on('gameStarted', data => {
    // Reset game state
    isMyTurn = false;
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    
    // Update round display
    roundNumberDisplay.textContent = roundNumber;
    
    // Update drawer info
    const isDrawer = data.drawer.id === socket.id;
    isMyTurn = isDrawer;
    
    // Show/hide drawing controls
    drawingControls.style.display = isDrawer ? 'flex' : 'none';
    actionButtons.style.display = isDrawer ? 'flex' : 'none';
    
    // Switch to game screen
    switchToScreen(gameScreen);
    resizeCanvas();
    
    // Set up drawing event listeners
    if (isDrawer) {
        drawingCanvas.addEventListener('mousedown', startDrawing);
        drawingCanvas.addEventListener('mousemove', draw);
        drawingCanvas.addEventListener('mouseup', stopDrawing);
        drawingCanvas.addEventListener('mouseout', stopDrawing);
        drawingCanvas.addEventListener('touchstart', startDrawing);
        drawingCanvas.addEventListener('touchmove', draw);
        drawingCanvas.addEventListener('touchend', stopDrawing);
    } else {
        drawingCanvas.removeEventListener('mousedown', startDrawing);
        drawingCanvas.removeEventListener('mousemove', draw);
        drawingCanvas.removeEventListener('mouseup', stopDrawing);
        drawingCanvas.removeEventListener('mouseout', stopDrawing);
        drawingCanvas.removeEventListener('touchstart', startDrawing);
        drawingCanvas.removeEventListener('touchmove', draw);
        drawingCanvas.removeEventListener('touchend', stopDrawing);
    }
    
    // Update timer
    timer.textContent = `${data.roundTimer}s`;
});

socket.on('yourTurn', data => {
    currentWord = data.word;
    isMyTurn = true;
    
    // Display word
    displayWord(currentWord, true);
    
    // Add system message
    addMessage({
        isSystem: true,
        text: `It's your turn to draw!`
    });
});

socket.on('timerUpdate', data => {
    timer.textContent = `${data.timer}s`;
    
    // Every 15 seconds, reveal a hint for guessers
    if (!isMyTurn && data.timer > 0 && data.timer % 15 === 0) {
        revealHint(currentWord);
    }
});

socket.on('drawEvent', action => {
    drawAction(action);
});

socket.on('canvasCleared', () => {
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
});

socket.on('newMessage', message => {
    addMessage(message);
});

socket.on('scoreUpdate', data => {
    updatePlayersList(data.players);
});

socket.on('roundEnded', data => {
    // Show the word
    revealedWord.textContent = data.word;
    currentWord = data.word;
    
    // Update scores list
    scoresList.innerHTML = '';
    const sortedPlayers = [...data.players].sort((a, b) => b.score - a.score);
    
    sortedPlayers.forEach((player, index) => {
        const scoreElement = document.createElement('div');
        scoreElement.classList.add('score-item');
        
        const initial = player.name.charAt(0).toUpperCase();
        
        scoreElement.innerHTML = `
            <div class="score-name">
                <div class="score-avatar">${initial}</div>
                ${player.name}
            </div>
            <div class="score-value">${player.score}</div>
        `;
        
        scoresList.appendChild(scoreElement);
    });
    
    // Show modal
    roundEndModal.classList.remove('hidden');
    
    // Hide after 5 seconds
    setTimeout(() => {
        roundEndModal.classList.add('hidden');
    }, 5000);
});

socket.on('newRound', data => {
    // Increment round number
    roundNumber++;
    roundNumberDisplay.textContent = roundNumber;
    
    // Reset canvas
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    
    // Hide round end modal
    roundEndModal.classList.add('hidden');
    
    // Update drawer info
    const isDrawer = data.drawer.id === socket.id;
    isMyTurn = isDrawer;
    
    // Show/hide drawing controls
    drawingControls.style.display = isDrawer ? 'flex' : 'none';
    actionButtons.style.display = isDrawer ? 'flex' : 'none';
    
    // Update player list
    updatePlayersList(data.players);
    
    // Update timer
    timer.textContent = `${data.roundTimer}s`;
    
    // Add system message
    addMessage({
        isSystem: true,
        text: `New round started!`
    });
});

socket.on('needMorePlayers', () => {
    showError('Cannot Start Game', 'You need at least 2 players to start the game');
});

socket.on('gameInProgress', () => {
    showError('Game In Progress', 'This game is already in progress. Try creating a new game or join another one.');
});

socket.on('roomNotFound', () => {
    showError('Room Not Found', 'The room code you entered does not exist.');
});

// Error handling
function showError(title, message) {
    errorTitle.textContent = title;
    errorMessage.textContent = message;
    errorModal.classList.remove('hidden');
}

errorOkBtn.addEventListener('click', () => {
    errorModal.classList.add('hidden');
});

// Telegram related functions
telegramWebApp.MainButton.setText('CREATE GAME');
telegramWebApp.MainButton.onClick(() => {
    if (joinScreen.classList.contains('active')) {
        createGameBtn.click();
    } else if (nameForm.classList.contains('active')) {
        createRoom.click();
    } else if (joinForm.classList.contains('active')) {
        joinRoom.click();
    } else if (lobbyScreen.classList.contains('active') && isHost) {
        startGameBtn.click();
    }
});

// Initiate with existing Telegram data
if (telegramWebApp.initDataUnsafe.start_param) {
    // If the bot was started with a parameter, use it as room code
    roomCode.value = telegramWebApp.initDataUnsafe.start_param;
    joinGameBtn.click();
} 