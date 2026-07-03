import { describe, it, expect, test, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react';
import * as matchers from "@testing-library/jest-dom/matchers";
import Popup from '@pages/popup/Popup';
import { render, screen } from '@testing-library/react';
 
expect.extend(matchers);

afterEach(() => {
  cleanup();
});

describe('Popup', () => {
    describe('Initial page', () => {
        it('has title', async () => {
            render(<Popup tabList={[]}/>);
            const titleElement = screen.getByText(/Welcome/i);
            expect(titleElement).toBeInTheDocument();
        })
        it('Has tab list', async () => {
            // Given tab list is:
            const tabList = [
                { id: 1, title: 'Tab 1' },
                { id: 2, title: 'Tab 2' },
                { id: 3, title: 'Tab 3' },
            ]
            // When render popup
            render(<Popup tabList={tabList} />);
            expect(screen.getByText(/Tab List/i)).toBeInTheDocument();
            tabList.forEach(tab => {
                expect(screen.getByText(new RegExp(tab.title, 'i'))).toBeInTheDocument();
            });
        })
        it('should display tabs in recently activated order')
        it('should highlight the selected tab when I press its ID',)
    })
})