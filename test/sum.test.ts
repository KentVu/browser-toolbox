import { expect, test } from 'vitest'
import { sum } from '../src/lib/sum.js'

test('adds 1 + 2 to equal 3', async () => {
  expect(sum(1, 2)).toBe(3)
  //const popupPage = await browser.getPopupPage()
  //const title = await popupPage.title()
  //expect(title).toBeTruthy()
})