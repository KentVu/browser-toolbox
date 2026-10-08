import { render } from 'preact';
import Options from '@pages/options/Options';
import '@pages/options/index.css';

function init() {
  const rootContainer = document.querySelector("#__root");
  if (!rootContainer) throw new Error("Can't find Options root element");
  render(<Options />, rootContainer);
}

init();
