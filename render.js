import markdownIt from 'https://cdn.jsdelivr.net/npm/markdown-it@14.2.0/+esm';
import katex from 'https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.mjs';
import markdownItTexmath from 'https://cdn.jsdelivr.net/npm/markdown-it-texmath@1.0.0/+esm'

const md = markdownIt({
  html: false,
  linkify: true,
  breaks: true
});
md.use(markdownItTexmath, {
  engine: katex,
  delimiters: 'brackets'
});

export default md;