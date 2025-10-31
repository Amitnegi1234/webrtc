import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { UserProvider } from './context/UserContextApi.jsx'
import process from 'process';

window.process=process;
window.global=global;

createRoot(document.getElementById('root')).render(
  <UserProvider>
    <App />
  </UserProvider>
)
