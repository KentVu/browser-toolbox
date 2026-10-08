import logo from '@assets/img/logo.svg';
import '@pages/newtab/Newtab.css';

export default function Newtab() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/pages/newtab/Newtab.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://preactjs.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn Preact!
        </a>
      </header>
    </div>
  );
}
