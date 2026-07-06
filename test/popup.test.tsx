import { describe, it, expect, test, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react';
import * as matchers from "@testing-library/jest-dom/matchers";
import Popup from '@pages/popup/Popup';
import { fireEvent, render, screen } from '@testing-library/react';
import { shortcutKeys } from '@src/lib/constants';
 
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
        it('should highlight the selected tab when I press its ID', async () => {
            // Given tab list is:
            const tabList = [
                { id: 1, title: 'Tab 1' },
                { id: 2, title: 'Tab 2' },
                { id: 3, title: 'Tab 3' },
            ]
            // When render popup
            render(<Popup tabList={tabList} />);
            // When I press the ID of the second tab
            const secondTabKey = shortcutKeys[1]; // 's'
            fireEvent.keyDown(document, { key: secondTabKey });

            // Then the second tab should be highlighted
            const secondTab = screen.getByText(/Tab 2/i);
            // We expect the parent <li> element to have the selected class
            expect(secondTab.closest('li')).toHaveClass('selected');
        })
    
    })
})