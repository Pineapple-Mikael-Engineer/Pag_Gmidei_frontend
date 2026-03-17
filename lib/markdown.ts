function escapeHtml(input: string) {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineMarkdown(line: string) {
  return line
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a class="md-link" href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');
}

function alertFromBlockquote(value: string): { title: string; body: string; type: 'note' | 'warning' | 'tip' } | null {
  const match = value.match(/^\[!(NOTE|WARNING|TIP)\]\s*(.*)$/i);
  if (!match) return null;
  const type = match[1].toLowerCase() as 'note' | 'warning' | 'tip';
  const title = type === 'warning' ? 'Alerta' : type === 'tip' ? 'Tip' : 'Nota';
  return { type, title, body: match[2] };
}

export function renderMarkdownToHtml(markdown: string) {
  const lines = escapeHtml(markdown || '').split(/\r?\n/);
  const out: string[] = [];
  let inCode = false;
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith('```')) {
      closeLists();
      if (!inCode) {
        inCode = true;
        out.push('<pre class="md-code"><code>');
      } else {
        inCode = false;
        out.push('</code></pre>');
      }
      continue;
    }

    if (inCode) {
      out.push(`${line}\n`);
      continue;
    }

    if (!line.trim()) {
      closeLists();
      continue;
    }

    if (line.startsWith('### ')) {
      closeLists();
      out.push(`<h3 class="md-h3">${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      closeLists();
      out.push(`<h2 class="md-h2">${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      closeLists();
      out.push(`<h1 class="md-h1">${inlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }

    if (line.startsWith('> ')) {
      closeLists();
      const blockContent = line.slice(2);
      const alertData = alertFromBlockquote(blockContent);
      if (alertData) {
        out.push(`<div class="md-alert md-alert-${alertData.type}"><p class="md-alert-title">${alertData.title}</p><p>${inlineMarkdown(alertData.body)}</p></div>`);
      } else {
        out.push(`<blockquote class="md-quote">${inlineMarkdown(blockContent)}</blockquote>`);
      }
      continue;
    }

    const checklistMatch = line.match(/^[-*]\s\[( |x|X)\]\s(.+)$/);
    if (checklistMatch) {
      if (!inUl) {
        closeLists();
        inUl = true;
        out.push('<ul class="md-list">');
      }
      const checked = checklistMatch[1].toLowerCase() === 'x';
      out.push(`<li class="md-check"><input type="checkbox" disabled ${checked ? 'checked' : ''} /> <span>${inlineMarkdown(checklistMatch[2])}</span></li>`);
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inUl) {
        closeLists();
        inUl = true;
        out.push('<ul class="md-list">');
      }
      out.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      if (!inOl) {
        closeLists();
        inOl = true;
        out.push('<ol class="md-list md-list-ol">');
      }
      out.push(`<li>${inlineMarkdown(line.replace(/^\d+\.\s/, ''))}</li>`);
      continue;
    }

    closeLists();
    out.push(`<p class="md-p">${inlineMarkdown(line)}</p>`);
  }

  closeLists();
  if (inCode) out.push('</code></pre>');
  return out.join('');
}
