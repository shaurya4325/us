import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/manrope';
import DownloadQR from './DownloadQR';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/silkscreen/700.css';
import '../styles.css';
import '../theme-block.css';

createRoot(document.getElementById('root')!).render(<DownloadQR />);
