# Telegram Scribble Mini App

A simple drawing application built for Telegram Mini Apps.

## Features

- Canvas-based drawing interface
- Multiple colors
- Adjustable line thickness
- Save drawings locally
- Send drawings back to Telegram

## Deployment to Vercel

1. Sign up for a Vercel account at [vercel.com](https://vercel.com) if you don't have one

2. Install the Vercel CLI:
```
npm install -g vercel
```

3. Login to Vercel:
```
vercel login
```

4. Deploy the app:
```
cd scribble-app
vercel deploy
```

5. Follow the prompts to deploy your app. When complete, Vercel will provide you with a deployment URL.

6. Copy the deployment URL and update the `MINI_APP_URL` variable in your Telegram bot's `index.js` file:
```javascript
const MINI_APP_URL = 'https://your-app-name.vercel.app/';
```

7. Restart your Telegram bot to use the new URL.

## Local Development

To test the app locally:

1. Install dependencies:
```
npm install
```

2. Start the local server:
```
npm start
```

3. Open `http://localhost:5000` in your browser.

## Integration with Telegram Bot

This mini app is designed to be opened from a Telegram bot. When a user clicks the "Done" button or the Telegram Main Button, the drawing is sent back to the bot as a data string.

The data is sent in the following format:
```json
{
  "type": "scribble",
  "image": "[base64-encoded PNG image]"
}
```

## Further Customization

You can customize the app by modifying the following files:
- `public/index.html` - HTML structure
- `public/app.js` - JavaScript functionality 