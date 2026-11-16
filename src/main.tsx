import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/manrope';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);
