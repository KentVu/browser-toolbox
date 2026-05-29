import { describe, it, expect, test, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react';
import * as matchers from "@testing-library/jest-dom/matchers";
import Popup from '@pages/popup/Popup';
import { render, screen } from '@testing-library/react';
 
expect.extend(matchers);

afterEach(() => {
  cleanup();
});

describe('Popup component', () => {
    it('has title', async () => {
        render(<Popup />);
        const titleElement = screen.getByText(/Popup Page/i);
        expect(titleElement).toBeInTheDocument();
    })
})