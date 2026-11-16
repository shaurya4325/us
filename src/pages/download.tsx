import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/manrope';
import DownloadQR from './DownloadQR';
import '../styles.css';

createRoot(document.getElementById('root')!).render(<DownloadQR />);
