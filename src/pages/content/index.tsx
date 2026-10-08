/* import { render } from 'preact';
import './style.css'
const div = document.createElement('div');
div.id = '__root';
document.body.appendChild(div);

const rootContainer = document.querySelector('#__root');
if (!rootContainer) throw new Error("Can't find Content root element");
render(
  <div className='absolute bottom-0 left-0 text-lg text-black bg-amber-400 z-50'  >
    content script <span className='your-class'>loaded</span>
  </div>,
  rootContainer
); */

try {
  console.log('content script loaded');
} catch (e) {
  console.error(e);
}
