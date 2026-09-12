import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/lora/latin-600.css';
import '@fontsource/lora/latin-700.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { mount } from './app';
import { mountAnalytics } from './analytics';
const root = document.getElementById('app')!;
const cleanup = mount(root);
const cleanupAnalytics = import.meta.env.PROD ? mountAnalytics(root) : () => {};
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    cleanupAnalytics();
    cleanup();
  });
