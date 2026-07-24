import React, { useMemo } from 'react';
import katex from 'katex';

interface MathProps {
  math: string;
  block?: boolean;
  className?: string;
}

export const Math: React.FC<MathProps> = ({ math, block = false, className = '' }) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        displayMode: block,
        throwOnError: false,
      });
    } catch (e) {
      console.error('KaTeX error:', e);
      return math;
    }
  }, [math, block]);

  return (
    <span
      className={`inline-katex ${block ? 'block text-center my-2 overflow-x-auto py-1' : 'inline-block px-0.5'} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

interface LaTeXTextProps {
  text: string;
  className?: string;
}

/**
  Parse strings containing $inline$ or $$block$$ math and render KaTeX seamlessly
 */
export const LaTeXText: React.FC<LaTeXTextProps> = ({ text, className = '' }) => {
  const elements = useMemo(() => {
    if (!text) return null;

    // Split by $$ or $
    const parts: React.ReactNode[] = [];
    const regex = /(\$\$.*?\$\$|\$.*?\$)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add preceding plain text
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const raw = match[0];
      if (raw.startsWith('$$') && raw.endsWith('$$')) {
        const formula = raw.slice(2, -2);
        parts.push(<Math key={match.index} math={formula} block />);
      } else if (raw.startsWith('$') && raw.endsWith('$')) {
        const formula = raw.slice(1, -1);
        parts.push(<Math key={match.index} math={formula} />);
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  }, [text]);

  return <span className={className}>{elements}</span>;
};

export default Math;
