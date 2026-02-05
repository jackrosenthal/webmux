/**
 * OSC (Operating System Command) escape sequence parser for terminal titles.
 *
 * Parses OSC 0, 1, and 2 sequences which set the terminal title:
 * - OSC 0 ; title BEL/ST - sets both icon name and window title
 * - OSC 1 ; title BEL/ST - sets icon name only
 * - OSC 2 ; title BEL/ST - sets window title only
 *
 * Format: ESC ] N ; title (BEL | ESC \)
 * Where N is 0, 1, or 2, BEL is \x07, and ESC \ is \x1b\x5c
 */

const ESC = "\x1b";
const BEL = "\x07";
const ST = ESC + "\\"; // String Terminator

/**
 * Parser for extracting OSC title sequences from terminal output.
 * Handles streaming data where sequences may span multiple chunks.
 */
export class OscTitleParser {
  private buffer = "";
  private inOsc = false;

  /**
   * Processes a chunk of terminal output data.
   * Returns the title if an OSC 0/1/2 sequence was completed, or null otherwise.
   * Note: Only OSC 0 and 2 affect window title; OSC 1 is icon name only.
   * We return the title for OSC 0 and 2, ignore OSC 1.
   */
  process(data: string): string | null {
    let result: string | null = null;

    for (let i = 0; i < data.length; i++) {
      const char = data[i]!;
      const prevChar = i > 0 ? data[i - 1] : this.buffer.slice(-1);

      if (this.inOsc) {
        this.buffer += char;

        // Check for terminators
        if (char === BEL) {
          // BEL terminates the OSC sequence
          result = this.extractTitle();
          this.reset();
        } else if (char === "\\" && prevChar === ESC) {
          // ESC \ (ST) terminates the OSC sequence
          result = this.extractTitle();
          this.reset();
        } else if (this.buffer.length > 4096) {
          // Safety limit - reset if buffer gets too large
          this.reset();
        }
      } else {
        // Look for OSC start sequence: ESC ]
        if (char === "]" && prevChar === ESC) {
          this.inOsc = true;
          this.buffer = "";
        }
      }
    }

    return result;
  }

  /**
   * Extracts the title from the buffer.
   * Buffer format after OSC start: "N;title" followed by terminator
   * Returns the title for OSC 0 and 2, null for others.
   */
  private extractTitle(): string | null {
    // Remove the terminator from buffer
    let content = this.buffer;
    if (content.endsWith(BEL)) {
      content = content.slice(0, -1);
    } else if (content.endsWith(ST)) {
      content = content.slice(0, -2);
    }

    // Parse "N;title" format
    const semicolonIndex = content.indexOf(";");
    if (semicolonIndex === -1) {
      return null;
    }

    const oscTypeStr = content.slice(0, semicolonIndex);
    const title = content.slice(semicolonIndex + 1);

    const oscType = parseInt(oscTypeStr, 10);
    // Only OSC 0 and 2 set window title; OSC 1 is icon name only
    if (oscType === 0 || oscType === 2) {
      return title;
    }

    return null;
  }

  /**
   * Resets the parser state.
   */
  private reset(): void {
    this.buffer = "";
    this.inOsc = false;
  }
}
