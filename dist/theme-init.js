(() => {
  const colors = { plain: "#121714", daylight: "#f2f5ed", ocean: "#142333", forest: "#14251c", photo: "#14251c" };
  const aliases = { dusk: "ocean", moss: "forest" };
  try {
    const device = JSON.parse(localStorage.getItem("mob:device-preferences") || "{}");
    const guest = JSON.parse(localStorage.getItem("mob:guest") || "{}").settings || {};
    const choice = device.theme || guest.theme || "plain";
    const theme = aliases[choice] || choice;
    if (!Object.hasOwn(colors, theme)) return;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = colors[theme];
  } catch {
    // The page can still use its default theme if local storage is unavailable.
  }
})();
