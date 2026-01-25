/**
 * Text formatting utilities to render markdown in AI responses
 */

/**
 * Convert markdown formatting to HTML for proper rendering
 * This renders markdown syntax as styled HTML elements
 */
export function formatMarkdownToHTML(text: string): string {
  if (!text) return '';

  let formatted = text;

  // Convert headers (### Header -> <h3>Header</h3>)
  formatted = formatted.replace(/^######\s+(.+)$/gm, '<h6 class="text-xs font-semibold text-gray-200 mt-2 mb-1">$1</h6>');
  formatted = formatted.replace(/^#####\s+(.+)$/gm, '<h5 class="text-sm font-semibold text-gray-200 mt-2 mb-1">$1</h5>');
  formatted = formatted.replace(/^####\s+(.+)$/gm, '<h4 class="text-sm font-semibold text-gray-200 mt-2 mb-1">$1</h4>');
  formatted = formatted.replace(/^###\s+(.+)$/gm, '<h3 class="text-sm font-semibold text-gray-200 mt-2 mb-1">$1</h3>');
  formatted = formatted.replace(/^##\s+(.+)$/gm, '<h2 class="text-base font-semibold text-gray-100 mt-3 mb-1">$1</h2>');
  formatted = formatted.replace(/^#\s+(.+)$/gm, '<h1 class="text-lg font-bold text-gray-100 mt-3 mb-2">$1</h1>');

  // Convert bold (**text** or __text__ -> <strong>text</strong>)
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-100">$1</strong>');
  formatted = formatted.replace(/__(.+?)__/g, '<strong class="font-semibold text-gray-100">$1</strong>');

  // Convert italic (*text* or _text_ -> <em>text</em>)
  formatted = formatted.replace(/\*(.+?)\*/g, '<em class="italic text-gray-200">$1</em>');
  formatted = formatted.replace(/_(.+?)_/g, '<em class="italic text-gray-200">$1</em>');

  // Convert bullet points (- item -> <li>item</li>)
  formatted = formatted.replace(/^[\s]*[-*+]\s+(.+)$/gm, '<li class="ml-4 text-gray-300">• $1</li>');

  // Convert numbered lists (1. item -> <li>1. item</li>)
  formatted = formatted.replace(/^[\s]*(\d+)\.\s+(.+)$/gm, '<li class="ml-4 text-gray-300">$1. $2</li>');

  // Convert inline code (`code` -> <code>code</code>)
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-gray-800 text-blue-400 rounded text-xs font-mono">$1</code>');

  // Convert links ([text](url) -> <a>text</a>)
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">$1</a>');

  // Convert line breaks to <br> for proper spacing
  formatted = formatted.replace(/\n/g, '<br/>');

  return formatted;
}
