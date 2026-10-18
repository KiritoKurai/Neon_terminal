// Neon Terminal skins.
// ui:   interface colors (tabs, bars, panels)
// term: terminal ANSI palette (xterm.js format)
window.NEON_THEMES = {
  claude: {
    label: 'Claude',
    ui: { accent: '#d97757', accent2: '#f0b48a', bg: '#1a1714', surface: '#24201c', text: '#f2ece4', muted: '#9b9087' },
    term: {
      background: '#1a1714', foreground: '#f2ece4', cursor: '#d97757', cursorAccent: '#1a1714', selectionBackground: '#d9775755',
      black: '#2b2622', red: '#e5735f', green: '#9fc178', yellow: '#e8c07d', blue: '#7fa7d9', magenta: '#c99bd9', cyan: '#7cc6c0', white: '#d9d0c5',
      brightBlack: '#6b625a', brightRed: '#ff8f78', brightGreen: '#b8db8f', brightYellow: '#ffd796', brightBlue: '#9ec2ef', brightMagenta: '#e0b6ef', brightCyan: '#9be0da', brightWhite: '#ffffff'
    }
  },
  cyberpunk: {
    label: 'Cyberpunk',
    ui: { accent: '#00f0ff', accent2: '#ff2bd6', bg: '#0a0614', surface: '#140c26', text: '#e6f7ff', muted: '#7a7aa8' },
    term: {
      background: '#0a0614', foreground: '#e6f7ff', cursor: '#00f0ff', cursorAccent: '#0a0614', selectionBackground: '#ff2bd655',
      black: '#1b1230', red: '#ff3864', green: '#3dff9b', yellow: '#fff03d', blue: '#3d8bff', magenta: '#ff2bd6', cyan: '#00f0ff', white: '#d6d6f5',
      brightBlack: '#5a4f80', brightRed: '#ff6b8f', brightGreen: '#7affc0', brightYellow: '#fff67a', brightBlue: '#7ab0ff', brightMagenta: '#ff70e6', brightCyan: '#7af7ff', brightWhite: '#ffffff'
    }
  },
  matrix: {
    label: 'Matrix',
    ui: { accent: '#00ff66', accent2: '#9dff00', bg: '#000a03', surface: '#031408', text: '#b8ffcc', muted: '#2f8f4f' },
    term: {
      background: '#000a03', foreground: '#7dffa6', cursor: '#00ff66', cursorAccent: '#000000', selectionBackground: '#00ff6644',
      black: '#001a08', red: '#3cff7a', green: '#00ff66', yellow: '#b6ff4d', blue: '#00c853', magenta: '#69f0ae', cyan: '#64ffda', white: '#b8ffcc',
      brightBlack: '#1f6b3a', brightRed: '#7cff9f', brightGreen: '#66ff99', brightYellow: '#d4ff8a', brightBlue: '#4dff88', brightMagenta: '#a5ffd0', brightCyan: '#a7ffeb', brightWhite: '#eaffef'
    }
  },
  tron: {
    label: 'Tron Legacy',
    ui: { accent: '#6fe3ff', accent2: '#ff9a3c', bg: '#02080d', surface: '#071722', text: '#d8f6ff', muted: '#4c7a8c' },
    term: {
      background: '#02080d', foreground: '#c7f2ff', cursor: '#6fe3ff', cursorAccent: '#02080d', selectionBackground: '#6fe3ff44',
      black: '#0b1a24', red: '#ff6a3c', green: '#4dffd2', yellow: '#ffc94d', blue: '#3ca8ff', magenta: '#b88cff', cyan: '#6fe3ff', white: '#c7f2ff',
      brightBlack: '#36586a', brightRed: '#ff9a3c', brightGreen: '#8affe5', brightYellow: '#ffe08a', brightBlue: '#82c8ff', brightMagenta: '#d3b8ff', brightCyan: '#a8f0ff', brightWhite: '#ffffff'
    }
  },
  synthwave: {
    label: 'Synthwave 84',
    ui: { accent: '#ff7edb', accent2: '#fede5d', bg: '#1a1029', surface: '#261b3d', text: '#f8f0ff', muted: '#8a75b0' },
    term: {
      background: '#1a1029', foreground: '#f8f0ff', cursor: '#ff7edb', cursorAccent: '#1a1029', selectionBackground: '#ff7edb44',
      black: '#2a1f40', red: '#fe4450', green: '#72f1b8', yellow: '#fede5d', blue: '#36c2ff', magenta: '#ff7edb', cyan: '#03edf9', white: '#e8dfff',
      brightBlack: '#6b5a90', brightRed: '#ff6e78', brightGreen: '#9cf5cf', brightYellow: '#fff08a', brightBlue: '#73d6ff', brightMagenta: '#ffa8e8', brightCyan: '#6ff6fc', brightWhite: '#ffffff'
    }
  },
  bladerunner: {
    label: 'Blade Runner',
    ui: { accent: '#ffb347', accent2: '#ff5e3a', bg: '#0d0905', surface: '#1a120a', text: '#ffe6c2', muted: '#8f6f4a' },
    term: {
      background: '#0d0905', foreground: '#ffd9a0', cursor: '#ffb347', cursorAccent: '#0d0905', selectionBackground: '#ffb34744',
      black: '#211609', red: '#ff5e3a', green: '#d9c25c', yellow: '#ffb347', blue: '#c98a4b', magenta: '#ff7f6b', cyan: '#ffcf87', white: '#ffe6c2',
      brightBlack: '#6e5233', brightRed: '#ff8a6b', brightGreen: '#f0dc85', brightYellow: '#ffcc80', brightBlue: '#e0aa70', brightMagenta: '#ffa597', brightCyan: '#ffe2b0', brightWhite: '#fff6e8'
    }
  },
  arctic: {
    label: 'Arctic',
    ui: { accent: '#88c0d0', accent2: '#b48ead', bg: '#121821', surface: '#1b2330', text: '#eceff4', muted: '#6c7a90' },
    term: {
      background: '#121821', foreground: '#e5e9f0', cursor: '#88c0d0', cursorAccent: '#121821', selectionBackground: '#88c0d044',
      black: '#2e3440', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b', blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
      brightBlack: '#4c566a', brightRed: '#d08770', brightGreen: '#b9d4a3', brightYellow: '#f0d9a8', brightBlue: '#9fbad6', brightMagenta: '#c9a8c4', brightCyan: '#8fbcbb', brightWhite: '#eceff4'
    }
  },
  void: {
    label: 'Void Purple',
    ui: { accent: '#bd93f9', accent2: '#50fa7b', bg: '#0e0b16', surface: '#1a1626', text: '#f8f8f2', muted: '#6d6a8a' },
    term: {
      background: '#0e0b16', foreground: '#f8f8f2', cursor: '#bd93f9', cursorAccent: '#0e0b16', selectionBackground: '#bd93f944',
      black: '#21222c', red: '#ff5555', green: '#50fa7b', yellow: '#f1fa8c', blue: '#8b9bf9', magenta: '#ff79c6', cyan: '#8be9fd', white: '#f8f8f2',
      brightBlack: '#6272a4', brightRed: '#ff6e6e', brightGreen: '#69ff94', brightYellow: '#ffffa5', brightBlue: '#a9b6ff', brightMagenta: '#ff92df', brightCyan: '#a4ffff', brightWhite: '#ffffff'
    }
  },
  sith: {
    label: 'Sith Red',
    ui: { accent: '#ff1f3d', accent2: '#ff8a00', bg: '#0b0204', surface: '#18060a', text: '#ffe0e4', muted: '#8a4a52' },
    term: {
      background: '#0b0204', foreground: '#ffd0d6', cursor: '#ff1f3d', cursorAccent: '#0b0204', selectionBackground: '#ff1f3d44',
      black: '#220a0e', red: '#ff1f3d', green: '#ff7a59', yellow: '#ff8a00', blue: '#d6455d', magenta: '#ff4f8b', cyan: '#ff9aa8', white: '#ffd0d6',
      brightBlack: '#6e2a33', brightRed: '#ff5c73', brightGreen: '#ffa088', brightYellow: '#ffb04d', brightBlue: '#e8798b', brightMagenta: '#ff85ad', brightCyan: '#ffc2ca', brightWhite: '#fff0f2'
    }
  },
  sakura: {
    label: 'Sakura',
    ui: { accent: '#ff8fb8', accent2: '#c9a7ff', bg: '#1d1320', surface: '#2a1c2e', text: '#fbe9f1', muted: '#a88aa0' },
    term: {
      background: '#1d1320', foreground: '#fbe9f1', cursor: '#ff8fb8', cursorAccent: '#1d1320', selectionBackground: '#ff8fb844',
      black: '#2e2130', red: '#ff6b8b', green: '#9fe2bf', yellow: '#ffd59e', blue: '#a7b8ff', magenta: '#ff8fb8', cyan: '#9ee6f0', white: '#f3dbe7',
      brightBlack: '#7a5f78', brightRed: '#ff8fa6', brightGreen: '#bdf0d4', brightYellow: '#ffe4bd', brightBlue: '#c4d0ff', brightMagenta: '#ffb3d0', brightCyan: '#c0f2f7', brightWhite: '#ffffff'
    }
  },
  tokyonight: {
    label: 'Tokyo Night',
    ui: { accent: '#7aa2f7', accent2: '#bb9af7', bg: '#1a1b26', surface: '#24283b', text: '#c0caf5', muted: '#565f89' },
    term: {
      background: '#1a1b26', foreground: '#c0caf5', cursor: '#7aa2f7', cursorAccent: '#1a1b26', selectionBackground: '#7aa2f744',
      black: '#15161e', red: '#f7768e', green: '#9ece6a', yellow: '#e0af68', blue: '#7aa2f7', magenta: '#bb9af7', cyan: '#7dcfff', white: '#a9b1d6',
      brightBlack: '#414868', brightRed: '#ff899d', brightGreen: '#b9f27c', brightYellow: '#ffc777', brightBlue: '#8db0ff', brightMagenta: '#c7a9ff', brightCyan: '#a4daff', brightWhite: '#c0caf5'
    }
  },
  catppuccin: {
    label: 'Catppuccin Mocha',
    ui: { accent: '#cba6f7', accent2: '#f5c2e7', bg: '#1e1e2e', surface: '#313244', text: '#cdd6f4', muted: '#7f849c' },
    term: {
      background: '#1e1e2e', foreground: '#cdd6f4', cursor: '#f5e0dc', cursorAccent: '#1e1e2e', selectionBackground: '#cba6f744',
      black: '#45475a', red: '#f38ba8', green: '#a6e3a1', yellow: '#f9e2af', blue: '#89b4fa', magenta: '#f5c2e7', cyan: '#94e2d5', white: '#bac2de',
      brightBlack: '#585b70', brightRed: '#f38ba8', brightGreen: '#a6e3a1', brightYellow: '#f9e2af', brightBlue: '#89b4fa', brightMagenta: '#f5c2e7', brightCyan: '#94e2d5', brightWhite: '#a6adc8'
    }
  },
  gruvbox: {
    label: 'Gruvbox',
    ui: { accent: '#fabd2f', accent2: '#fe8019', bg: '#1d2021', surface: '#282828', text: '#ebdbb2', muted: '#928374' },
    term: {
      background: '#1d2021', foreground: '#ebdbb2', cursor: '#fabd2f', cursorAccent: '#1d2021', selectionBackground: '#fabd2f33',
      black: '#282828', red: '#cc241d', green: '#98971a', yellow: '#d79921', blue: '#458588', magenta: '#b16286', cyan: '#689d6a', white: '#a89984',
      brightBlack: '#928374', brightRed: '#fb4934', brightGreen: '#b8bb26', brightYellow: '#fabd2f', brightBlue: '#83a598', brightMagenta: '#d3869b', brightCyan: '#8ec07c', brightWhite: '#ebdbb2'
    }
  },
  rosepine: {
    label: 'Rosé Pine',
    ui: { accent: '#ebbcba', accent2: '#c4a7e7', bg: '#191724', surface: '#1f1d2e', text: '#e0def4', muted: '#6e6a86' },
    term: {
      background: '#191724', foreground: '#e0def4', cursor: '#ebbcba', cursorAccent: '#191724', selectionBackground: '#c4a7e733',
      black: '#26233a', red: '#eb6f92', green: '#31748f', yellow: '#f6c177', blue: '#9ccfd8', magenta: '#c4a7e7', cyan: '#ebbcba', white: '#e0def4',
      brightBlack: '#6e6a86', brightRed: '#eb6f92', brightGreen: '#3e8fb0', brightYellow: '#f6c177', brightBlue: '#9ccfd8', brightMagenta: '#c4a7e7', brightCyan: '#ea9a97', brightWhite: '#e0def4'
    }
  },
  monokai: {
    label: 'Monokai Pro',
    ui: { accent: '#ffd866', accent2: '#ff6188', bg: '#221f22', surface: '#2d2a2e', text: '#fcfcfa', muted: '#939293' },
    term: {
      background: '#221f22', foreground: '#fcfcfa', cursor: '#ffd866', cursorAccent: '#221f22', selectionBackground: '#ffd86633',
      black: '#2d2a2e', red: '#ff6188', green: '#a9dc76', yellow: '#ffd866', blue: '#fc9867', magenta: '#ab9df2', cyan: '#78dce8', white: '#fcfcfa',
      brightBlack: '#727072', brightRed: '#ff7a9c', brightGreen: '#bde68f', brightYellow: '#ffe28a', brightBlue: '#ffad85', brightMagenta: '#c1b7f7', brightCyan: '#9ae7f0', brightWhite: '#ffffff'
    }
  },
  ocean: {
    label: 'Deep Ocean',
    ui: { accent: '#3fd2ff', accent2: '#2affb5', bg: '#04121f', surface: '#0a2033', text: '#d4f1ff', muted: '#4f7f99' },
    term: {
      background: '#04121f', foreground: '#cdeeff', cursor: '#3fd2ff', cursorAccent: '#04121f', selectionBackground: '#3fd2ff33',
      black: '#0b2238', red: '#ff6b7f', green: '#2affb5', yellow: '#ffe07a', blue: '#3f8cff', magenta: '#a58bff', cyan: '#3fd2ff', white: '#cdeeff',
      brightBlack: '#37617d', brightRed: '#ff8f9e', brightGreen: '#79ffd0', brightYellow: '#ffeaa3', brightBlue: '#78adff', brightMagenta: '#c2b0ff', brightCyan: '#86e3ff', brightWhite: '#ffffff'
    }
  },
  forest: {
    label: 'Forest',
    ui: { accent: '#8bd17c', accent2: '#e6c56b', bg: '#0f1712', surface: '#18241b', text: '#e2f0d9', muted: '#6c8a6a' },
    term: {
      background: '#0f1712', foreground: '#dcecd2', cursor: '#8bd17c', cursorAccent: '#0f1712', selectionBackground: '#8bd17c33',
      black: '#1b2a1f', red: '#e46d5b', green: '#8bd17c', yellow: '#e6c56b', blue: '#6fa8b5', magenta: '#c48bb0', cyan: '#7cc9a8', white: '#dcecd2',
      brightBlack: '#4f6b52', brightRed: '#f08c7c', brightGreen: '#aef09e', brightYellow: '#f2d98f', brightBlue: '#92c4cf', brightMagenta: '#dcaacb', brightCyan: '#a0e2c4', brightWhite: '#f4fbef'
    }
  },
  midnight: {
    label: 'Midnight Gold',
    ui: { accent: '#e8c36a', accent2: '#7f9cff', bg: '#0b0f1e', surface: '#141a30', text: '#ece6d4', muted: '#6d7394' },
    term: {
      background: '#0b0f1e', foreground: '#ece6d4', cursor: '#e8c36a', cursorAccent: '#0b0f1e', selectionBackground: '#e8c36a33',
      black: '#161d38', red: '#e5707a', green: '#9cd49a', yellow: '#e8c36a', blue: '#7f9cff', magenta: '#c49cf0', cyan: '#7fd3e0', white: '#ece6d4',
      brightBlack: '#4a5277', brightRed: '#f2959d', brightGreen: '#bce8b9', brightYellow: '#f5da98', brightBlue: '#a6bbff', brightMagenta: '#dabcf7', brightCyan: '#a8e6ef', brightWhite: '#ffffff'
    }
  },
  vaporwave: {
    label: 'Vaporwave',
    ui: { accent: '#01cdfe', accent2: '#ff71ce', bg: '#170e2b', surface: '#22173d', text: '#fff6fd', muted: '#9d84c2' },
    term: {
      background: '#170e2b', foreground: '#fff6fd', cursor: '#ff71ce', cursorAccent: '#170e2b', selectionBackground: '#01cdfe33',
      black: '#2a1c4a', red: '#ff5c8a', green: '#05ffa1', yellow: '#fffb96', blue: '#01cdfe', magenta: '#ff71ce', cyan: '#71f7ff', white: '#f2e6ff',
      brightBlack: '#6e5a9c', brightRed: '#ff86a8', brightGreen: '#6bffc4', brightYellow: '#fffcc0', brightBlue: '#6ee2ff', brightMagenta: '#ff9fdd', brightCyan: '#a8faff', brightWhite: '#ffffff'
    }
  },
  lava: {
    label: 'Lava',
    ui: { accent: '#ff5a1f', accent2: '#ffc22e', bg: '#120806', surface: '#1f0f0a', text: '#ffe8dc', muted: '#9a6a55' },
    term: {
      background: '#120806', foreground: '#ffe2d3', cursor: '#ff5a1f', cursorAccent: '#120806', selectionBackground: '#ff5a1f33',
      black: '#24120c', red: '#ff3b1f', green: '#e0c25a', yellow: '#ffc22e', blue: '#ff8a5c', magenta: '#ff5a86', cyan: '#ffb08a', white: '#ffe2d3',
      brightBlack: '#6e3f2e', brightRed: '#ff6a4f', brightGreen: '#f0d88a', brightYellow: '#ffd769', brightBlue: '#ffab88', brightMagenta: '#ff86a6', brightCyan: '#ffccb0', brightWhite: '#fff4ee'
    }
  },
  toxic: {
    label: 'Toxic',
    ui: { accent: '#b6ff2e', accent2: '#2effd8', bg: '#0a0f05', surface: '#131c0a', text: '#ecffd6', muted: '#6b8a4a' },
    term: {
      background: '#0a0f05', foreground: '#e3ffc8', cursor: '#b6ff2e', cursorAccent: '#0a0f05', selectionBackground: '#b6ff2e33',
      black: '#16210c', red: '#ff4f6d', green: '#b6ff2e', yellow: '#f4ff4f', blue: '#2ec8ff', magenta: '#d27bff', cyan: '#2effd8', white: '#e3ffc8',
      brightBlack: '#4b6631', brightRed: '#ff7f95', brightGreen: '#d0ff72', brightYellow: '#f8ff8a', brightBlue: '#72dcff', brightMagenta: '#e3a8ff', brightCyan: '#7affe6', brightWhite: '#ffffff'
    }
  },
  nordic: {
    label: 'Nord Aurora',
    ui: { accent: '#a3be8c', accent2: '#b48ead', bg: '#242933', surface: '#2e3440', text: '#eceff4', muted: '#7b88a1' },
    term: {
      background: '#242933', foreground: '#d8dee9', cursor: '#a3be8c', cursorAccent: '#242933', selectionBackground: '#a3be8c33',
      black: '#3b4252', red: '#bf616a', green: '#a3be8c', yellow: '#ebcb8b', blue: '#81a1c1', magenta: '#b48ead', cyan: '#88c0d0', white: '#e5e9f0',
      brightBlack: '#4c566a', brightRed: '#d08770', brightGreen: '#b5d19e', brightYellow: '#f0d9a8', brightBlue: '#5e81ac', brightMagenta: '#c9a8c4', brightCyan: '#8fbcbb', brightWhite: '#eceff4'
    }
  },
  solarized: {
    label: 'Solarized Dark',
    ui: { accent: '#2aa198', accent2: '#b58900', bg: '#002b36', surface: '#073642', text: '#eee8d5', muted: '#657b83' },
    term: {
      background: '#002b36', foreground: '#93a1a1', cursor: '#2aa198', cursorAccent: '#002b36', selectionBackground: '#2aa19833',
      black: '#073642', red: '#dc322f', green: '#859900', yellow: '#b58900', blue: '#268bd2', magenta: '#d33682', cyan: '#2aa198', white: '#eee8d5',
      brightBlack: '#586e75', brightRed: '#cb4b16', brightGreen: '#a3b82a', brightYellow: '#d6a520', brightBlue: '#4aa3e0', brightMagenta: '#6c71c4', brightCyan: '#55c4ba', brightWhite: '#fdf6e3'
    }
  },
  glass: {
    label: 'Glass Light',
    ui: { accent: '#3b6cff', accent2: '#00b3a4', bg: '#f4f6fb', surface: '#ffffff', text: '#1b2233', muted: '#6b7590' },
    term: {
      background: '#f4f6fb', foreground: '#1b2233', cursor: '#3b6cff', cursorAccent: '#ffffff', selectionBackground: '#3b6cff33',
      black: '#1b2233', red: '#d7263d', green: '#1a8f4a', yellow: '#b07800', blue: '#3b6cff', magenta: '#a23bd1', cyan: '#00838f', white: '#c9cfdd',
      brightBlack: '#5c6680', brightRed: '#ef4459', brightGreen: '#25b05f', brightYellow: '#d69500', brightBlue: '#5f88ff', brightMagenta: '#c25ef0', brightCyan: '#00a6b5', brightWhite: '#ffffff'
    }
  }
};
