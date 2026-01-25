/**
 * Output Processing System
 * Captures, parses, and analyzes command outputs
 */

class OutputProcessor {
  constructor() {
    // ANSI escape code regex
    this.ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]/g;
    
    // Error patterns
    this.errorPatterns = [
      /error:/i,
      /failed/i,
      /cannot/i,
      /permission denied/i,
      /not found/i,
      /no such file/i,
      /command not found/i,
      /syntax error/i,
      /invalid/i,
      /fatal/i
    ];

    // Warning patterns
    this.warningPatterns = [
      /warning:/i,
      /deprecated/i,
      /caution/i,
      /notice/i
    ];
  }

  /**
   * Process command output
   * @param {string} rawOutput - Raw command output
   * @returns {Object} Processed output
   */
  processOutput(rawOutput) {
    if (!rawOutput || typeof rawOutput !== 'string') {
      return {
        raw: '',
        clean: '',
        lines: [],
        errors: [],
        warnings: [],
        structured: null,
        summary: 'No output'
      };
    }

    const clean = this.stripANSI(rawOutput);
    const lines = clean.split('\n').filter(line => line.trim() !== '');

    return {
      raw: rawOutput,
      clean,
      lines,
      errors: this.extractErrors(clean),
      warnings: this.extractWarnings(clean),
      structured: this.parseStructured(clean),
      summary: this.generateSummary(lines)
    };
  }

  /**
   * Strip ANSI escape codes from output
   * @param {string} output - Output with ANSI codes
   * @returns {string} Clean output
   */
  stripANSI(output) {
    return output.replace(this.ansiRegex, '');
  }

  /**
   * Extract error messages from output
   * @param {string} output - Command output
   * @returns {Array<string>} Array of error messages
   */
  extractErrors(output) {
    const lines = output.split('\n');
    const errors = [];

    for (const line of lines) {
      if (this.errorPatterns.some(pattern => pattern.test(line))) {
        errors.push(line.trim());
      }
    }

    return errors;
  }

  /**
   * Extract warning messages from output
   * @param {string} output - Command output
   * @returns {Array<string>} Array of warning messages
   */
  extractWarnings(output) {
    const lines = output.split('\n');
    const warnings = [];

    for (const line of lines) {
      if (this.warningPatterns.some(pattern => pattern.test(line))) {
        warnings.push(line.trim());
      }
    }

    return warnings;
  }

  /**
   * Parse structured data (JSON, tables, etc.)
   * @param {string} output - Command output
   * @returns {Object|null} Parsed structured data
   */
  parseStructured(output) {
    // Try to parse as JSON
    const jsonData = this.tryParseJSON(output);
    if (jsonData) {
      return { type: 'json', data: jsonData };
    }

    // Try to parse as table
    const tableData = this.tryParseTable(output);
    if (tableData) {
      return { type: 'table', data: tableData };
    }

    // Try to parse as key-value pairs
    const kvData = this.tryParseKeyValue(output);
    if (kvData && Object.keys(kvData).length > 0) {
      return { type: 'keyvalue', data: kvData };
    }

    return null;
  }

  /**
   * Try to parse output as JSON
   * @param {string} output - Command output
   * @returns {Object|null} Parsed JSON or null
   */
  tryParseJSON(output) {
    try {
      // Look for JSON objects or arrays
      const jsonMatch = output.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // Not valid JSON
    }
    return null;
  }

  /**
   * Try to parse output as table
   * @param {string} output - Command output
   * @returns {Array|null} Parsed table data or null
   */
  tryParseTable(output) {
    const lines = output.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
      return null;
    }

    // Check if output looks like a table (has consistent column separators)
    const separatorPattern = /[\s]{2,}|\t|\|/;
    const hasConsistentSeparators = lines.every(line => separatorPattern.test(line));

    if (!hasConsistentSeparators) {
      return null;
    }

    // Parse table
    const rows = lines.map(line => {
      return line.split(separatorPattern)
        .map(cell => cell.trim())
        .filter(cell => cell !== '');
    });

    // Check if all rows have similar column counts
    const columnCounts = rows.map(row => row.length);
    const avgColumns = columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;
    const isConsistent = columnCounts.every(count => Math.abs(count - avgColumns) <= 1);

    if (!isConsistent) {
      return null;
    }

    return {
      headers: rows[0],
      rows: rows.slice(1)
    };
  }

  /**
   * Try to parse output as key-value pairs
   * @param {string} output - Command output
   * @returns {Object} Parsed key-value data
   */
  tryParseKeyValue(output) {
    const lines = output.split('\n');
    const kvData = {};
    const kvPattern = /^([^:=]+)[:=]\s*(.+)$/;

    for (const line of lines) {
      const match = line.trim().match(kvPattern);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        kvData[key] = value;
      }
    }

    return kvData;
  }

  /**
   * Generate summary of output
   * @param {Array<string>} lines - Output lines
   * @returns {string} Summary
   */
  generateSummary(lines) {
    if (lines.length === 0) {
      return 'No output';
    }

    if (lines.length === 1) {
      return lines[0].substring(0, 100);
    }

    // Return first and last lines as summary
    const first = lines[0].substring(0, 50);
    const last = lines[lines.length - 1].substring(0, 50);
    return `${first}... (${lines.length} lines) ...${last}`;
  }

  /**
   * Extract specific information using pattern matching
   * @param {string} output - Command output
   * @param {RegExp} pattern - Pattern to match
   * @returns {Array<string>} Matched strings
   */
  extractPattern(output, pattern) {
    const matches = [];
    const lines = output.split('\n');

    for (const line of lines) {
      const match = line.match(pattern);
      if (match) {
        matches.push(match[1] || match[0]);
      }
    }

    return matches;
  }

  /**
   * Extract IP addresses from output
   * @param {string} output - Command output
   * @returns {Array<string>} Array of IP addresses
   */
  extractIPAddresses(output) {
    const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
    const matches = output.match(ipPattern) || [];
    return [...new Set(matches)]; // Remove duplicates
  }

  /**
   * Extract URLs from output
   * @param {string} output - Command output
   * @returns {Array<string>} Array of URLs
   */
  extractURLs(output) {
    const urlPattern = /https?:\/\/[^\s]+/g;
    const matches = output.match(urlPattern) || [];
    return [...new Set(matches)];
  }

  /**
   * Extract file paths from output
   * @param {string} output - Command output
   * @returns {Array<string>} Array of file paths
   */
  extractFilePaths(output) {
    const pathPattern = /(?:\/[^\s\/]+)+/g;
    const matches = output.match(pathPattern) || [];
    return [...new Set(matches)];
  }

  /**
   * Determine if command was successful based on output
   * @param {string} output - Command output
   * @param {number} exitCode - Command exit code
   * @returns {boolean} True if successful
   */
  isSuccessful(output, exitCode) {
    if (exitCode !== 0) {
      return false;
    }

    // Check for error indicators in output
    const hasErrors = this.extractErrors(output).length > 0;
    return !hasErrors;
  }

  /**
   * Format output for display
   * @param {string} output - Command output
   * @param {Object} options - Formatting options
   * @returns {string} Formatted output
   */
  formatOutput(output, options = {}) {
    const {
      maxLines = 50,
      maxLineLength = 120,
      stripAnsi = true
    } = options;

    let formatted = stripAnsi ? this.stripANSI(output) : output;
    let lines = formatted.split('\n');

    // Truncate lines
    if (maxLineLength) {
      lines = lines.map(line => 
        line.length > maxLineLength 
          ? line.substring(0, maxLineLength) + '...' 
          : line
      );
    }

    // Limit number of lines
    if (maxLines && lines.length > maxLines) {
      const half = Math.floor(maxLines / 2);
      lines = [
        ...lines.slice(0, half),
        `... (${lines.length - maxLines} lines omitted) ...`,
        ...lines.slice(-half)
      ];
    }

    return lines.join('\n');
  }
}

module.exports = OutputProcessor;
