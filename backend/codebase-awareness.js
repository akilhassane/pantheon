/**
 * Codebase Awareness Tools
 * Provides AI with understanding of project structure and files
 */

class CodebaseAwareness {
  constructor(mcpClient) {
    this.mcpClient = mcpClient;
    this.projectCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * List directory with enhanced metadata
   */
  async listDirectory(path, options = {}) {
    const {
      recursive = false,
      includeHidden = false,
      maxDepth = 3
    } = options;

    const cacheKey = `list:${path}:${recursive}:${includeHidden}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      let command = `ls -la ${path}`;
      
      if (recursive) {
        command = `find ${path} -maxdepth ${maxDepth} -type f`;
        if (!includeHidden) {
          command += ` -not -path '*/\\.*'`;
        }
      }

      const result = await this.mcpClient.executeCommand(command);
      const parsed = this.parseDirectoryListing(result.output, recursive);

      this.setCached(cacheKey, parsed);
      return parsed;

    } catch (error) {
      console.error('Error listing directory:', error);
      return { error: error.message, entries: [] };
    }
  }

  /**
   * Parse directory listing output
   */
  parseDirectoryListing(output, isRecursive = false) {
    const lines = output.split('\n').filter(line => line.trim() !== '');
    const entries = [];

    if (isRecursive) {
      // Parse find output
      for (const line of lines) {
        const path = line.trim();
        if (path) {
          entries.push({
            path,
            name: path.split('/').pop(),
            type: 'file',
            isDirectory: false
          });
        }
      }
    } else {
      // Parse ls -la output
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 9 && parts[0] !== 'total') {
          const permissions = parts[0];
          const name = parts.slice(8).join(' ');
          
          // Skip . and ..
          if (name === '.' || name === '..') continue;

          entries.push({
            name,
            permissions,
            size: parts[4],
            modified: `${parts[5]} ${parts[6]} ${parts[7]}`,
            isDirectory: permissions.startsWith('d'),
            isSymlink: permissions.startsWith('l'),
            type: this.getFileType(name, permissions)
          });
        }
      }
    }

    return {
      entries,
      count: entries.length,
      directories: entries.filter(e => e.isDirectory).length,
      files: entries.filter(e => !e.isDirectory).length
    };
  }

  /**
   * Read file with encoding support
   */
  async readFile(path, options = {}) {
    const { encoding = 'utf8', maxLines = null } = options;

    const cacheKey = `read:${path}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      let command = `cat ${path}`;
      if (maxLines) {
        command = `head -n ${maxLines} ${path}`;
      }

      const result = await this.mcpClient.executeCommand(command);

      const fileData = {
        path,
        content: result.output,
        encoding,
        lines: result.output.split('\n').length,
        size: result.output.length,
        success: result.success
      };

      this.setCached(cacheKey, fileData);
      return fileData;

    } catch (error) {
      console.error('Error reading file:', error);
      return {
        path,
        error: error.message,
        success: false
      };
    }
  }

  /**
   * Search files for patterns
   */
  async searchFiles(pattern, path = '.', options = {}) {
    const {
      filePattern = '*',
      caseSensitive = false,
      maxResults = 100
    } = options;

    try {
      const caseFlag = caseSensitive ? '' : '-i';
      const command = `grep -r ${caseFlag} -n "${pattern}" ${path} --include="${filePattern}" | head -n ${maxResults}`;

      const result = await this.mcpClient.executeCommand(command);
      return this.parseSearchResults(result.output);

    } catch (error) {
      console.error('Error searching files:', error);
      return { error: error.message, results: [] };
    }
  }

  /**
   * Parse search results
   */
  parseSearchResults(output) {
    const lines = output.split('\n').filter(line => line.trim() !== '');
    const results = [];

    for (const line of lines) {
      const firstColon = line.indexOf(':');
      const secondColon = line.indexOf(':', firstColon + 1);

      if (firstColon > 0 && secondColon > firstColon) {
        results.push({
          file: line.substring(0, firstColon),
          lineNumber: line.substring(firstColon + 1, secondColon),
          match: line.substring(secondColon + 1).trim()
        });
      }
    }

    return {
      results,
      count: results.length,
      files: [...new Set(results.map(r => r.file))]
    };
  }

  /**
   * Get file metadata
   */
  async getFileInfo(path) {
    try {
      const statCommand = `stat -c '%s %Y %A' ${path} 2>/dev/null || stat -f '%z %m %Sp' ${path}`;
      const typeCommand = `file -b ${path}`;

      const [statResult, typeResult] = await Promise.all([
        this.mcpClient.executeCommand(statCommand),
        this.mcpClient.executeCommand(typeCommand)
      ]);

      const statParts = statResult.output.trim().split(/\s+/);

      return {
        path,
        size: parseInt(statParts[0]) || 0,
        modified: new Date(parseInt(statParts[1]) * 1000),
        permissions: statParts[2] || 'unknown',
        type: typeResult.output.trim(),
        exists: statResult.success
      };

    } catch (error) {
      console.error('Error getting file info:', error);
      return {
        path,
        error: error.message,
        exists: false
      };
    }
  }

  /**
   * Analyze project structure
   */
  async analyzeProjectStructure(rootPath = '.') {
    try {
      const structure = {
        root: rootPath,
        projectType: 'unknown',
        languages: [],
        frameworks: [],
        configFiles: [],
        hasTests: false,
        hasDocker: false,
        packageManager: null
      };

      // Check for common project files
      const commonFiles = [
        'package.json',
        'requirements.txt',
        'Dockerfile',
        'docker-compose.yml',
        'README.md',
        '.env',
        'Makefile',
        'pom.xml',
        'build.gradle',
        'Cargo.toml',
        'go.mod'
      ];

      for (const file of commonFiles) {
        const result = await this.mcpClient.executeCommand(`test -f ${rootPath}/${file} && echo "exists"`);
        if (result.output.includes('exists')) {
          structure.configFiles.push(file);

          // Determine project type
          if (file === 'package.json') {
            structure.projectType = 'nodejs';
            structure.packageManager = 'npm';
            structure.languages.push('JavaScript');
          } else if (file === 'requirements.txt') {
            structure.projectType = 'python';
            structure.packageManager = 'pip';
            structure.languages.push('Python');
          } else if (file === 'Cargo.toml') {
            structure.projectType = 'rust';
            structure.packageManager = 'cargo';
            structure.languages.push('Rust');
          } else if (file === 'go.mod') {
            structure.projectType = 'go';
            structure.packageManager = 'go';
            structure.languages.push('Go');
          }

          if (file === 'Dockerfile' || file === 'docker-compose.yml') {
            structure.hasDocker = true;
          }
        }
      }

      // Check for test directories
      const testDirs = ['test', 'tests', '__tests__', 'spec'];
      for (const dir of testDirs) {
        const result = await this.mcpClient.executeCommand(`test -d ${rootPath}/${dir} && echo "exists"`);
        if (result.output.includes('exists')) {
          structure.hasTests = true;
          break;
        }
      }

      // Count files by extension
      const extensionResult = await this.mcpClient.executeCommand(
        `find ${rootPath} -type f | sed 's/.*\\.//' | sort | uniq -c | sort -rn | head -10`
      );
      structure.fileExtensions = this.parseExtensionCounts(extensionResult.output);

      return structure;

    } catch (error) {
      console.error('Error analyzing project structure:', error);
      return { error: error.message };
    }
  }

  /**
   * Parse file extension counts
   */
  parseExtensionCounts(output) {
    const lines = output.split('\n').filter(line => line.trim() !== '');
    const extensions = [];

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length === 2) {
        extensions.push({
          extension: parts[1],
          count: parseInt(parts[0])
        });
      }
    }

    return extensions;
  }

  /**
   * Get file type from name and permissions
   */
  getFileType(name, permissions) {
    if (permissions.startsWith('d')) return 'directory';
    if (permissions.startsWith('l')) return 'symlink';

    const ext = name.split('.').pop().toLowerCase();
    const typeMap = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'xml': 'xml',
      'yml': 'yaml',
      'yaml': 'yaml',
      'md': 'markdown',
      'txt': 'text',
      'sh': 'shell',
      'bash': 'shell'
    };

    return typeMap[ext] || 'file';
  }

  /**
   * Find files by pattern
   */
  async findFiles(pattern, path = '.', options = {}) {
    const { maxDepth = 5, type = 'f' } = options;

    try {
      const command = `find ${path} -maxdepth ${maxDepth} -type ${type} -name "${pattern}"`;
      const result = await this.mcpClient.executeCommand(command);

      const files = result.output
        .split('\n')
        .filter(line => line.trim() !== '')
        .map(line => line.trim());

      return {
        files,
        count: files.length
      };

    } catch (error) {
      console.error('Error finding files:', error);
      return { error: error.message, files: [] };
    }
  }

  /**
   * Get project dependencies
   */
  async getProjectDependencies(projectType) {
    try {
      let command;
      
      switch (projectType) {
        case 'nodejs':
          command = 'cat package.json | grep -A 100 "dependencies"';
          break;
        case 'python':
          command = 'cat requirements.txt';
          break;
        case 'rust':
          command = 'cat Cargo.toml | grep -A 100 "dependencies"';
          break;
        default:
          return { error: 'Unknown project type' };
      }

      const result = await this.mcpClient.executeCommand(command);
      return {
        projectType,
        dependencies: result.output
      };

    } catch (error) {
      console.error('Error getting dependencies:', error);
      return { error: error.message };
    }
  }

  /**
   * Cache management
   */
  getCached(key) {
    const cached = this.projectCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCached(key, data) {
    this.projectCache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Auto-cleanup
    setTimeout(() => {
      this.projectCache.delete(key);
    }, this.cacheTimeout);
  }

  clearCache() {
    this.projectCache.clear();
  }
}

module.exports = CodebaseAwareness;
