import { describe, it, expect } from 'vitest';
import { stripJsonSchemaKeywords } from '../../src/server.js';

describe('stripJsonSchemaKeywords', () => {
  it('removes $schema and default keys recursively from objects and arrays', () => {
    const input = {
      type: 'object',
      $schema: 'http://json-schema.org/draft-07/schema#',
      properties: {
        name: {
          type: 'string',
          default: 'untitled',
        },
        nested: {
          type: 'array',
          items: [
            { type: 'object', default: { x: 1 }, properties: { a: { type: 'number' } } },
            { type: 'string', $schema: 'ignore-me' },
          ],
        },
      },
    };

    expect(stripJsonSchemaKeywords(input)).toEqual({
      type: 'object',
      properties: {
        name: {
          type: 'string',
        },
        nested: {
          type: 'array',
          items: [{ type: 'object', properties: { a: { type: 'number' } } }, { type: 'string' }],
        },
      },
    });
  });
});
