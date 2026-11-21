# Mosaics World realtime server

Relays positions and chat so people who type the same World PIN share one world. One Durable Object per map cell, so a PIN
can hold thousands of people. Nothing is stored.

Deploy (once):

    cd game/realtime
    npx wrangler login
    npx wrangler deploy

Wrangler prints the address (https://mosaics-realtime.<you>.workers.dev). In the game, open **World PIN** > **Server** and paste it
with `wss://` instead of `https://`, or change DEFAULT_URL in `src/net/Multiplayer.ts`.

Local test: `npx wrangler dev --local --port 8799`, then use `ws://127.0.0.1:8799` as the server.
