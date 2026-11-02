const UPDATES = [
  "November 1: The Cube replaces the separate Hundred Floors with one connected 1,000 × 100 × 1,000 3D maze, repeated ramps rising 1–10 stories, and an interactive 3D minimap.",
  "Powerup Defense now runs for 60 waves, with more powerup defenses, stronger upgrades, and increasingly difficult enemy formations.",
  "October 26: Powerup Defense and The Hundred Floors now use the original maze drawing routines and game-screen layout, including the compact sidebar and cyan controls.",
  "Powerup Defense adds 1× / 2× / 3× speed, tougher varied waves, enemy support abilities, and next-upgrade stats directly beneath current stats.",
  "Fixed the old 3D decoration overlay: scenery now shares the same floor projection and obstacle depth as pickups and enemies. Wilds trees have thick trunks and roots.",
  "Playtime unlocks stay the same: Powerup Defense at 1 hour and The Cube at 2 hours. Active play and maze progress save for each player name in this browser.",
  "Added small equipped-skin perks: Lucky Peck, Alien Recovery, Slip Away, Ember Strike, and Crystal Shell. Alien stays 10,000 MIZ; turkey stays 1,000 hux.",
  "Rebalanced one-use powers to 250–2,500 MIZ and separated player cosmetics from coin and counter decorations.",
  "Orbital Ruins now has rounded suspended asteroids and translucent paths above stars, a moving nebula, and a distant 3D asteroid belt.",
  "Abandoned City now has skyscrapers of varying heights and a layered skyline.",
  "Increased supplies: 50 extra ammo pickups and 50 extra medkits in every combat maze.",
  "Fixed Labyrinth changes: the maze now shifts every 30 seconds on all difficulties.",
  "Strengthened Free the Flock powers and added denser pickups, with nearby supplies reachable along the paths.",
  "Rankings label unnamed opponents Random Player and mark your named entry with (you).",
];

export function UpdateNoticeBoard() {
  return <section className="update-notice-board" aria-labelledby="update-notice-title">
    <style>{`
      .update-notice-board { padding: 20px 24px; border: 1px solid #385e86; border-radius: 18px; background: linear-gradient(135deg, #122c46, #0b1b2e); color: #dceafa; }
      .update-notice-board h2 { margin: 0 0 12px; color: #bedcf5; font-size: 19px; letter-spacing: -.02em; }
      .update-notice-board ul { margin: 0; padding-left: 19px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px 30px; }
      .update-notice-board li { font-size: 12px; line-height: 1.7; padding-left: 3px; }
      .update-notice-board li::marker { color: #89b8df; }
      @media (max-width: 700px) { .update-notice-board { padding: 18px; } .update-notice-board ul { grid-template-columns: 1fr; } }
    `}</style>
    <h2 id="update-notice-title">Update board</h2>
    <ul>{UPDATES.map((update) => <li key={update}>{update}</li>)}</ul>
  </section>;
}
