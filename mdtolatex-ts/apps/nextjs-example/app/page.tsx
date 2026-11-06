import Converter from './components/Converter';

export default function Page() {
  return (
    <main>
      <header>
        <h1>MDtoLatex</h1>
        <p>
          Paste Obsidian-flavored Markdown — callouts, wikilinks, math, Mermaid, DOT and Desmos
          blocks — and get a complete LaTeX document.
        </p>
      </header>
      <Converter />
    </main>
  );
}
