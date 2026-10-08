import { render } from 'preact';
import Panel from '@pages/panel/Panel';
import '@pages/panel/index.css';
import '@assets/styles/tailwind.css';

function init() {
  const rootContainer = document.querySelector("#__root");
  if (!rootContainer) throw new Error("Can't find Panel root element");
  render(<Panel />, rootContainer);
}

init();
