import { launch } from 'puppeteer';
import puppeteer from 'puppeteer';

const EXTENSION_PATH = './dist';
const EXTENSION_ID = 'kfnlegigggchfakaefjomdlbhinmeiih';

describe('popup', () => {
  it.skip('should renders correctly', async () => {
    //const page = await browser.newPage();
    //await page.goto(`chrome-extension://${EXTENSION_ID}/popup.html`);
    popupPage = globalThis.__PPAGE_GLOBAL__;


    /* await page.evaluate(() => {
      debugger;
    }); */

    const list = await popupPage.$('ul');
    const children = await list.$$('li');

    expect(children.length).toBe(1);
  });
});
