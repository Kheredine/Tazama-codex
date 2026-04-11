# Tazama Deploy Checklist

## Frontend

- Set `VITE_API_URL` to your deployed backend URL.
- Set `VITE_TMDB_API_KEY`.
- Build command: `npm run build`
- Publish directory: `dist`

## Backend

- Set `PORT` from the hosting platform or let the local default `3001` be used.
- Set `OPENAI_API_KEY`.
- Start command: `npm start`
- Dev command: `npm run dev`

## Database

- Keep the SQLite database inside persistent storage.
- Persist the `backend/data` folder on your host.

## Recommended hosting

- Frontend: Vercel or Netlify
- Backend: Railway or Render

## Before sharing the link

- Confirm the frontend is using the deployed backend URL.
- Confirm registration and login work.
- Confirm Oracle recommendations load.
- Confirm playlists can be created and still exist after a restart.
- Confirm shared profile posts and the social feed load correctly.
