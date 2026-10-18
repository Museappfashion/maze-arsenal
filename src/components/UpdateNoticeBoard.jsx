const UPDATES = [
  "Added player cosmetics: Shadow Wisp, Ember Spirit, Crystal Guardian, and Blobby Alien. Alien costs 10,000 MIZ; Turkey Disguise stays 1,000 hux.",
  "Rebalanced one-use powers to 250–2,500 MIZ and separated player cosmetics from coin and counter decorations.",
  "Rethemed 3D: open-space orbital ruins, natural jungle barriers, and worn flagstone keep floors.",
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
