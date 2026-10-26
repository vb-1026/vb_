Viloyatga Boramiz — improved prototype

Run with Node.js 18+:
1. Open a terminal in this folder.
2. Run: npm start
3. Open http://localhost:3000

Location access works best on HTTPS or localhost. Click “Joylashuvimni aniqlash” and allow location in the browser permission prompt.

Payment safety: this prototype saves only the card's first four and last four digits for display. It does NOT process real payments or transfer funds. Real passenger charges and driver payouts require a payment provider, server-side integration, and provider tokenization. Never collect or store CVV or full card numbers on your own server.

District selectors are linked to their region selectors. District/area names are an included practical list and should be verified against official current administrative data before production.
