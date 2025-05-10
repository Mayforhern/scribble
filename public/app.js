// Initialize Telegram WebApp
const telegramWebApp = window.Telegram.WebApp;
telegramWebApp.expand();
telegramWebApp.ready();

// Setup canvas and controls
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const colorButtons = document.querySelectorAll('.color');
const thicknessSlider = document.getElementById('thickness');
const clearButton = document.getElementById('clearBtn');
const saveButton = document.getElementById('saveBtn');
const doneButton = document.getElementById('doneBtn');

// Drawing state
let isDrawing = false;
let currentColor = '#000000';
let currentThickness = 5;
let lastX = 0;
let lastY = 0;

// Set canvas size
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

// Initialize canvas
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Color selection
colorButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove selected class from all buttons
        colorButtons.forEach(btn => btn.classList.remove('selected'));
        
        // Add selected class to clicked button
        button.classList.add('selected');
        
        // Set current color
        currentColor = button.getAttribute('data-color');
    });
});

// Thickness selection
thicknessSlider.addEventListener('input', () => {
    currentThickness = thicknessSlider.value;
});

// Start drawing
function startDrawing(e) {
    isDrawing = true;
    
    // Get the position relative to the canvas
    const pos = getPosition(e);
    lastX = pos.x;
    lastY = pos.y;
    
    // Place a dot where the user started
    ctx.beginPath();
    ctx.arc(lastX, lastY, currentThickness / 2, 0, Math.PI * 2);
    ctx.fillStyle = currentColor;
    ctx.fill();
}

// Continue drawing
function draw(e) {
    if (!isDrawing) return;
    
    const pos = getPosition(e);
    const currentX = pos.x;
    const currentY = pos.y;
    
    // Draw a line from the last position to the current position
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(currentX, currentY);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentThickness;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Update the last position
    lastX = currentX;
    lastY = currentY;
}

// Stop drawing
function stopDrawing() {
    isDrawing = false;
}

// Get position from both mouse and touch events
function getPosition(e) {
    let x, y;
    const rect = canvas.getBoundingClientRect();
    
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

// Clear the canvas
clearButton.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Save the drawing
saveButton.addEventListener('click', () => {
    const dataURL = canvas.toDataURL('image/png');
    
    // Create a temporary link and click it to download
    const link = document.createElement('a');
    link.download = 'scribble.png';
    link.href = dataURL;
    link.click();
});

// Done button (send back to Telegram)
doneButton.addEventListener('click', () => {
    const dataURL = canvas.toDataURL('image/png');
    
    // Send data back to Telegram
    telegramWebApp.sendData(JSON.stringify({
        type: 'scribble',
        image: dataURL
    }));
    
    // Close the WebApp
    telegramWebApp.close();
});

// Main button setup
telegramWebApp.MainButton.setText('DONE');
telegramWebApp.MainButton.onClick(() => {
    const dataURL = canvas.toDataURL('image/png');
    
    // Send data back to Telegram
    telegramWebApp.sendData(JSON.stringify({
        type: 'scribble',
        image: dataURL
    }));
    
    // Close the WebApp
    telegramWebApp.close();
});

// Event listeners for mouse
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// Event listeners for touch
canvas.addEventListener('touchstart', startDrawing);
canvas.addEventListener('touchmove', draw);
canvas.addEventListener('touchend', stopDrawing);

// Apply Telegram theme to custom elements
document.documentElement.style.setProperty('--tg-theme-button-color-rgb', hexToRgb(telegramWebApp.themeParams.button_color || '#007AFF'));

// Helper to convert hex to rgb
function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `${r}, ${g}, ${b}`;
} 