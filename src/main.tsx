import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { initDb } from './lib/db/client';
import './app/globals.css';

initDb()
  .then(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <RouterProvider router={router} />
      </React.StrictMode>,
    );
  })
  .catch((err) => {
    document.body.innerHTML = `
      <div style="padding:2rem;font-family:monospace;color:#f87171">
        <strong>Failed to initialise database</strong><br/><br/>
        ${String(err)}
      </div>`;
  });
