// Startup: settings → language → theme → session (restored or default)
(async function boot() {
  [App.settings, App.defaults, App.profiles] = await Promise.all([api.settings.get(), api.settings.defaults(), api.profiles()]);
  t.setLang(App.settings.language || 'ca');
  t.apply();
  if (App.settings.autoTheme === 'wallpaper' || App.settings.wallpaperAsBackground) {
    try { await Features.loadWallpaperTheme(); } catch {}
  }
  applySettings();

  let restored = false;
  // a window opened by dragging a tab out of another one: it shows just that tab
  const moved = await api.win.init();
  if (moved) {
    App.detached = true;
    try { restored = await restoreLayout({ active: 0, tabs: moved }); } catch { restored = false; }
  } else if (App.settings.restoreSession && App.settings.lastSession) {
    try { restored = await restoreLayout(App.settings.lastSession, { continueClaude: App.settings.claudeContinueOnRestore }); } catch { restored = false; }
  }
  if (!restored) {
    const def = profileById(App.settings.defaultProfile) ? App.settings.defaultProfile : App.profiles.find(p => !p.kind).id;
    const split = isClaude(def) && App.settings.startupSplit && profileById(App.settings.startupSplit) ? App.settings.startupSplit : null;
    await newTab(def, { split, ratio: App.settings.splitRatio });
  }
  App.booted = true;
  saveSessionSoon();
  // without Claude Code the app still works as a terminal, but says where to install it
  if (!profileById('claude')) notify({ kind: 'info', title: t('deps.noClaudeTitle'), message: t('deps.noClaude'), ptyId: null });
})();
