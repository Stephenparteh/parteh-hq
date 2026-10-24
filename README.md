# Parteh HQ · The Professor's Study

Stephen Parteh's studio software: track client projects, make branded documents (PDF and Word), and track money owed and received.

- `client/`: React + Vite (JavaScript). Deployed on Vercel (project `parteh-hq`).
- `server/`: Node.js + Express API. Deployed on Render (service `parteh-hq-api`).
- Database: MongoDB Atlas (Mongoose).
- `reference/`: the prototype source. Port from it. Do not edit.

## Run it on your computer

You need Node 18 or newer.

```
# Terminal 1: the API
cd server
copy .env.example .env     # (macOS/Linux: cp) then fill in the values
npm install
npm run dev                # http://localhost:4000/api/health

# Terminal 2: the website
cd client
copy .env.example .env     # set VITE_API_URL=http://localhost:4000
npm install
npm run dev                # http://localhost:5173
```

For local work, set `CLIENT_ORIGIN=http://localhost:5173` in `server/.env`.

## Create the MongoDB Atlas database

1. Go to https://www.mongodb.com/cloud/atlas and sign up. The free M0 plan is enough.
2. Create a project named `parteh-hq`. Then **Create a cluster** and choose **M0 Free**. Pick the region closest to you.
3. **Database Access** → **Add New Database User**. Choose a username and a strong password. Use letters and numbers only, so you don't need to escape anything. Give it the **Read and write to any database** role. Save the password somewhere safe.
4. **Network Access** → **Add IP Address**. For a start, choose **Allow access from anywhere** (`0.0.0.0/0`). Render's IP addresses change, so this is needed. Your strong password is the protection.
5. **Database** → **Connect** → **Drivers**. Copy the connection string. It looks like `mongodb+srv://USER:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`.
6. Replace `<password>` with your password. Add the database name before the `?`, like `...mongodb.net/parteh-hq?retryWrites=...`.
7. Put it in `server/.env` as `MONGODB_URI=`. Never commit this file.
8. Make a `JWT_SECRET` with: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## Environment variables

See `server/.env.example` and `client/.env.example`. Real `.env` files are git-ignored.
Secrets (`MONGODB_URI`, `JWT_SECRET`, `ANTHROPIC_API_KEY`) live only on the server.

## Privacy

Never commit `.env` files, real client data or backup JSON files.
