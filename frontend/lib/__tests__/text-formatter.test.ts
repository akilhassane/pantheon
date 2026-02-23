import { stripMarkdownFormatting } from '../text-formatter';

describe('stripMarkdownFormatting', () => {
  it('should remove headers', () => {
    const input = '### SCREEN INFO:\nSome content';
    const expected = 'SCREEN INFO:\nSome content';
    expect(stripMarkdownFormatting(input)).toBe(expected);
  });

  it('should remove bold formatting', () => {
    const input = '**Resolution:** 1920x1080';
    const expected = 'Resolution: 1920x1080';
    expect(stripMarkdownFormatting(input)).toBe(expected);
  });

  it('should remove bullet points', () => {
    const input = '- Item 1\n- Item 2\n- Item 3';
    const expected = 'Item 1\nItem 2\nItem 3';
    expect(stripMarkdownFormatting(input)).toBe(expected);
  });

  it('should remove inline code', () => {
    const input = 'Click on the `Microsoft Edge` button';
    const expected = 'Click on the Microsoft Edge button';
    expect(stripMarkdownFormatting(input)).toBe(expected);
  });

  it('should handle complex markdown', () => {
    const input = `### SCREEN INFO:
- **Resolution:** 1920x1080
- **Mouse Position:** (1767, 440)

### TASKBAR BUTTONS (14 total):
- **Widgets** (71°F Mostly cloudy) at (6, 1032)
- **Start** at (738, 1032)`;

    const expected = `SCREEN INFO:
Resolution: 1920x1080
Mouse Position: (1767, 440)

TASKBAR BUTTONS (14 total):
Widgets (71°F Mostly cloudy) at (6, 1032)
Start at (738, 1032)`;

    expect(stripMarkdownFormatting(input)).toBe(expected);
  });

  it('should handle empty or null input', () => {
    expect(stripMarkdownFormatting('')).toBe('');
    expect(stripMarkdownFormatting(null as any)).toBe('');
  });
});
