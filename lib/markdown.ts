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
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, '<img src="$2" alt="$1" class="max-w-full rounded border my-2" />')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a class="text-blue-600 underline" href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-gray-100 text-sm">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');
}

export function renderMarkdownToHtml(markdown: string) {
  const lines = escapeHtml(markdown || '').split(/\r?\n/);
  const out: string[] = [];
  let inCode = false;
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith('```')) {
      closeLists();
      if (!inCode) {
        inCode = true;
        out.push('<pre class="bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto text-sm"><code>');
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
      out.push('<br />');
      continue;
    }

    if (line === '---' || line === '***') {
      closeLists();
      out.push('<hr class="my-4" />');
      continue;
    }

    if (line.startsWith('> ')) {
      closeLists();
      out.push(`<blockquote class="border-l-4 border-gray-300 pl-3 italic text-gray-700 my-2">${inlineMarkdown(line.slice(2))}</blockquote>`);
      continue;
    }

    if (line.startsWith('### ')) { closeLists(); out.push(`<h3 class="text-lg font-semibold mt-4 mb-2">${inlineMarkdown(line.slice(4))}</h3>`); continue; }
    if (line.startsWith('## ')) { closeLists(); out.push(`<h2 class="text-xl font-semibold mt-5 mb-2">${inlineMarkdown(line.slice(3))}</h2>`); continue; }
    if (line.startsWith('# ')) { closeLists(); out.push(`<h1 class="text-2xl font-bold mt-5 mb-3">${inlineMarkdown(line.slice(2))}</h1>`); continue; }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inUl) { closeLists(); inUl = true; out.push('<ul class="list-disc ml-5 space-y-1">'); }
      out.push(`<li>${inlineMarkdown(line.slice(2))}</li>`);
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      if (!inOl) { closeLists(); inOl = true; out.push('<ol class="list-decimal ml-5 space-y-1">'); }
      out.push(`<li>${inlineMarkdown(line.replace(/^\d+\.\s/, ''))}</li>`);
      continue;
    }

    closeLists();
    out.push(`<p class="leading-7">${inlineMarkdown(line)}</p>`);
  }

  closeLists();
  if (inCode) out.push('</code></pre>');
  return out.join('');
}
