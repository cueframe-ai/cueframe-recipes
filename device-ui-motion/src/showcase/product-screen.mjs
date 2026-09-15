import {round, texture} from '../render/textures.mjs';
export function screenMap(surface, ui) {
  const c = document.createElement("canvas");
  c.width = surface.width;
  c.height = Math.ceil(surface.height);
  const ctx = c.getContext("2d");
  ctx.fillStyle = ui.background;
  ctx.fillRect(0, 0, c.width, c.height);
  // Draw sharp source UI. Only the camera's depth pass determines optical defocus.
  ctx.save();
  ctx.textBaseline = "middle";
  ui.rows.forEach(({ label, color }, i) => {
    const y = surface.height - ui.rowsBottom + i * ui.rowGap;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ui.iconX, y, ui.iconRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i === ui.selectedRow ? ui.selectedTextColor : ui.textColor;
    ctx.font =
      (i === ui.selectedRow ? "600" : "500") +
      " " +
      ui.fontSize +
      "px " +
      ui.fontFamily;
    ctx.fillText(label, ui.textX, y);
  });
  ctx.restore();
  if (!ui.statusBar) return texture(c);
  // Native status placement remains inside the measured screen, not a fake bezel.
  ctx.save();
  ctx.fillStyle = "#c8c8ca";
  for (let i = 0; i < 4; i++) {
    round(ctx, 827 + i * 18, 114 - i * 8, 13, 14 + i * 8, 4);
    ctx.fill();
  }
  ctx.strokeStyle = "#c8c8ca";
  ctx.lineWidth = 7;
  for (const r of [10, 20, 30]) {
    ctx.beginPath();
    ctx.arc(940, 125, r, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  }
  round(ctx, 1000, 84, 81, 36, 9);
  ctx.fill();
  round(ctx, 1085, 94, 5, 15, 2);
  ctx.fill();
  ctx.restore();
  return texture(c);
}
