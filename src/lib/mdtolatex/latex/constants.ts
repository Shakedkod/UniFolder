// AUTO-GENERATED from src/logic/latex_constants.py — do not hand-edit.
// Regenerate with: python3 scripts/gen-constants.py

export const BASE_LATEX_DOC_START = `% ============================================================
% === Created by MDtoLatex - A Markdown to LaTeX Converter ===
% ====== Uni-Folder - https://github.com/ShakedKod/uni-folder ======
% ============================================================
\\documentclass[12pt]{article}`;

export const BASE_LATEX_TEXT = `% ---------- Fonts & language ----------
\\usepackage{hyperref}
\\usepackage{fontspec}
`;

export const LATEX_HEBREW_TEXT = `\\usepackage{polyglossia}
\\setdefaultlanguage{hebrew}
\\setotherlanguage{english}
\\IfFontExistsTF{David CLM}{\\newfontfamily\\hebrewfont{David CLM}}{\\IfFontExistsTF{David}{\\newfontfamily\\hebrewfont{David}}{\\IfFontExistsTF{Arial}{\\newfontfamily\\hebrewfont{Arial}}{\\IfFontExistsTF{Liberation Serif}{\\newfontfamily\\hebrewfont{Liberation Serif}}{\\newfontfamily\\hebrewfont{FreeSerif}}}}}
\\IfFontExistsTF{Nachlieli CLM}{\\newfontfamily\\titlefont{Nachlieli CLM}}{\\IfFontExistsTF{Arial}{\\newfontfamily\\titlefont{Arial}}{\\IfFontExistsTF{Liberation Sans}{\\newfontfamily\\titlefont{Liberation Sans}}{\\newfontfamily\\titlefont{FreeSans}}}}
\\IfFontExistsTF{Courier New}{\\setmonofont{Courier New}}{\\IfFontExistsTF{Consolas}{\\setmonofont{Consolas}}{\\IfFontExistsTF{Liberation Mono}{\\setmonofont{Liberation Mono}}{\\setmonofont{FreeMono}}}}
\\IfFontExistsTF{Courier New}{\\newfontfamily{\\hebrewfonttt}[Script=Hebrew]{Courier New}}{\\IfFontExistsTF{Consolas}{\\newfontfamily{\\hebrewfonttt}[Script=Hebrew]{Consolas}}{\\IfFontExistsTF{Liberation Mono}{\\newfontfamily{\\hebrewfonttt}[Script=Hebrew]{Liberation Mono}}{\\IfFontExistsTF{FreeMono}{\\newfontfamily{\\hebrewfonttt}[Script=Hebrew]{FreeMono}}{}}}}
\\IfFontExistsTF{Courier New}{\\newfontfamily\\englishfonttt{Courier New}}{\\IfFontExistsTF{Consolas}{\\newfontfamily\\englishfonttt{Consolas}}{\\IfFontExistsTF{Liberation Mono}{\\newfontfamily\\englishfonttt{Liberation Mono}}{}}}
\\IfFontExistsTF{Times New Roman}{\\newfontfamily\\englishfont{Times New Roman}}{\\IfFontExistsTF{Latin Modern Roman}{\\newfontfamily\\englishfont{Latin Modern Roman}}{\\IfFontExistsTF{Liberation Serif}{\\newfontfamily\\englishfont{Liberation Serif}}{\\newfontfamily\\englishfont{FreeSerif}}}}

\\renewcommand\\labelitemi{$\\bullet$}
\\renewcommand\\labelitemii{$\\circ$}
\\renewcommand\\labelitemiii{$\\ast$}
\\renewcommand\\labelitemiv{$\\cdot$}
`;

export const BASE_LATEX_MATH = `% ---------- Math ----------
\\usepackage{amsmath, amssymb, amsthm, mathtools, cancel}
\\usepackage{bm}          % \\bm for bold math (vectors etc.)
\\usepackage{physics}     % bra-ket, derivatives — optional, remove if unused
\\usepackage{adjustbox}   % fit math in tables
% Prevent inline math and long lines from overflowing margins
\\emergencystretch=3em
\\binoppenalty=9999
\\relpenalty=9999
% Auto-fit and center display math so wide formulas never overflow the page margins
\\makeatletter
\\renewenvironment{displaymath}{%
  \\begin{center}%
  \\begin{adjustbox}{max width=\\linewidth}%
  $\\displaystyle
}{%
  $%
  \\end{adjustbox}%
  \\end{center}%
}
\\renewcommand{\\[}{\\begin{displaymath}}
\\renewcommand{\\]}{\\end{displaymath}}
\\makeatother`;

export const BASE_LATEX_PAGE_LAYOUT = `% ---------- Page Layout ----------
\\usepackage{fancyhdr, fancy}
\\usepackage{lastpage}

\\pagestyle{fancy}
\\fancyhf{} % clear all header and footer fields
`;

export const LATEX_IMAGES_AND_DIAGRAMS = `% ---------- Images & Diagrams ----------
\\usepackage{relsize, graphicx, svg, geometry}
`;

export const LATEX_TIKZ = `\\usepackage{tikz, circuitikz}
\\usetikzlibrary{quotes, angles, shapes.gates.logic.US}
\\usetikzlibrary{arrows.meta, automata, positioning, calc, shapes.geometric, backgrounds, fit}
\\newcommand{\\tikzmark}[1]{\\tikz[overlay,remember picture] \\coordinate (#1);}
\\geometry{margin=2.5cm}
`;

export const BASIC_LATEX_MISC = `% ---------- Misc quality-of-life ----------
\\usepackage[toc]{appendix}
\\PassOptionsToPackage{prologue}{xcolor}
\\usepackage{xcolor, diagbox}
\\usepackage{titling, longtable, booktabs, array}
\\usepackage{parskip}

\\definecolor{linkblue}{HTML}{0997E6}
\\renewcommand{\\appendixpagename}{נספחים}
\\renewcommand{\\appendixtocname}{נספחים}

% section numbering depth & making sure the paragraph and subparagraph levels are numbered and appear correctly
\\setcounter{secnumdepth}{5} 
\\setcounter{tocdepth}{5}

\\makeatletter
\\renewcommand\\paragraph{\\@startsection{paragraph}{4}{\\z@}%
  {-3.25ex\\@plus -1ex \\@minus -.2ex}%
  {1.5ex \\@plus .2ex}%
  {\\normalfont\\normalsize\\bfseries}}
\\renewcommand\\subparagraph{\\@startsection{subparagraph}{5}{\\z@}%
  {-3.25ex\\@plus -1ex \\@minus -.2ex}%
  {1.5ex \\@plus .2ex}%
  {\\normalfont\\normalsize\\bfseries}}
\\makeatletter
`;

export const LATEX_THEME_REGULAR = `% ---------- Regular Theme ----------
\\theoremstyle{plain}
\\newtheorem{theorem}{Theorem}[section]      % thm
\\newtheorem{lemma}[theorem]{Lemma}          % lem
\\newtheorem{proposition}[theorem]{Proposition}   % prp
\\newtheorem{corollary}[theorem]{Corollary}    % cor
\\newtheorem{claim}[theorem]{Claim}     % clm
\\newtheorem{conjecture}[theorem]{Conjecture}   % cnj

\\theoremstyle{definition}
\\newtheorem{definition}[theorem]{Definition}   % def
\\newtheorem{axiom}[theorem]{Axiom}      % axm
\\newtheorem{assumption}[theorem]{Assumption}    % asm
\\newtheorem{example}[theorem]{Example}      % exm
\\newtheorem{exercise}[theorem]{Exercise}     % exr
\\newtheorem{hypothesis}[theorem]{Hypothesis} % hyp
\\newtheorem{hw}[theorem]{Homework}        % hw

\\theoremstyle{remark}
\\newtheorem*{remark}{Remark}                % rmk

\\makeatletter
\\renewenvironment{proof}[1][\\proofname]{\\par
  \\pushQED{\\qed}%
  \\normalfont \\topsep6\\p@\\@plus6\\p@\\relax
  \\trivlist
  \\item[\\hskip\\labelsep\\itshape #1\\@addpunct{.}]\\par\\ignorespaces
}{%
  \\popQED\\endtrivlist\\@endpefalse
}
\\renewcommand{\\qed}{\\par\\nobreak\\hfill\\qedsymbol\\par}
\\makeatother
\\renewcommand{\\proofname}{Proof}          % Proof
`;

export const LATEX_THEME_REGULAR_HEBREW = `% ---------- Regular Theme ----------
\\theoremstyle{plain}
\\newtheorem{theorem}{משפט}[section]      % thm
\\newtheorem{lemma}[theorem]{למה}          % lem
\\newtheorem{proposition}[theorem]{טענה}   % prp
\\newtheorem{corollary}[theorem]{מסקנה}    % cor
\\newtheorem{claim}[theorem]{טענה עזר}     % clm
\\newtheorem{conjecture}[theorem]{השערה}   % cnj

\\theoremstyle{definition}
\\newtheorem{definition}[theorem]{הגדרה}   % def
\\newtheorem{axiom}[theorem]{אקסיומה}      % axm
\\newtheorem{assumption}[theorem]{הנחה}    % asm
\\newtheorem{example}[theorem]{דוגמה}      % exm
\\newtheorem{exercise}[theorem]{תרגיל}     % exr
\\newtheorem{hypothesis}[theorem]{השערת עבודה} % hyp
\\newtheorem{hw}[theorem]{תרגיל בית}         % hw

\\theoremstyle{remark}
\\newtheorem*{remark}{הערה}                % rmk

\\makeatletter
\\renewenvironment{proof}[1][\\proofname]{\\par
  \\pushQED{\\qed}%
  \\normalfont \\topsep6\\p@\\@plus6\\p@\\relax
  \\trivlist
  \\item[\\hskip\\labelsep\\itshape #1\\@addpunct{.}]\\par\\ignorespaces
}{%
  \\popQED\\endtrivlist\\@endpefalse
}
\\renewcommand{\\qed}{\\par\\nobreak\\hfill\\qedsymbol\\par}
\\makeatother
\\renewcommand{\\proofname}{הוכחה}          % הוכחה
`;

export const LATEX_THEME_FANCY_ACADEMIC = `% ---------- Fancy Academic Theme ----------
\\usepackage[most]{tcolorbox}
\\usepackage{titlesec}

% ---- palette -------------------------------------------------------------
\\definecolor{faInk}{HTML}{1B2430}
\\definecolor{faAccent}{HTML}{2C4A7C}
\\definecolor{faTheorem}{HTML}{7B2D4E}
\\definecolor{faDefinition}{HTML}{2C4A7C}
\\definecolor{faExample}{HTML}{2E6B4F}
\\definecolor{faRemark}{HTML}{5B5B66}
\\definecolor{faWarn}{HTML}{9A6100}

% Academic papers use quiet coloured links, not hyperref's default boxes.
\\hypersetup{colorlinks=true, linkcolor=faAccent, citecolor=faAccent,
  urlcolor=faAccent!85!black, filecolor=faAccent!85!black}

% ---- headings ------------------------------------------------------------
\\titleformat{\\part}[display]
  {\\normalfont\\huge\\bfseries\\color{faAccent}}{\\partname\\ \\thepart}{12pt}{\\Huge}
\\titleformat{\\section}
  {\\normalfont\\Large\\bfseries\\color{faAccent}}{\\thesection}{0.8em}{}
  [{\\color{faAccent!30}\\titlerule[1pt]}]
\\titleformat{\\subsection}
  {\\normalfont\\large\\bfseries\\color{faAccent!85!black}}{\\thesubsection}{0.7em}{}
\\titleformat{\\subsubsection}
  {\\normalfont\\normalsize\\bfseries\\color{faInk}}{\\thesubsubsection}{0.6em}{}
\\titlespacing*{\\section}{0pt}{2.4ex plus 1ex minus .2ex}{1.3ex plus .2ex}
\\titlespacing*{\\subsection}{0pt}{2.0ex plus .8ex minus .2ex}{1.0ex plus .2ex}

% ---- title block ---------------------------------------------------------
\\pretitle{\\begin{center}{\\color{faAccent}\\rule{\\linewidth}{1.2pt}}\\par\\vspace{0.9em}%
  \\LARGE\\bfseries\\color{faInk}}
\\posttitle{\\par\\vspace{0.7em}{\\color{faAccent}\\rule{\\linewidth}{0.4pt}}\\end{center}\\vspace{0.4em}}
\\preauthor{\\begin{center}\\large\\color{faInk}}
\\postauthor{\\end{center}}
\\predate{\\begin{center}\\small\\itshape\\color{faRemark}}
\\postdate{\\end{center}\\vspace{0.6em}}

% ---- theorem environments ------------------------------------------------
\\theoremstyle{plain}
\\newtheorem{theorem}{Theorem}[section]      % thm
\\newtheorem{lemma}[theorem]{Lemma}          % lem
\\newtheorem{proposition}[theorem]{Proposition}   % prp
\\newtheorem{corollary}[theorem]{Corollary}    % cor
\\newtheorem{claim}[theorem]{Claim}     % clm
\\newtheorem{conjecture}[theorem]{Conjecture}   % cnj

\\theoremstyle{definition}
\\newtheorem{definition}[theorem]{Definition}   % def
\\newtheorem{axiom}[theorem]{Axiom}      % axm
\\newtheorem{assumption}[theorem]{Assumption}    % asm
\\newtheorem{example}[theorem]{Example}      % exm
\\newtheorem{exercise}[theorem]{Exercise}     % exr
\\newtheorem{hypothesis}[theorem]{Hypothesis} % hyp
\\newtheorem{hw}[theorem]{Homework}        % hw

\\theoremstyle{remark}
\\newtheorem*{remark}{Remark}                % rmk

\\makeatletter
% A list-free proof: amsthm's trivlist version breaks when the body opens with
% a tcolorbox (a boxed [!hw] callout nested inside a proof, for example).
\\renewenvironment{proof}[1][\\proofname]{\\par\\addvspace{\\medskipamount}%
  \\pushQED{\\qed}\\normalfont\\noindent{\\itshape #1\\@addpunct{.}}\\enspace\\ignorespaces
}{%
  \\popQED\\par\\addvspace{\\medskipamount}%
}
\\renewcommand{\\qed}{\\par\\nobreak\\hfill\\qedsymbol\\par}
\\makeatother
\\renewcommand{\\proofname}{\\textcolor{faRemark}{Proof}}          % Proof

% ---- boxed skins ---------------------------------------------------------
% The amsthm environments above keep their \\begin{theorem}[Title] calling
% convention; tcolorbox only restyles them, so the renderer stays unchanged.
\\tcbset{fabox/.style={enhanced, breakable, sharp corners, boxrule=0pt,
  leftrule=2.5pt, rightrule=0pt, toprule=0pt, bottomrule=0pt,
  left=9pt, right=9pt, top=7pt, bottom=7pt,
  before skip=9pt, after skip=9pt, fonttitle=\\bfseries}}

\\tcolorboxenvironment{theorem}{fabox, colback=faTheorem!4, colframe=faTheorem}
\\tcolorboxenvironment{lemma}{fabox, colback=faTheorem!3, colframe=faTheorem!70}
\\tcolorboxenvironment{proposition}{fabox, colback=faTheorem!3, colframe=faTheorem!70}
\\tcolorboxenvironment{corollary}{fabox, colback=faTheorem!3, colframe=faTheorem!55}
\\tcolorboxenvironment{claim}{fabox, colback=faTheorem!3, colframe=faTheorem!55}
\\tcolorboxenvironment{conjecture}{fabox, colback=faWarn!5, colframe=faWarn}
\\tcolorboxenvironment{definition}{fabox, colback=faDefinition!5, colframe=faDefinition}
\\tcolorboxenvironment{axiom}{fabox, colback=faDefinition!4, colframe=faDefinition!75}
\\tcolorboxenvironment{assumption}{fabox, colback=faDefinition!4, colframe=faDefinition!60}
\\tcolorboxenvironment{hypothesis}{fabox, colback=faWarn!4, colframe=faWarn!80}
\\tcolorboxenvironment{example}{fabox, colback=faExample!5, colframe=faExample}
\\tcolorboxenvironment{exercise}{fabox, colback=faExample!4, colframe=faExample!70}
\\tcolorboxenvironment{hw}{fabox, colback=faExample!4, colframe=faExample!55}
\\tcolorboxenvironment{remark}{fabox, colback=faRemark!5, colframe=faRemark!70}
`;

export const LATEX_THEME_FANCY_ACADEMIC_HEBREW = `% ---------- Fancy Academic Theme ----------
% tcolorbox is unusable under bidi/RTL: its boxes collapse to the page edge
% and lose their frames entirely. mdframed is TeX-box based and lays RTL
% content out correctly, so the Hebrew theme boxes its environments with it.
\\usepackage[framemethod=default]{mdframed}
\\usepackage{titlesec}

% ---- palette -------------------------------------------------------------
\\definecolor{faInk}{HTML}{1B2430}
\\definecolor{faAccent}{HTML}{2C4A7C}
\\definecolor{faTheorem}{HTML}{7B2D4E}
\\definecolor{faDefinition}{HTML}{2C4A7C}
\\definecolor{faExample}{HTML}{2E6B4F}
\\definecolor{faRemark}{HTML}{5B5B66}
\\definecolor{faWarn}{HTML}{9A6100}

% Academic papers use quiet coloured links, not hyperref's default boxes.
\\hypersetup{colorlinks=true, linkcolor=faAccent, citecolor=faAccent,
  urlcolor=faAccent!85!black, filecolor=faAccent!85!black}

% ---- headings ------------------------------------------------------------
\\titleformat{\\part}[display]
  {\\normalfont\\huge\\bfseries\\color{faAccent}}{\\partname\\ \\thepart}{12pt}{\\Huge}
\\titleformat{\\section}
  {\\normalfont\\Large\\bfseries\\color{faAccent}}{\\thesection}{0.8em}{}
  [{\\color{faAccent!30}\\titlerule[1pt]}]
\\titleformat{\\subsection}
  {\\normalfont\\large\\bfseries\\color{faAccent!85!black}}{\\thesubsection}{0.7em}{}
\\titleformat{\\subsubsection}
  {\\normalfont\\normalsize\\bfseries\\color{faInk}}{\\thesubsubsection}{0.6em}{}
\\titlespacing*{\\section}{0pt}{2.4ex plus 1ex minus .2ex}{1.3ex plus .2ex}
\\titlespacing*{\\subsection}{0pt}{2.0ex plus .8ex minus .2ex}{1.0ex plus .2ex}

% ---- title block ---------------------------------------------------------
\\pretitle{\\begin{center}{\\color{faAccent}\\rule{\\linewidth}{1.2pt}}\\par\\vspace{0.9em}%
  \\LARGE\\bfseries\\color{faInk}}
\\posttitle{\\par\\vspace{0.7em}{\\color{faAccent}\\rule{\\linewidth}{0.4pt}}\\end{center}\\vspace{0.4em}}
\\preauthor{\\begin{center}\\large\\color{faInk}}
\\postauthor{\\end{center}}
\\predate{\\begin{center}\\small\\itshape\\color{faRemark}}
\\postdate{\\end{center}\\vspace{0.6em}}

% ---- theorem environments ------------------------------------------------
\\theoremstyle{plain}
\\newtheorem{theorem}{משפט}[section]      % thm
\\newtheorem{lemma}[theorem]{למה}          % lem
\\newtheorem{proposition}[theorem]{טענה}   % prp
\\newtheorem{corollary}[theorem]{מסקנה}    % cor
\\newtheorem{claim}[theorem]{טענה עזר}     % clm
\\newtheorem{conjecture}[theorem]{השערה}   % cnj

\\theoremstyle{definition}
\\newtheorem{definition}[theorem]{הגדרה}   % def
\\newtheorem{axiom}[theorem]{אקסיומה}      % axm
\\newtheorem{assumption}[theorem]{הנחה}    % asm
\\newtheorem{example}[theorem]{דוגמה}      % exm
\\newtheorem{exercise}[theorem]{תרגיל}     % exr
\\newtheorem{hypothesis}[theorem]{השערת עבודה} % hyp
\\newtheorem{hw}[theorem]{תרגיל בית}         % hw

\\theoremstyle{remark}
\\newtheorem*{remark}{הערה}                % rmk

\\makeatletter
% A list-free proof: amsthm's trivlist version breaks when the body opens with
% a framed box (a boxed [!hw] callout nested inside a proof, for example).
\\renewenvironment{proof}[1][\\proofname]{\\par\\addvspace{\\medskipamount}%
  \\pushQED{\\qed}\\normalfont\\noindent{\\itshape #1\\@addpunct{.}}\\enspace\\ignorespaces
}{%
  \\popQED\\par\\addvspace{\\medskipamount}%
}
\\renewcommand{\\qed}{\\par\\nobreak\\hfill\\qedsymbol\\par}
\\makeatother
\\renewcommand{\\proofname}{\\textcolor{faRemark}{הוכחה}}          % הוכחה

% ---- boxed skins ---------------------------------------------------------
% The amsthm environments above keep their \\begin{theorem}[Title] calling
% convention; mdframed only surrounds them, so the renderer stays unchanged.
% The accent rule sits on the right-hand (leading) edge for RTL.
\\mdfdefinestyle{fabox}{hidealllines=true, rightline=true, linewidth=2.5pt,
  innertopmargin=7pt, innerbottommargin=7pt, innerleftmargin=10pt,
  innerrightmargin=10pt, skipabove=9pt, skipbelow=9pt,
  splittopskip=7pt, splitbottomskip=7pt}

\\surroundwithmdframed[style=fabox, linecolor=faTheorem, backgroundcolor=faTheorem!4]{theorem}
\\surroundwithmdframed[style=fabox, linecolor=faTheorem!70, backgroundcolor=faTheorem!3]{lemma}
\\surroundwithmdframed[style=fabox, linecolor=faTheorem!70, backgroundcolor=faTheorem!3]{proposition}
\\surroundwithmdframed[style=fabox, linecolor=faTheorem!55, backgroundcolor=faTheorem!3]{corollary}
\\surroundwithmdframed[style=fabox, linecolor=faTheorem!55, backgroundcolor=faTheorem!3]{claim}
\\surroundwithmdframed[style=fabox, linecolor=faWarn, backgroundcolor=faWarn!5]{conjecture}
\\surroundwithmdframed[style=fabox, linecolor=faDefinition, backgroundcolor=faDefinition!5]{definition}
\\surroundwithmdframed[style=fabox, linecolor=faDefinition!75, backgroundcolor=faDefinition!4]{axiom}
\\surroundwithmdframed[style=fabox, linecolor=faDefinition!60, backgroundcolor=faDefinition!4]{assumption}
\\surroundwithmdframed[style=fabox, linecolor=faWarn!80, backgroundcolor=faWarn!4]{hypothesis}
\\surroundwithmdframed[style=fabox, linecolor=faExample, backgroundcolor=faExample!5]{example}
\\surroundwithmdframed[style=fabox, linecolor=faExample!70, backgroundcolor=faExample!4]{exercise}
\\surroundwithmdframed[style=fabox, linecolor=faExample!55, backgroundcolor=faExample!4]{hw}
\\surroundwithmdframed[style=fabox, linecolor=faRemark!70, backgroundcolor=faRemark!5]{remark}
`;

export const LATEX_ALGORITHM_SETUP = `% ---------- Pseudocode / Algorithm Setup ----------
\\usepackage{algorithm}
\\usepackage{algpseudocode}
\\algnewcommand\\algorithmicinput{\\textbf{Input:}}
\\algnewcommand\\INPUT{\\item[\\algorithmicinput]}
\\algnewcommand\\algorithmicoutput{\\textbf{Output:}}
\\algnewcommand\\OUTPUT{\\item[\\algorithmicoutput]}
\\algnewcommand\\TO{\\textbf{to}}
\\algnewcommand\\AND{\\textbf{and}}
\\algnewcommand\\OR{\\textbf{or}}
\\algnewcommand\\NOT{\\textbf{not}}
\\providecommand{\\STATE}{\\State}
\\providecommand{\\FOR}{\\For}
\\providecommand{\\ENDFOR}{\\EndFor}
\\providecommand{\\WHILE}{\\While}
\\providecommand{\\ENDWHILE}{\\EndWhile}
\\providecommand{\\IF}{\\If}
\\providecommand{\\ELSE}{\\Else}
\\providecommand{\\ELSIF}{\\ElsIf}
\\providecommand{\\ENDIF}{\\EndIf}
\\providecommand{\\RETURN}{\\Return}
\\providecommand{\\FUNCTION}{\\Function}
\\providecommand{\\ENDFUNCTION}{\\EndFunction}
\\providecommand{\\PROCEDURE}{\\Procedure}
\\providecommand{\\ENDPROCEDURE}{\\EndProcedure}
\\providecommand{\\COMMENT}{\\Comment}
\\providecommand{\\CALL}{\\Call}
`;

export const LATEX_CODEBLOCK_SETUP = `\\usepackage{listings}
% ---------- Assembler Codeblock Setup ----------
% Define colors
\\definecolor{commentgreen}{rgb}{0,0.6,0}
\\definecolor{keywordblue}{rgb}{0,0,0.8}
\\definecolor{registerpurple}{rgb}{0.5,0,0.5}
\\definecolor{stringorange}{rgb}{0.8,0.4,0}
\\definecolor{gold}{HTML}{FFD700}
\\definecolor{myblue}{RGB}{37,97,175}

% Define the RISC-V Language Dialect
\\lstdefinelanguage{assembly}{
    alsoletter={.}, % Allow dots in keywords like .text or .global
    alsodigit={0x}, % Properly identify hex values
    morekeywords=[1]{ % Core RISC-V Instructions
        add, addi, sub, lui, auipc, xor, xori, or, ori, and, andi,
        sll, slli, srl, srli, sra, srai, slt, slti, sltu, sltiu,
        beq, bne, blt, bge, bltu, bgeu, jal, jalr, lw, lh, lb,
        lbu, lhu, sw, sh, sb, ECALL, ecall, EBREAK, ebreak,
        % Common Pseudoinstructions
        li, la, mv, not, neg, seqz, snez, sltz, sgtz,
        j, jr, jal, ret, call, tail, nop
    },
    morekeywords=[2]{ % RISC-V Registers (ABI and Symbolic names)
        x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10, x11, x12, x13, x14, x15,
        x16, x17, x18, x19, x20, x21, x22, x23, x24, x25, x26, x27, x28, x29, x30, x31,
        zero, ra, sp, gp, tp, t0, t1, t2, s0, fp, s1, a0, a1, a2, a3, a4, a5, a6, a7,
        s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, t3, t4, t5, t6
    },
    morekeywords=[3]{ % Assembler Directives
        .text, .data, .rodata, .bss, .globl, .global, .align, .word, .half, .byte, .asciiz, .string, .section
    },
    showstringspaces=false,
    morecomment=[l]{\\#},      % Standard RISC-V comments start with #
    morecomment=[l]{;},       % Fallback comment style
    morestring=[b]",          % Double quotes strings
    morestring=[b]'           % Single quotes strings
}[keywords,comments,strings]

\\lstdefinelanguage{Assembler}{
    alsoletter={.}, % Allow dots in keywords like .text or .global
    alsodigit={0x}, % Properly identify hex values
    morekeywords=[1]{ % Core RISC-V Instructions
        add, addi, sub, lui, auipc, xor, xori, or, ori, and, andi,
        sll, slli, srl, srli, sra, srai, slt, slti, sltu, sltiu,
        beq, bne, blt, bge, bltu, bgeu, jal, jalr, lw, lh, lb,
        lbu, lhu, sw, sh, sb, ECALL, ecall, EBREAK, ebreak,
        % Common Pseudoinstructions
        li, la, mv, not, neg, seqz, snez, sltz, sgtz,
        j, jr, jal, ret, call, tail, nop
    },
    morekeywords=[2]{ % RISC-V Registers (ABI and Symbolic names)
        x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10, x11, x12, x13, x14, x15,
        x16, x17, x18, x19, x20, x21, x22, x23, x24, x25, x26, x27, x28, x29, x30, x31,
        zero, ra, sp, gp, tp, t0, t1, t2, s0, fp, s1, a0, a1, a2, a3, a4, a5, a6, a7,
        s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, t3, t4, t5, t6
    },
    morekeywords=[3]{ % Assembler Directives
        .text, .data, .rodata, .bss, .globl, .global, .align, .word, .half, .byte, .asciiz, .string, .section
    },
    showstringspaces=false,
    morecomment=[l]{\\#},      % Standard RISC-V comments start with #
    morecomment=[l]{;},       % Fallback comment style
    morestring=[b]",          % Double quotes strings
    morestring=[b]'           % Single quotes strings
}[keywords,comments,strings]

\\lstdefinelanguage{asm}{
    alsoletter={.}, % Allow dots in keywords like .text or .global
    alsodigit={0x}, % Properly identify hex values
    morekeywords=[1]{ % Core RISC-V Instructions
        add, addi, sub, lui, auipc, xor, xori, or, ori, and, andi,
        sll, slli, srl, srli, sra, srai, slt, slti, sltu, sltiu,
        beq, bne, blt, bge, bltu, bgeu, jal, jalr, lw, lh, lb,
        lbu, lhu, sw, sh, sb, ECALL, ecall, EBREAK, ebreak,
        % Common Pseudoinstructions
        li, la, mv, not, neg, seqz, snez, sltz, sgtz,
        j, jr, jal, ret, call, tail, nop
    },
    morekeywords=[2]{ % RISC-V Registers (ABI and Symbolic names)
        x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10, x11, x12, x13, x14, x15,
        x16, x17, x18, x19, x20, x21, x22, x23, x24, x25, x26, x27, x28, x29, x30, x31,
        zero, ra, sp, gp, tp, t0, t1, t2, s0, fp, s1, a0, a1, a2, a3, a4, a5, a6, a7,
        s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, t3, t4, t5, t6
    },
    morekeywords=[3]{ % Assembler Directives
        .text, .data, .rodata, .bss, .globl, .global, .align, .word, .half, .byte, .asciiz, .string, .section
    },
    showstringspaces=false,
    morecomment=[l]{\\#},      % Standard RISC-V comments start with #
    morecomment=[l]{;},       % Fallback comment style
    morestring=[b]",          % Double quotes strings
    morestring=[b]'           % Single quotes strings
}[keywords,comments,strings]

\\lstdefinelanguage{riscv}{
    alsoletter={.}, % Allow dots in keywords like .text or .global
    alsodigit={0x}, % Properly identify hex values
    morekeywords=[1]{ % Core RISC-V Instructions
        add, addi, sub, lui, auipc, xor, xori, or, ori, and, andi,
        sll, slli, srl, srli, sra, srai, slt, slti, sltu, sltiu,
        beq, bne, blt, bge, bltu, bgeu, jal, jalr, lw, lh, lb,
        lbu, lhu, sw, sh, sb, ECALL, ecall, EBREAK, ebreak,
        % Common Pseudoinstructions
        li, la, mv, not, neg, seqz, snez, sltz, sgtz,
        j, jr, jal, ret, call, tail, nop
    },
    morekeywords=[2]{ % RISC-V Registers (ABI and Symbolic names)
        x0, x1, x2, x3, x4, x5, x6, x7, x8, x9, x10, x11, x12, x13, x14, x15,
        x16, x17, x18, x19, x20, x21, x22, x23, x24, x25, x26, x27, x28, x29, x30, x31,
        zero, ra, sp, gp, tp, t0, t1, t2, s0, fp, s1, a0, a1, a2, a3, a4, a5, a6, a7,
        s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, t3, t4, t5, t6
    },
    morekeywords=[3]{ % Assembler Directives
        .text, .data, .rodata, .bss, .globl, .global, .align, .word, .half, .byte, .asciiz, .string, .section
    },
    showstringspaces=false,
    morecomment=[l]{\\#},      % Standard RISC-V comments start with #
    morecomment=[l]{;},       % Fallback comment style
    morestring=[b]",          % Double quotes strings
    morestring=[b]'           % Single quotes strings
}[keywords,comments,strings]

% Apply Styles globally to the document
\\lstset{
    basicstyle={\\small\\ttfamily},
    keywordstyle=[1]\\color{keywordblue}\\bfseries,
    keywordstyle=[2]\\color{registerpurple},
    keywordstyle=[3]\\color{gray}\\bfseries,
    commentstyle=\\color{commentgreen}\\itshape,
    stringstyle=\\color{stringorange},
    numbers=left,
    numberstyle=\\tiny\\color{gray},
    frame=single,
    tabsize=4,
    breaklines=true
}
`;

export const START_OF_DOCUMENT_CONTENT = `
% ============================================================
% THE START OF THE DOCUMENT CONTENT
% ============================================================
\\begin{document}
\\maketitle
`;

export const LATEX_TABLE_OF_CONTENTS = `\\tableofcontents
\\newpage
`;

export const EXTRA_LATEX_PACKAGES_HEADER = `% ---------- Extra LaTeX Packages ----------
`;

export const CREDIT_BOX = `\\vspace{2cm}
\\begin{center}
\\fbox{
    \\begin{minipage}{0.9\\textwidth}
        \\vspace{0.2cm} % מרווח קטן בחלק העליון
        \\begin{center} % מרכוז הטקסט בתוך הקופסה
            רשימות אלו נלקחו מהאתם {\\color{linkblue}\\underline{\\href{https://uni-folder.vercel.app/}{uni-folder}}} מוזמנים לבקר שם ולראות סיכומים נוספים.

            \\vspace{0.3cm}

            כל הסיכום הזה אינו מובטח להיות מלא או נכון ב-\\(100\\%\\). יכולות להיות פה טעויות כתיב ואף טעויות בחומר. אם אתם מוצאים כאלו מוזמנים לפתוח Issue ב-GitHub או ליצור קשר באתר.
        \\end{center}
        \\vspace{0.1cm} % מרווח קטן בחלק התחתון
    \\end{minipage}
}
\\end{center}
\\vspace{2cm}
`;

export const BASE_LATEX_DOC_END = `\\end{document}`;
