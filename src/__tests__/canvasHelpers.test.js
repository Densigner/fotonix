const addImageToCanvas = require('../utils/canvasHelpers');

describe('addImageToCanvas helper', () => {
  test('calls bringToFront and requestRenderAll when available', () => {
    const calls = [];
    const mockImg = {
      bringToFront: jest.fn(() => calls.push('bring')),
    };

    const mockCanvas = {
      add: jest.fn((obj) => calls.push('add')),
      setActiveObject: jest.fn((obj) => calls.push('setActive')),
      requestRenderAll: jest.fn(() => calls.push('requestRender')),
    };

    addImageToCanvas(mockCanvas, mockImg);

    expect(mockCanvas.add).toHaveBeenCalledWith(mockImg);
    expect(mockImg.bringToFront).toHaveBeenCalled();
    expect(mockCanvas.setActiveObject).toHaveBeenCalledWith(mockImg);
    expect(mockCanvas.requestRenderAll).toHaveBeenCalled();
    expect(calls).toEqual(['add','bring','setActive','requestRender']);
  });

  test('falls back to renderAll if requestRenderAll missing', () => {
    const mockImg = { bringToFront: jest.fn() };
    const mockCanvas = {
      add: jest.fn(),
      setActiveObject: jest.fn(),
      renderAll: jest.fn()
    };

    addImageToCanvas(mockCanvas, mockImg);

    expect(mockImg.bringToFront).toHaveBeenCalled();
    expect(mockCanvas.renderAll).toHaveBeenCalled();
  });
});
