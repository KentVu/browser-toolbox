import { useReducer } from 'react';
import { PopupReducer, popupReducer, PopupState } from '@pages/popup/popupReducer';
import { produce } from 'immer';
import { useImmerReducer } from 'use-immer';
import { describe, it, expect, test } from 'vitest'

describe('popupReducer', () => {
  it('MOVE_TABCONTROL should set mode to tabControl', () => {
    /* const initialState: PopupState = { mode: 'top' };
    const newState: PopupState = initialState;
    //const newState = produce(popupReducer, initialState)({ type: 'MOVE_TABCONTROL', payload: { } });
    popupReducer(newState, { type: 'MOVE_TABCONTROL', payload: { } });
    expect(newState).toEqual({ mode: 'tabControl' }); */
  });
  describe('MOVE_TABCONTROL', () => {
    it('should set mode to tabControl', () => {
      const initialState: PopupState = { mode: 'top' };
      const newState = new PopupReducer().reduce(initialState, { type: 'MOVE_TABCONTROL', payload: { } });
      expect(newState).toEqual({ mode: 'tabControl' });
    });
  });

});